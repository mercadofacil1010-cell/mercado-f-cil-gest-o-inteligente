-- B7.1 — Recepção de vendas do PDV, idempotente (RF-PDV-01/05, RN-PDV-01/02,
-- RN-INT-01/02/03/04/06, PA-25, RN-PDV-06).
--
-- Escopo decidido em DECISOES.md (autorização direta do proprietário, sem
-- PDV real ainda): esta etapa só recebe e desduplica o evento — não mapeia
-- produto (B7.2) nem baixa estoque (B7.3). `receive_sale_event` é o ponto
-- de entrada único; nenhum PDV real está conectado ainda, então dono/gerente
-- registra os eventos manualmente por enquanto (RN-INT-04) — o mesmo ponto
-- de entrada é o que um conector real (B7.4) vai chamar depois.
--
-- Idempotência (RN-PDV-01/RF-PDV-05/RN-INT-01): (market_id, external_event_id)
-- é único — reenviar o mesmo evento nunca cria uma segunda linha, só devolve
-- a que já existe. Retenção (RN-PDV-06): mesmo padrão de "sem exclusão
-- física" já usado em todo ledger deste projeto — nenhuma função de delete
-- existe para estas tabelas.

create type public.sale_event_type as enum ('venda', 'cancelamento', 'devolucao');
create type public.sale_event_status as enum ('recebido', 'pendente_mapeamento', 'processado', 'erro');

create table public.sale_events (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  register_code text not null check (char_length(btrim(register_code)) > 0),
  external_event_id text not null check (char_length(btrim(external_event_id)) > 0),
  event_type public.sale_event_type not null,
  reference_external_event_id text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  status public.sale_event_status not null default 'recebido',
  raw_payload jsonb not null,
  error_message text,
  processed_at timestamptz,
  received_by uuid not null references auth.users (id),
  check (event_type = 'venda' or reference_external_event_id is not null)
);
comment on table public.sale_events is 'Eventos de venda/cancelamento/devolução recebidos do PDV (B7.1) — idempotente por (market_id, external_event_id). Mapeamento de produto (B7.2) e baixa de estoque (B7.3) chegam depois; aqui só recepção e fila.';

create unique index sale_events_market_external_id_key on public.sale_events (market_id, external_event_id);
create index sale_events_market_status_idx on public.sale_events (market_id, status);

create table public.sale_event_items (
  id uuid primary key default gen_random_uuid(),
  sale_event_id uuid not null references public.sale_events (id) on delete restrict,
  external_product_code text not null check (char_length(btrim(external_product_code)) > 0),
  quantity numeric(12, 3) not null check (quantity <> 0)
);
comment on table public.sale_event_items is 'Itens de um evento de venda do PDV (B7.1) — código do produto ainda é o do PDV (external_product_code); o vínculo com o catálogo real chega no mapeamento (B7.2).';

create index sale_event_items_event_idx on public.sale_event_items (sale_event_id);

alter table public.sale_events enable row level security;
alter table public.sale_event_items enable row level security;

create policy "sale_events_select" on public.sale_events for select to authenticated
  using (
    private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

create policy "sale_event_items_select" on public.sale_event_items for select to authenticated
  using (exists (
    select 1 from public.sale_events se where se.id = sale_event_id
  ));

revoke insert, update, delete on public.sale_events from authenticated, anon;
revoke insert, update, delete on public.sale_event_items from authenticated, anon;

-- Ponto de entrada único (RN-INT-06: escopo da empresa/mercado já garantido
-- pela checagem de permissão). p_items: array de {external_product_code, quantity}.
create function public.receive_sale_event(
  p_market_id uuid,
  p_register_code text,
  p_external_event_id text,
  p_event_type public.sale_event_type,
  p_occurred_at timestamptz,
  p_items jsonb,
  p_reference_external_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_existing public.sale_events;
  v_event public.sale_events;
  v_item jsonb;
  v_item_count integer := 0;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um evento de venda';
  end if;
  if p_register_code is null or btrim(p_register_code) = '' then
    raise exception 'Informe o código do caixa';
  end if;
  if p_external_event_id is null or btrim(p_external_event_id) = '' then
    raise exception 'Informe o identificador do evento';
  end if;
  if p_event_type <> 'venda' and (p_reference_external_event_id is null or btrim(p_reference_external_event_id) = '') then
    raise exception 'Cancelamento e devolução precisam apontar para o evento de venda original';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe pelo menos um item do evento';
  end if;

  select company_id into v_company_id from public.markets where id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para registrar eventos de venda neste mercado';
  end if;

  -- RN-PDV-01/RF-PDV-05/RN-INT-01: idempotente — reenviar o mesmo evento
  -- nunca cria uma segunda linha, só devolve a que já existe.
  select * into v_existing from public.sale_events
  where market_id = p_market_id and external_event_id = p_external_event_id;
  if v_existing.id is not null then
    return jsonb_build_object('duplicate', true, 'event', to_jsonb(v_existing));
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'external_product_code') or btrim(v_item ->> 'external_product_code') = '' then
      raise exception 'Todo item precisa do código do produto no PDV';
    end if;
    if not (v_item ? 'quantity') or (v_item ->> 'quantity')::numeric = 0 then
      raise exception 'Todo item precisa de uma quantidade diferente de zero';
    end if;
    v_item_count := v_item_count + 1;
  end loop;

  insert into public.sale_events (
    market_id, register_code, external_event_id, event_type,
    reference_external_event_id, occurred_at, raw_payload, received_by
  ) values (
    p_market_id, p_register_code, p_external_event_id, p_event_type,
    p_reference_external_event_id, p_occurred_at, p_items, v_user
  )
  returning * into v_event;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_event_items (sale_event_id, external_product_code, quantity)
    values (v_event.id, v_item ->> 'external_product_code', (v_item ->> 'quantity')::numeric);
  end loop;

  return jsonb_build_object('duplicate', false, 'event', to_jsonb(v_event));
end;
$$;
revoke all on function public.receive_sale_event(uuid, text, text, public.sale_event_type, timestamptz, jsonb, text) from public, anon;
grant execute on function public.receive_sale_event(uuid, text, text, public.sale_event_type, timestamptz, jsonb, text) to authenticated;

create function public.list_sale_events(p_market_id uuid, p_status public.sale_event_status default null)
returns table (
  id uuid,
  register_code text,
  external_event_id text,
  event_type public.sale_event_type,
  reference_external_event_id text,
  occurred_at timestamptz,
  received_at timestamptz,
  status public.sale_event_status,
  error_message text,
  item_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para ver os eventos de venda';
  end if;

  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para ver eventos de venda deste mercado';
  end if;

  return query
    select
      se.id, se.register_code, se.external_event_id, se.event_type,
      se.reference_external_event_id, se.occurred_at, se.received_at,
      se.status, se.error_message, count(sei.id)
    from public.sale_events se
    left join public.sale_event_items sei on sei.sale_event_id = se.id
    where se.market_id = p_market_id
      and (p_status is null or se.status = p_status)
    group by se.id
    order by se.received_at desc;
end;
$$;
revoke all on function public.list_sale_events(uuid, public.sale_event_status) from public, anon;
grant execute on function public.list_sale_events(uuid, public.sale_event_status) to authenticated;

-- Auditoria genérica (B0.2) — corpo idêntico ao já publicado (B6.2), só
-- com mais um `elsif` para as tabelas novas.
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
  elsif entity = 'offline_sync_conflicts' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'incidents' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'alerts' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'sale_events' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'sale_event_items' then
    return query
      select m.company_id, m.id
      from public.sale_events se
      join public.markets m on m.id = se.market_id
      where se.id = (row_data ->> 'sale_event_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger sale_events_audit
  after insert or update on public.sale_events
  for each row execute function private.audit_trigger();

create trigger sale_event_items_audit
  after insert on public.sale_event_items
  for each row execute function private.audit_trigger();
