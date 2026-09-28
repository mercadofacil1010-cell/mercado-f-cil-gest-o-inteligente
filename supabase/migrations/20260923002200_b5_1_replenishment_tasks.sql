-- B5.1 — Geração automática de tarefas de reposição (RF-REP-01, RN-REP-01,
-- G-03, PA-10/11/13).
--
-- Decidido em DECISOES.md: sem PDV ainda (B7 não construído), então não há
-- como o sistema saber sozinho quando uma gôndola esvazia por venda — por
-- isso o saldo da posição é registrado manualmente (dono/gerente observa a
-- prateleira e informa o saldo atual), e é nesse registro que a tarefa nasce
-- automaticamente quando o saldo cai para o mínimo ou menos (G-03: "modo
-- manual até o PDV existir"). A reposição sugerida sempre mira o ideal, não
-- o máximo (PA-10) — o máximo continua só como limite de capacidade da
-- posição, já existente desde o B3.1.
--
-- Prioridade (PA-11) usa só o que já existe ou o que foi decidido agora, sem
-- inventar dado novo: ruptura (saldo zerado ou negativo), tempo aguardando
-- (calculado no momento da leitura, não guardado — cresce sozinho enquanto a
-- tarefa fica aberta) e validade (DEC-B5-02: existe lote daquele produto
-- perto de vencer em algum depósito do mesmo mercado, reaproveitando a
-- lógica FEFO do B3.3; "perto" é `companies.near_expiry_priority_days`,
-- default 7, configurável por empresa como o limite do B3.4). "Vendas
-- recentes" (sem PDV) e "criticidade" (sem campo próprio no produto,
-- DEC-B5-01) ficam de fora por enquanto — nenhum dos dois é inventado.
--
-- PA-13: nunca duas tarefas ativas para a mesma posição ao mesmo tempo —
-- índice único parcial, não só uma checagem que poderia ser esquecida.
--
-- Aceite, execução (entrada no depósito/retirada/em trânsito) e conclusão da
-- tarefa são o B5.2 — aqui a tarefa só nasce como 'pendente'; o enum aceita
-- novos valores depois (mesmo padrão de extensão usado em receiving_status).

alter table public.companies
  add column near_expiry_priority_days integer not null default 7 check (near_expiry_priority_days > 0);

alter table public.gondola_positions
  add column current_balance numeric(12, 3) not null default 0 check (current_balance >= 0),
  add column balance_updated_at timestamptz,
  add column balance_updated_by uuid references auth.users (id);

create type public.replenishment_task_status as enum ('pendente');

create table public.replenishment_tasks (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  gondola_position_id uuid not null references public.gondola_positions (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity_needed numeric(12, 3) not null check (quantity_needed > 0),
  is_ruptura boolean not null default false,
  is_near_expiry boolean not null default false,
  status public.replenishment_task_status not null default 'pendente',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);
comment on table public.replenishment_tasks is 'Tarefas de reposição de gôndola geradas automaticamente (B5.1). Aceite/execução chegam no B5.2.';

-- PA-13: só uma tarefa ativa por posição.
create unique index replenishment_tasks_one_pending_per_position
  on public.replenishment_tasks (gondola_position_id) where status = 'pendente';

create index replenishment_tasks_market_idx on public.replenishment_tasks (market_id);

alter table public.replenishment_tasks enable row level security;

create policy "replenishment_tasks_select" on public.replenishment_tasks for select to authenticated
  using (
    private.has_company_role((select company_id from public.markets where id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select company_id from public.markets where id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

revoke insert, update, delete on public.replenishment_tasks from authenticated, anon;

-- Registra o saldo observado na posição (RF-REP-01/G-03) e, se caiu para o
-- mínimo ou menos, cria a tarefa de reposição — idempotente enquanto já
-- existir uma tarefa pendente para a posição (PA-13).
create function public.record_gondola_balance(p_position_id uuid, p_balance numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_position public.gondola_positions;
  v_company_id uuid;
  v_threshold_days integer;
  v_quantity_needed numeric;
  v_is_ruptura boolean;
  v_is_near_expiry boolean;
  v_task public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar o saldo da gôndola';
  end if;
  if p_balance is null or p_balance < 0 then
    raise exception 'Informe um saldo válido (zero ou maior)';
  end if;

  select * into v_position from public.gondola_positions where id = p_position_id;
  if v_position.id is null then
    raise exception 'Posição de gôndola não encontrada';
  end if;
  if v_position.product_id is null then
    raise exception 'Esta posição ainda não tem produto atribuído — não é possível repor';
  end if;

  select company_id into v_company_id from public.markets where id = v_position.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_position.market_id))
  ) then
    raise exception 'Sem permissão para registrar o saldo desta posição';
  end if;

  update public.gondola_positions
  set current_balance = p_balance, balance_updated_at = now(), balance_updated_by = v_user
  where id = p_position_id;

  if p_balance > v_position.min_quantity then
    return jsonb_build_object('task_created', false);
  end if;

  -- PA-13: já existe tarefa pendente para esta posição — nada a fazer.
  if exists (select 1 from public.replenishment_tasks where gondola_position_id = p_position_id and status = 'pendente') then
    return jsonb_build_object('task_created', false, 'reason', 'já existe uma tarefa pendente para esta posição');
  end if;

  select near_expiry_priority_days into v_threshold_days from public.companies where id = v_company_id;

  v_quantity_needed := v_position.ideal_quantity - p_balance;
  v_is_ruptura := p_balance <= 0;
  v_is_near_expiry := exists (
    select 1
    from public.lots l
    join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
    join public.lot_balances lb on lb.lot_id = l.id
    where wa.market_id = v_position.market_id
      and l.product_id = v_position.product_id
      and l.status = 'available'
      and l.expires_at is not null
      and l.expires_at <= (current_date + v_threshold_days)
      and lb.balance > 0
  );

  insert into public.replenishment_tasks (
    market_id, gondola_position_id, product_id, quantity_needed, is_ruptura, is_near_expiry, created_by
  )
  values (
    v_position.market_id, p_position_id, v_position.product_id, v_quantity_needed, v_is_ruptura, v_is_near_expiry, v_user
  )
  returning * into v_task;

  return jsonb_build_object('task_created', true, 'task_id', v_task.id, 'quantity_needed', v_task.quantity_needed);
end;
$$;
revoke all on function public.record_gondola_balance(uuid, numeric) from public, anon;
grant execute on function public.record_gondola_balance(uuid, numeric) to authenticated;

-- Lista as tarefas pendentes de um mercado, com a prioridade calculada na
-- hora (tempo aguardando cresce sozinho, nunca fica desatualizado).
create function public.list_replenishment_tasks(p_market_id uuid)
returns table (
  id uuid,
  gondola_position_id uuid,
  gondola_position_code text,
  product_id uuid,
  product_name text,
  quantity_needed numeric,
  is_ruptura boolean,
  is_near_expiry boolean,
  waiting_hours numeric,
  priority_score numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para ver as tarefas de reposição deste mercado';
  end if;

  return query
    select
      rt.id,
      rt.gondola_position_id,
      gp.code,
      rt.product_id,
      p.name,
      rt.quantity_needed,
      rt.is_ruptura,
      rt.is_near_expiry,
      extract(epoch from (now() - rt.created_at)) / 3600 as waiting_hours,
      (case when rt.is_ruptura then 1000 else 0 end)
        + (case when rt.is_near_expiry then 500 else 0 end)
        + (extract(epoch from (now() - rt.created_at)) / 3600) as priority_score,
      rt.created_at
    from public.replenishment_tasks rt
    join public.gondola_positions gp on gp.id = rt.gondola_position_id
    join public.products p on p.id = rt.product_id
    where rt.market_id = p_market_id and rt.status = 'pendente'
    order by priority_score desc;
end;
$$;
revoke all on function public.list_replenishment_tasks(uuid) from public, anon;
grant execute on function public.list_replenishment_tasks(uuid) to authenticated;

-- Auditoria (B0.2): estende o mecanismo genérico.
create or replace function private.audit_scope(entity text, row_data jsonb)
returns table (company_id uuid, market_id uuid)
language plpgsql
stable
set search_path = ''
as $$
begin
  if entity = 'companies' then
    return query select (row_data ->> 'id')::uuid, null::uuid;
  elsif entity = 'markets' then
    return query select (row_data ->> 'company_id')::uuid, (row_data ->> 'id')::uuid;
  elsif entity = 'company_members' then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity = 'member_markets' then
    return query
      select cm.company_id, (row_data ->> 'market_id')::uuid
      from public.company_members cm
      where cm.id = (row_data ->> 'member_id')::uuid;
  elsif entity = 'profiles' then
    return query
      select cm.company_id, null::uuid
      from public.company_members cm
      where cm.user_id = (row_data ->> 'id')::uuid
      order by cm.created_at
      limit 1;
  elsif entity = 'invites' then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity in ('suppliers', 'categories', 'brands', 'products') then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity = 'product_packagings' then
    return query
      select p.company_id, null::uuid
      from public.products p
      where p.id = (row_data ->> 'product_id')::uuid;
  elsif entity = 'market_products' then
    return query
      select p.company_id, (row_data ->> 'market_id')::uuid
      from public.products p
      where p.id = (row_data ->> 'product_id')::uuid;
  elsif entity in ('warehouse_addresses', 'gondola_positions') then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'stock_movements' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'lots' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'pending_stock_adjustments' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'inventory_counts' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'inventory_count_items' then
    return query
      select m.company_id, m.id
      from public.inventory_counts ic
      join public.warehouse_addresses wa on wa.id = ic.warehouse_address_id
      join public.markets m on m.id = wa.market_id
      where ic.id = (row_data ->> 'inventory_count_id')::uuid;
  elsif entity = 'receivings' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity in ('receiving_items', 'receiving_counted_items', 'receiving_recount_requests') then
    return query
      select m.company_id, m.id
      from public.receivings r
      join public.markets m on m.id = r.market_id
      where r.id = (row_data ->> 'receiving_id')::uuid;
  elsif entity = 'replenishment_tasks' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_replenishment_tasks after insert on public.replenishment_tasks
  for each row execute function private.audit_trigger();
