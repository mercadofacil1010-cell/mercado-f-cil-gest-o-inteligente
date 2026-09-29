-- B5.3 — Contagem cega da gôndola, 3 tentativas (RF-REP-07/09, RN-REP-03/
-- 04/05/06, RN-CRT-REP-04/05, PA-14, E-05).
--
-- Decidido em DECISOES.md: a contagem cega é o passo final da tarefa de
-- reposição (DEC-B5-07) — substitui o "quantidade reposta" de texto livre
-- que o B5.2 pedia (register_replenishment_completion sai de cena). Depois
-- de devolver a sobra (se houver), o repositor conta cegamente o total da
-- prateleira agora — sem nunca ver o saldo teórico (RN-REP-03, mesma
-- blindagem estrutural do B4.2: a função nunca devolve o valor esperado, e
-- o repositor não tem select em gondola_positions desde o B3.1). O esperado
-- é saldo anterior + retirado − devolvido (DEC-B5-08). Até 3 tentativas
-- (RN-REP-05); cada uma fica registrada, nenhuma é apagada (RN-REP-04). Na
-- terceira divergência, a tarefa vira 'com_inconsistencia' — reaproveita o
-- mesmo status e a mesma decisão do gerente/dono já criados no B5.2
-- (PA-14/DEC-B5-04) — nenhum mecanismo novo (E-05: sem estado sem saída,
-- resolve_replenishment_inconsistency já cobre esse caso).
--
-- E-01 (nota): o exemplo da seção 4.5 do documento mestre tem uma inconsistência
-- própria (contagem 4 batendo com esperado 4 num contexto que não fecha) —
-- é um erro de redação do documento, não uma regra a seguir; a fórmula
-- implementada é a de DEC-B5-08.

alter table public.replenishment_tasks
  add column balance_before numeric(12, 3);

-- Registro de cada tentativa de contagem cega — nunca apagado (RN-REP-04).
create table public.replenishment_task_counts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.replenishment_tasks (id) on delete restrict,
  attempt integer not null,
  counted_quantity numeric(12, 3) not null check (counted_quantity >= 0),
  matches boolean not null,
  counted_by uuid not null references auth.users (id),
  counted_at timestamptz not null default now()
);
comment on table public.replenishment_task_counts is 'Tentativas de contagem cega da gôndola ao concluir uma tarefa de reposição (B5.3, até 3, RN-REP-05).';

create unique index replenishment_task_counts_task_attempt_key on public.replenishment_task_counts (task_id, attempt);

alter table public.replenishment_task_counts enable row level security;

create policy "replenishment_task_counts_select" on public.replenishment_task_counts for select to authenticated
  using (exists (
    select 1 from public.replenishment_tasks rt
    join public.markets m on m.id = rt.market_id
    where rt.id = task_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
        or (private.has_company_role(m.company_id, array['stocker']::public.member_role[]) and rt.accepted_by = (select auth.uid()))
      )
  ));

revoke insert, update, delete on public.replenishment_task_counts from authenticated, anon;

-- register_gondola_balance (B5.1) agora também guarda o saldo anterior da
-- tarefa, base do cálculo do esperado na contagem cega (DEC-B5-08).
create or replace function public.record_gondola_balance(p_position_id uuid, p_balance numeric)
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
    market_id, gondola_position_id, product_id, quantity_needed, is_ruptura, is_near_expiry, created_by, balance_before
  )
  values (
    v_position.market_id, p_position_id, v_position.product_id, v_quantity_needed, v_is_ruptura, v_is_near_expiry, v_user, p_balance
  )
  returning * into v_task;

  return jsonb_build_object('task_created', true, 'task_id', v_task.id, 'quantity_needed', v_task.quantity_needed);
end;
$$;

-- register_replenishment_completion (B5.2) sai de cena — a conclusão da
-- tarefa agora sempre passa pela devolução de sobra (se houver) e pela
-- contagem cega abaixo.
drop function public.register_replenishment_completion(uuid, numeric, numeric, uuid, text);

-- Registra a sobra devolvida (RN-REP-07) — pode ser chamada com 0 quando
-- não sobrou nada. Precisa acontecer antes da contagem cega, porque o
-- esperado da contagem depende do que foi devolvido (DEC-B5-08).
create function public.register_replenishment_return(
  p_task_id uuid,
  p_quantity_returned numeric default 0,
  p_return_warehouse_address_id uuid default null
)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_return_market_id uuid;
  v_return_lot_id uuid;
  v_withdrawal_lot public.lots;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar a devolução';
  end if;
  if p_quantity_returned is null or p_quantity_returned < 0 then
    raise exception 'Informe uma quantidade devolvida válida (zero ou maior)';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'em_transito' then
    raise exception 'Esta tarefa não está em trânsito — registre a retirada antes';
  end if;
  if v_task.accepted_by <> v_user then
    raise exception 'Esta tarefa foi aceita por outro repositor';
  end if;
  if v_task.quantity_returned is not null then
    raise exception 'A devolução desta tarefa já foi registrada';
  end if;

  if p_quantity_returned > 0 then
    if p_return_warehouse_address_id is null then
      raise exception 'Informe o endereço de depósito para devolver a sobra';
    end if;
    select market_id into v_return_market_id from public.warehouse_addresses where id = p_return_warehouse_address_id;
    if v_return_market_id is null or v_return_market_id <> v_task.market_id then
      raise exception 'Endereço de devolução não pertence ao mercado desta tarefa';
    end if;

    if v_task.withdrawal_lot_id is not null then
      select * into v_withdrawal_lot from public.lots where id = v_task.withdrawal_lot_id;
      select id into v_return_lot_id from public.get_or_create_lot(
        p_return_warehouse_address_id, v_task.product_id, v_withdrawal_lot.batch_number, v_withdrawal_lot.expires_at
      );
    end if;

    perform private.post_stock_movement(
      p_return_warehouse_address_id, v_task.product_id, 'entrada', p_quantity_returned,
      'Reposição ' || p_task_id || ' - sobra devolvida', null, v_return_lot_id
    );
  end if;

  update public.replenishment_tasks
  set quantity_returned = p_quantity_returned, return_warehouse_address_id = p_return_warehouse_address_id
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_replenishment_return(uuid, numeric, uuid) from public, anon;
grant execute on function public.register_replenishment_return(uuid, numeric, uuid) to authenticated;

-- Contagem cega da gôndola (RF-REP-07): nunca devolve o saldo esperado ao
-- repositor — só diz se bateu e, se não bateu, se ainda há tentativa.
create function public.submit_replenishment_count(p_task_id uuid, p_counted_quantity numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_expected numeric;
  v_matches boolean;
  v_attempt integer;
  v_final_status public.replenishment_task_status;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar a contagem';
  end if;
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'Informe uma quantidade contada válida (zero ou maior)';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'em_transito' then
    raise exception 'Esta tarefa não está pronta para contagem';
  end if;
  if v_task.accepted_by <> v_user then
    raise exception 'Esta tarefa foi aceita por outro repositor';
  end if;
  if v_task.quantity_returned is null then
    raise exception 'Registre a devolução da sobra (mesmo que zero) antes de contar';
  end if;

  select coalesce(max(attempt), 0) + 1 into v_attempt
  from public.replenishment_task_counts where task_id = p_task_id;
  if v_attempt > 3 then
    raise exception 'Este produto já teve 3 tentativas de contagem — aguarde a decisão do gerente';
  end if;

  v_expected := v_task.balance_before + v_task.quantity_withdrawn - v_task.quantity_returned;
  v_matches := (p_counted_quantity = v_expected);

  insert into public.replenishment_task_counts (task_id, attempt, counted_quantity, matches, counted_by)
  values (p_task_id, v_attempt, p_counted_quantity, v_matches, v_user);

  -- O saldo real observado agora é o mais confiável que existe, bateu ou não.
  update public.gondola_positions
  set current_balance = p_counted_quantity, balance_updated_at = now(), balance_updated_by = v_user
  where id = v_task.gondola_position_id;

  if v_matches then
    update public.replenishment_tasks
    set status = 'concluida',
        quantity_placed = v_task.quantity_withdrawn - v_task.quantity_returned,
        completed_at = now(),
        completed_by = v_user
    where id = p_task_id;
    return jsonb_build_object('matches', true, 'status', 'concluida', 'attempt', v_attempt);
  end if;

  if v_attempt >= 3 then
    v_final_status := 'com_inconsistencia';
    update public.replenishment_tasks
    set status = v_final_status,
        quantity_placed = p_counted_quantity - v_task.balance_before,
        completed_at = now(),
        completed_by = v_user
    where id = p_task_id;
    return jsonb_build_object('matches', false, 'status', v_final_status, 'attempt', v_attempt);
  end if;

  return jsonb_build_object('matches', false, 'status', 'em_transito', 'attempt', v_attempt, 'attempts_left', 3 - v_attempt);
end;
$$;
revoke all on function public.submit_replenishment_count(uuid, numeric) from public, anon;
grant execute on function public.submit_replenishment_count(uuid, numeric) to authenticated;

-- Auditoria (B0.2): estende o mecanismo genérico para as tentativas de contagem.
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
  elsif entity = 'replenishment_task_counts' then
    return query
      select m.company_id, m.id
      from public.replenishment_tasks rt
      join public.markets m on m.id = rt.market_id
      where rt.id = (row_data ->> 'task_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_replenishment_task_counts after insert on public.replenishment_task_counts
  for each row execute function private.audit_trigger();
