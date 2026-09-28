-- B4.4 — Recontagem, recusa e histórico (RF-REC-10, RN-REC-06/07, PA-09,
-- E-04).
--
-- Decidido em DECISOES.md: recontagem refaz só os itens com divergência —
-- os produtos que já bateram continuam valendo pela contagem anterior
-- (DEC-B4-06). Limite de 3 recontagens, regra própria e independente da
-- reposição (PA-09, já aceito no B4.1). Recusa existe nos dois níveis: por
-- item específico (o resto do recebimento segue normal) e da carga inteira
-- (DEC-B4-07) — evidência ainda é só motivo em texto (DEC-B4-08, mesma
-- decisão adiada do B3.4/B4.2). Correção depois de finalizado (RN-REC-10)
-- reaproveita o estorno/ajuste comum do B3.4 (DEC-B4-09) — não existe nada
-- novo aqui para isso, é o mesmo `register_stock_movement`/
-- `pending_stock_adjustments` já usado em perdas e ajustes.
--
-- Mecânica da recontagem: cada recebimento tem um "attempt" ativo
-- (receivings.active_attempt); pedir recontagem avança esse número e volta
-- o status para 'em_recontagem' — a contagem anterior nunca é apagada, só
-- fica com o attempt antigo. Comparação e finalização sempre usam, por
-- produto, a contagem do attempt mais recente daquele produto (não
-- necessariamente o attempt global do recebimento), o que já implementa "só
-- refaz o que pedir" sem precisar travar quais produtos podem ser contados
-- de novo. E-04 (recebimento sem saída do status "em_recontagem"): a mesma
-- finalize_receiving que já existia aceita esse status como entrada, e
-- reject_receiving também — não existe estado sem saída.

alter type public.receiving_status add value 'em_recontagem';

alter table public.receivings
  add column active_attempt integer not null default 1,
  add column recount_count integer not null default 0,
  add column rejected_at timestamptz,
  add column rejected_by uuid references auth.users (id),
  add column rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) > 0);

alter table public.receiving_counted_items
  add column attempt integer not null default 1,
  add column rejected boolean not null default false,
  add column rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) > 0),
  add column rejected_by uuid references auth.users (id),
  add column rejected_at timestamptz;

-- Histórico de pedidos de recontagem (RF-REC-10) — nunca escrito direto,
-- só via request_receiving_recount.
create table public.receiving_recount_requests (
  id uuid primary key default gen_random_uuid(),
  receiving_id uuid not null references public.receivings (id) on delete restrict,
  attempt integer not null,
  product_ids uuid[] not null check (array_length(product_ids, 1) > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  requested_by uuid not null references auth.users (id),
  requested_at timestamptz not null default now()
);
comment on table public.receiving_recount_requests is 'Histórico de pedidos de recontagem de um recebimento (B4.4, RF-REC-10).';

create index receiving_recount_requests_receiving_idx on public.receiving_recount_requests (receiving_id);

alter table public.receiving_recount_requests enable row level security;

create policy "receiving_recount_requests_select" on public.receiving_recount_requests for select to authenticated
  using (exists (
    select 1 from public.receivings r
    join public.markets m on m.id = r.market_id
    where r.id = receiving_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (
          private.has_company_role(m.company_id, array['manager', 'receiver']::public.member_role[])
          and private.can_access_market(m.id)
        )
      )
  ));

revoke insert, update, delete on public.receiving_recount_requests from authenticated, anon;

-- Pede recontagem de produtos específicos — só dono/gerente (quem vê a
-- comparação e decide), nunca o conferente. Até 3 vezes por recebimento
-- (PA-09).
create function public.request_receiving_recount(
  p_receiving_id uuid,
  p_product_ids uuid[],
  p_reason text
)
returns public.receivings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.receivings;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para pedir uma recontagem';
  end if;
  if p_product_ids is null or array_length(p_product_ids, 1) is null then
    raise exception 'Escolha pelo menos um produto para recontar';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da recontagem';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento não está pronto para recontagem (status atual: %)', v_receiving.status;
  end if;
  if v_receiving.recount_count >= 3 then
    raise exception 'Este recebimento já teve 3 recontagens — o limite foi atingido';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para pedir recontagem deste recebimento';
  end if;

  insert into public.receiving_recount_requests (receiving_id, attempt, product_ids, reason, requested_by)
  values (p_receiving_id, v_receiving.active_attempt + 1, p_product_ids, p_reason, v_user);

  update public.receivings
  set status = 'em_recontagem', active_attempt = active_attempt + 1, recount_count = recount_count + 1
  where id = p_receiving_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.request_receiving_recount(uuid, uuid[], text) from public, anon;
grant execute on function public.request_receiving_recount(uuid, uuid[], text) to authenticated;

-- add_receiving_count (B4.2) agora também aceita contar durante uma
-- recontagem, carimbando o attempt ativo do recebimento.
create or replace function public.add_receiving_count(
  p_receiving_id uuid,
  p_product_id uuid,
  p_packaging_id uuid,
  p_quantity numeric,
  p_batch_number text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_condition public.receiving_item_condition default 'bom_estado',
  p_note text default null
)
returns public.receiving_counted_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_packaging public.product_packagings;
  v_row public.receiving_counted_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar uma contagem';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe uma quantidade contada maior que zero';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem') then
    raise exception 'Este recebimento não está em conferência — inicie a conferência (ou a recontagem) antes de contar';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (
      private.has_company_role(v_company_id, array['manager', 'receiver']::public.member_role[])
      and private.can_access_market(v_market_id)
    )
  ) then
    raise exception 'Sem permissão para conferir este recebimento';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id and p.company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  select * into v_packaging from public.product_packagings
  where id = p_packaging_id and product_id = p_product_id;
  if v_packaging.id is null then
    raise exception 'Embalagem não encontrada para este produto';
  end if;

  insert into public.receiving_counted_items (
    receiving_id, product_id, packaging_id, counted_quantity, base_quantity,
    batch_number, manufactured_at, expires_at, condition, note, created_by, attempt
  )
  values (
    p_receiving_id, p_product_id, p_packaging_id, p_quantity, p_quantity * v_packaging.conversion_factor,
    nullif(btrim(coalesce(p_batch_number, '')), ''), p_manufactured_at, p_expires_at, p_condition,
    nullif(btrim(coalesce(p_note, '')), ''), v_user, v_receiving.active_attempt
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- remove_receiving_count (B4.2) só pode apagar contagens do attempt ativo —
-- uma tentativa anterior preservada nunca pode ser apagada (RN-REC-06).
create or replace function public.remove_receiving_count(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.receiving_counted_items;
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para remover uma contagem';
  end if;

  select * into v_item from public.receiving_counted_items where id = p_id;
  if v_item.id is null then
    raise exception 'Item contado não encontrado';
  end if;

  select * into v_receiving from public.receivings where id = v_item.receiving_id;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem') then
    raise exception 'Este recebimento não está mais em conferência';
  end if;
  if v_item.attempt <> v_receiving.active_attempt then
    raise exception 'Não é possível remover uma contagem de uma tentativa anterior';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (
      private.has_company_role(v_company_id, array['manager', 'receiver']::public.member_role[])
      and private.can_access_market(v_market_id)
    )
  ) then
    raise exception 'Sem permissão para conferir este recebimento';
  end if;

  delete from public.receiving_counted_items where id = p_id;
end;
$$;

-- Recusa de um item específico contado (RN-REC-07): a quantidade recusada
-- nunca entra no estoque; motivo obrigatório, evidência em foto fica para o
-- B5.4 (DEC-B4-08).
create function public.reject_receiving_count(p_id uuid, p_reason text)
returns public.receiving_counted_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.receiving_counted_items;
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.receiving_counted_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para recusar um item';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_item from public.receiving_counted_items where id = p_id;
  if v_item.id is null then
    raise exception 'Item contado não encontrado';
  end if;
  if v_item.rejected then
    raise exception 'Este item já foi recusado';
  end if;

  select * into v_receiving from public.receivings where id = v_item.receiving_id;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento já foi decidido — não é possível recusar mais itens';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para recusar itens deste recebimento';
  end if;

  update public.receiving_counted_items
  set rejected = true, rejection_reason = p_reason, rejected_by = v_user, rejected_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reject_receiving_count(uuid, text) from public, anon;
grant execute on function public.reject_receiving_count(uuid, text) to authenticated;

-- Recusa da carga inteira (RN-REC-07/DEC-B4-07): nada entra no estoque,
-- status vira 'recusado' — não pode mais ser retomado por esta função.
create function public.reject_receiving(p_receiving_id uuid, p_reason text)
returns public.receivings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.receivings;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para recusar um recebimento';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento já foi decidido — não é possível recusar';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para recusar este recebimento';
  end if;

  update public.receivings
  set status = 'recusado', rejected_at = now(), rejected_by = v_user, rejection_reason = p_reason
  where id = p_receiving_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reject_receiving(uuid, text) from public, anon;
grant execute on function public.reject_receiving(uuid, text) to authenticated;

-- get_receiving_comparison (B4.3) agora considera, por produto, só a
-- contagem do attempt mais recente e exclui itens recusados da soma.
create or replace function public.get_receiving_comparison(p_receiving_id uuid)
returns table (
  product_id uuid,
  product_name text,
  expected_quantity numeric,
  counted_quantity numeric,
  difference numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para ver a comparação do recebimento';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para ver a comparação deste recebimento';
  end if;

  return query
    with expected as (
      select ri.product_id, ri.expected_quantity
      from public.receiving_items ri
      where ri.receiving_id = p_receiving_id
    ), latest_attempt as (
      select rci.product_id, max(rci.attempt) as attempt
      from public.receiving_counted_items rci
      where rci.receiving_id = p_receiving_id
      group by rci.product_id
    ), counted as (
      select rci.product_id, sum(rci.base_quantity) as total
      from public.receiving_counted_items rci
      join latest_attempt la on la.product_id = rci.product_id and la.attempt = rci.attempt
      where rci.receiving_id = p_receiving_id and not rci.rejected
      group by rci.product_id
    )
    select
      coalesce(e.product_id, c.product_id),
      p.name,
      coalesce(e.expected_quantity, 0),
      coalesce(c.total, 0),
      coalesce(c.total, 0) - coalesce(e.expected_quantity, 0)
    from expected e
    full outer join counted c on c.product_id = e.product_id
    join public.products p on p.id = coalesce(e.product_id, c.product_id);
end;
$$;

-- finalize_receiving (B4.3) agora aceita finalizar a partir de
-- 'em_recontagem' também, e usa, por produto, só a contagem do attempt mais
-- recente, ignorando itens recusados (RN-REC-06/07).
create or replace function public.finalize_receiving(
  p_receiving_id uuid,
  p_destination_warehouse_address_id uuid,
  p_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_dest_market_id uuid;
  v_is_owner boolean;
  v_is_manager boolean;
  v_threshold numeric;
  v_row record;
  v_has_divergence boolean := false;
  v_needs_owner boolean := false;
  v_count_row public.receiving_counted_items;
  v_tracks_lot boolean;
  v_lot_id uuid;
  v_lot public.lots;
  v_posted integer := 0;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para decidir um recebimento';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento não está pronto para decisão (status atual: %)', v_receiving.status;
  end if;
  if not exists (select 1 from public.receiving_counted_items where receiving_id = p_receiving_id) then
    raise exception 'Nenhum item foi contado ainda — não é possível finalizar';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  v_is_owner := private.has_company_role(v_company_id, array['owner']::public.member_role[]);
  v_is_manager := private.has_company_role(v_company_id, array['manager']::public.member_role[])
    and private.can_access_market(v_market_id);
  if not (v_is_owner or v_is_manager) then
    raise exception 'Sem permissão para decidir este recebimento';
  end if;

  select market_id into v_dest_market_id from public.warehouse_addresses where id = p_destination_warehouse_address_id;
  if v_dest_market_id is null or v_dest_market_id <> v_receiving.market_id then
    raise exception 'Endereço de destino inválido para este recebimento';
  end if;

  select loss_adjustment_approval_threshold into v_threshold from public.companies where id = v_company_id;

  -- PA-06: sem tolerância — qualquer diferença é divergência. Por produto,
  -- só a contagem do attempt mais recente (RN-REC-06), excluindo recusados.
  for v_row in
    with expected as (
      select ri.product_id, ri.expected_quantity
      from public.receiving_items ri
      where ri.receiving_id = p_receiving_id
    ), latest_attempt as (
      select rci.product_id, max(rci.attempt) as attempt
      from public.receiving_counted_items rci
      where rci.receiving_id = p_receiving_id
      group by rci.product_id
    ), counted as (
      select rci.product_id, sum(rci.base_quantity) as total
      from public.receiving_counted_items rci
      join latest_attempt la on la.product_id = rci.product_id and la.attempt = rci.attempt
      where rci.receiving_id = p_receiving_id and not rci.rejected
      group by rci.product_id
    )
    select coalesce(c.total, 0) - coalesce(e.expected_quantity, 0) as difference
    from expected e
    full outer join counted c on c.product_id = e.product_id
  loop
    if v_row.difference <> 0 then
      v_has_divergence := true;
      if abs(v_row.difference) > v_threshold then
        v_needs_owner := true;
      end if;
    end if;
  end loop;

  if v_has_divergence and (p_justification is null or btrim(p_justification) = '') then
    raise exception 'Há divergência entre o esperado e o contado — informe a justificativa para decidir';
  end if;

  if v_needs_owner and not v_is_owner then
    update public.receivings set status = 'aguardando_aprovacao' where id = p_receiving_id;
    return jsonb_build_object('status', 'aguardando_aprovacao');
  end if;

  if v_has_divergence then
    perform set_config('app.justification', p_justification, true);
  end if;

  -- RN-REC-09: uma entrada por item CONTADO do attempt mais recente de cada
  -- produto, ignorando itens recusados (RN-REC-07) — nunca pela quantidade
  -- só documental.
  for v_count_row in
    select rci.*
    from public.receiving_counted_items rci
    join (
      select product_id, max(attempt) as attempt
      from public.receiving_counted_items
      where receiving_id = p_receiving_id
      group by product_id
    ) la on la.product_id = rci.product_id and la.attempt = rci.attempt
    where rci.receiving_id = p_receiving_id and not rci.rejected
  loop
    select p.tracks_batch_expiry into v_tracks_lot from public.products p where p.id = v_count_row.product_id;
    v_lot_id := null;

    if v_tracks_lot then
      if v_count_row.batch_number is null then
        raise exception 'O produto % controla lote — informe o número do lote na contagem antes de finalizar.', v_count_row.product_id;
      end if;
      select * into v_lot from public.get_or_create_lot(
        p_destination_warehouse_address_id, v_count_row.product_id, v_count_row.batch_number, v_count_row.expires_at
      );
      v_lot_id := v_lot.id;
    end if;

    perform public.register_stock_movement(
      p_destination_warehouse_address_id, v_count_row.product_id, 'entrada', v_count_row.base_quantity,
      'Recebimento ' || p_receiving_id,
      case when v_has_divergence then p_justification else null end,
      v_lot_id
    );
    v_posted := v_posted + 1;
  end loop;

  update public.receivings
  set status = 'finalizado', finalized_at = now(), finalized_by = v_user
  where id = p_receiving_id;

  return jsonb_build_object('status', 'finalizado', 'movements_posted', v_posted, 'had_divergence', v_has_divergence);
end;
$$;

-- Auditoria (AUD-05): extensão para o histórico de recontagem e para
-- capturar também as atualizações de contagem (recusa por item).
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

drop trigger audit_receiving_counted_items on public.receiving_counted_items;
create trigger audit_receiving_counted_items after insert or update on public.receiving_counted_items
  for each row execute function private.audit_trigger();

create trigger audit_receiving_recount_requests after insert on public.receiving_recount_requests
  for each row execute function private.audit_trigger();
