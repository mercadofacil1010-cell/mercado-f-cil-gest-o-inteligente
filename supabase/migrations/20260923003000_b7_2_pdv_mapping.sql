-- B7.2 — Mapeamento de produtos e pendências (RF-PDV-02/06/07, RN-PDV-07).
--
-- Escopo decidido pelo agente com autorização direta do proprietário
-- ("faça o que você achar melhor", 29/09/2026, mesma decisão que abriu o
-- B7): código do produto no PDV (`external_product_code`) é mapeado, por
-- mercado, para um produto+embalagem reais do catálogo — a conversão para
-- unidade base (RF-PDV-02) reaproveita `product_packagings.conversion_factor`,
-- exatamente como já é feito em `add_receiving_count` (B4.2). Evento com
-- item sem mapeamento nunca fica "pronto" silenciosamente (RN-PDV-07): fica
-- 'pendente_mapeamento' até alguém cadastrar o vínculo; cadastrar o vínculo
-- tenta reprocessar sozinho os eventos pendentes daquele código
-- (RF-PDV-07) — nunca duplica nada, só preenche o que faltava nos itens já
-- gravados no B7.1.

alter table public.sale_event_items
  add column product_id uuid references public.products (id),
  add column packaging_id uuid references public.product_packagings (id),
  add column base_quantity numeric(12, 3);

create table public.pdv_product_mappings (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  external_product_code text not null check (char_length(btrim(external_product_code)) > 0),
  product_id uuid not null references public.products (id) on delete restrict,
  packaging_id uuid not null references public.product_packagings (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
comment on table public.pdv_product_mappings is 'Liga o código de produto do PDV ao catálogo real, por mercado (B7.2). Evento com item sem mapeamento fica pendente (RN-PDV-07), nunca baixa produto errado.';

create unique index pdv_product_mappings_market_code_key on public.pdv_product_mappings (market_id, external_product_code);

alter table public.pdv_product_mappings enable row level security;

create policy "pdv_product_mappings_select" on public.pdv_product_mappings for select to authenticated
  using (
    private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

revoke insert, update, delete on public.pdv_product_mappings from authenticated, anon;

-- Tenta mapear todos os itens de um evento contra os vínculos já
-- cadastrados; atualiza o status do evento conforme o resultado. Chamado
-- ao receber o evento (B7.1) e de novo sempre que um vínculo novo é
-- cadastrado (RF-PDV-07) — sempre idempotente: só preenche o que ainda
-- está em branco, nunca duplica.
create function private.try_map_sale_event(p_sale_event_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_market_id uuid;
  v_item record;
  v_mapping public.pdv_product_mappings;
  v_all_mapped boolean := true;
begin
  select market_id into v_market_id from public.sale_events where id = p_sale_event_id;

  for v_item in
    select sei.* from public.sale_event_items sei where sei.sale_event_id = p_sale_event_id
  loop
    if v_item.product_id is null then
      select * into v_mapping from public.pdv_product_mappings
      where market_id = v_market_id and external_product_code = v_item.external_product_code;

      if v_mapping.id is not null then
        update public.sale_event_items
        set product_id = v_mapping.product_id,
            packaging_id = v_mapping.packaging_id,
            base_quantity = v_item.quantity * (select conversion_factor from public.product_packagings where id = v_mapping.packaging_id)
        where id = v_item.id;
      else
        v_all_mapped := false;
      end if;
    end if;
  end loop;

  update public.sale_events
  set status = case when v_all_mapped then 'recebido' else 'pendente_mapeamento' end::public.sale_event_status
  where id = p_sale_event_id and status <> 'processado';
end;
$$;

-- receive_sale_event (B7.1) agora tenta mapear os itens assim que o evento
-- é gravado — mesma assinatura de sempre, `create or replace`.
create or replace function public.receive_sale_event(
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

  perform private.try_map_sale_event(v_event.id);
  select * into v_event from public.sale_events where id = v_event.id;

  return jsonb_build_object('duplicate', false, 'event', to_jsonb(v_event));
end;
$$;

-- Cadastra (ou corrige) o vínculo — dono/gerente com acesso ao mercado —
-- e reprocessa sozinho os eventos que estavam pendentes só por causa deste
-- código (RF-PDV-07).
create function public.create_pdv_product_mapping(
  p_market_id uuid,
  p_external_product_code text,
  p_product_id uuid,
  p_packaging_id uuid
)
returns public.pdv_product_mappings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_row public.pdv_product_mappings;
  v_pending_event record;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para cadastrar um vínculo de produto';
  end if;
  if p_external_product_code is null or btrim(p_external_product_code) = '' then
    raise exception 'Informe o código do produto no PDV';
  end if;

  select company_id into v_company_id from public.markets where id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para cadastrar vínculos de produto neste mercado';
  end if;

  if not exists (select 1 from public.products where id = p_product_id and company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;
  if not exists (select 1 from public.product_packagings where id = p_packaging_id and product_id = p_product_id) then
    raise exception 'Embalagem não pertence a este produto';
  end if;

  insert into public.pdv_product_mappings (market_id, external_product_code, product_id, packaging_id, created_by)
  values (p_market_id, btrim(p_external_product_code), p_product_id, p_packaging_id, v_user)
  on conflict (market_id, external_product_code)
  do update set product_id = excluded.product_id, packaging_id = excluded.packaging_id,
    updated_at = now(), updated_by = v_user
  returning * into v_row;

  -- RF-PDV-07: reprocessa sozinho os eventos que só estavam esperando
  -- este código específico — nunca duplica (try_map_sale_event só
  -- preenche o que está em branco).
  for v_pending_event in
    select distinct se.id
    from public.sale_events se
    join public.sale_event_items sei on sei.sale_event_id = se.id
    where se.market_id = p_market_id
      and se.status = 'pendente_mapeamento'
      and sei.external_product_code = v_row.external_product_code
  loop
    perform private.try_map_sale_event(v_pending_event.id);
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_pdv_product_mapping(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.create_pdv_product_mapping(uuid, text, uuid, uuid) to authenticated;

create function public.list_pdv_product_mappings(p_market_id uuid)
returns table (
  id uuid,
  external_product_code text,
  product_id uuid,
  product_name text,
  packaging_id uuid,
  packaging_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para ver os vínculos de produto';
  end if;

  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para ver vínculos de produto deste mercado';
  end if;

  return query
    select pm.id, pm.external_product_code, pm.product_id, p.name, pm.packaging_id, pp.name, pm.created_at
    from public.pdv_product_mappings pm
    join public.products p on p.id = pm.product_id
    join public.product_packagings pp on pp.id = pm.packaging_id
    where pm.market_id = p_market_id
    order by pm.external_product_code;
end;
$$;
revoke all on function public.list_pdv_product_mappings(uuid) from public, anon;
grant execute on function public.list_pdv_product_mappings(uuid) to authenticated;

-- Botão explícito de "tentar de novo" (RF-PDV-07) — além do reprocesso
-- automático ao cadastrar um vínculo, para quando o vínculo já existia e
-- alguma outra coisa tinha dado errado.
create function public.reprocess_sale_event(p_id uuid)
returns public.sale_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.sale_events;
  v_company_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para reprocessar um evento';
  end if;

  select * into v_event from public.sale_events where id = p_id;
  if v_event.id is null then
    raise exception 'Evento não encontrado';
  end if;

  select company_id into v_company_id from public.markets where id = v_event.market_id;
  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_event.market_id))
  ) then
    raise exception 'Sem permissão para reprocessar eventos deste mercado';
  end if;
  if v_event.status = 'processado' then
    raise exception 'Este evento já foi processado';
  end if;

  perform private.try_map_sale_event(p_id);
  select * into v_event from public.sale_events where id = p_id;

  return v_event;
end;
$$;
revoke all on function public.reprocess_sale_event(uuid) from public, anon;
grant execute on function public.reprocess_sale_event(uuid) to authenticated;

-- list_sale_events (B7.1) agora também devolve, para eventos pendentes de
-- mapeamento, quais códigos ainda faltam vincular — mesma assinatura de
-- sempre, `create or replace` não é possível porque a lista de colunas
-- devolvidas muda (precisa de DROP + CREATE).
drop function public.list_sale_events(uuid, public.sale_event_status);

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
  item_count bigint,
  unmapped_codes text[]
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
      se.status, se.error_message, count(sei.id),
      array_remove(array_agg(distinct case when sei.product_id is null then sei.external_product_code end), null)
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

-- Auditoria genérica (B0.2) — corpo idêntico ao já publicado (B7.1), só
-- com mais um `elsif` para a tabela nova.
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
  elsif entity = 'pdv_product_mappings' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger pdv_product_mappings_audit
  after insert or update on public.pdv_product_mappings
  for each row execute function private.audit_trigger();

create trigger sale_event_items_map_audit
  after update on public.sale_event_items
  for each row execute function private.audit_trigger();
