-- B7.4 — Conector do PDV real (RF-PDV, RNF-SEC-02 "tokens e integrações",
-- antes registrada como não aplicável — B10.2 — porque não existia nenhum
-- token de integração no sistema). Sem saber ainda qual sistema de PDV o
-- piloto vai usar, a peça que dá para construir de verdade é genérica:
-- um token de API por mercado, criado pelo dono, que qualquer PDV real
-- pode usar para chamar o mesmo pipeline de recepção de vendas do B7.1.
-- O valor do token só existe em texto puro uma vez, no momento da
-- criação — só o hash fica guardado (mesma lógica de não guardar segredo
-- em texto puro de qualquer provedor de autenticação).
\set ON_ERROR_STOP 1

create extension if not exists pgcrypto;

create table public.pdv_integration_tokens (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  label text not null check (char_length(btrim(label)) > 0),
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
comment on table public.pdv_integration_tokens is 'Tokens de integração do conector de PDV (B7.4). Só o hash (sha-256) é guardado — o valor em texto puro só existe uma vez, devolvido na criação.';

alter table public.pdv_integration_tokens enable row level security;
create policy "pdv_tokens_select" on public.pdv_integration_tokens for select to authenticated
  using (private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[]));
revoke insert, update, delete on public.pdv_integration_tokens from authenticated, anon;

create trigger pdv_integration_tokens_audit
  after insert or update on public.pdv_integration_tokens
  for each row execute function private.audit_trigger();

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
  elsif entity = 'pdv_integration_tokens' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

-- Núcleo de ingestão de evento de venda, extraído de receive_sale_event
-- (B7.1/B7.2/B7.3/B8.1) para ser reaproveitado tanto pela chamada
-- autenticada (dono/gerente lançando manualmente) quanto pela chamada via
-- token do conector de PDV — mesma validação, mesma idempotência, mesmo
-- encadeamento de mapeamento/baixa de estoque, só muda quem é autorizado
-- e quem fica registrado como "received_by".
create function private.ingest_sale_event(
  p_market_id uuid,
  p_register_code text,
  p_external_event_id text,
  p_event_type public.sale_event_type,
  p_occurred_at timestamptz,
  p_items jsonb,
  p_reference_external_event_id text,
  p_received_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.sale_events;
  v_event public.sale_events;
  v_item jsonb;
  v_item_count integer := 0;
begin
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
    p_reference_external_event_id, p_occurred_at, p_items, p_received_by
  )
  returning * into v_event;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_event_items (sale_event_id, external_product_code, quantity, unit_price)
    values (
      v_event.id, v_item ->> 'external_product_code', (v_item ->> 'quantity')::numeric,
      case when v_item ? 'unit_price' then (v_item ->> 'unit_price')::numeric else null end
    );
  end loop;

  perform private.try_map_sale_event(v_event.id);
  perform private.try_process_sale_event(v_event.id);
  select * into v_event from public.sale_events where id = v_event.id;

  return jsonb_build_object('duplicate', false, 'event', to_jsonb(v_event));
end;
$$;

-- receive_sale_event (B7.1/B7.2/B7.3/B8.1) passa a delegar para
-- private.ingest_sale_event — mesmíssima assinatura e comportamento,
-- só sem duplicar a lógica que o conector de PDV (abaixo) também usa.
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
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um evento de venda';
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

  return private.ingest_sale_event(
    p_market_id, p_register_code, p_external_event_id, p_event_type,
    p_occurred_at, p_items, p_reference_external_event_id, v_user
  );
end;
$$;

-- Cria um token de integração para um mercado — só o dono, e o valor em
-- texto puro só existe neste retorno (nunca mais é recuperável).
create function public.create_pdv_token(p_market_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_token text;
  v_row public.pdv_integration_tokens;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para criar um token de integração';
  end if;
  if p_label is null or btrim(p_label) = '' then
    raise exception 'Informe um nome para identificar o token';
  end if;

  select company_id into v_company_id from public.markets where id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.has_company_role(v_company_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono cria token de integração do PDV';
  end if;

  v_token := encode(public.gen_random_bytes(32), 'hex');

  insert into public.pdv_integration_tokens (market_id, label, token_hash, created_by)
  values (p_market_id, btrim(p_label), encode(public.digest(v_token, 'sha256'), 'hex'), v_user)
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'label', v_row.label, 'token', v_token, 'createdAt', v_row.created_at);
end;
$$;
revoke all on function public.create_pdv_token(uuid, text) from public, anon;
grant execute on function public.create_pdv_token(uuid, text) to authenticated;

-- Lista os tokens de um mercado — nunca devolve o valor nem o hash, só os
-- metadados para o dono acompanhar/revogar.
create function public.list_pdv_tokens(p_market_id uuid)
returns table (id uuid, label text, created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.has_company_role(v_company_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono vê os tokens de integração do PDV';
  end if;

  return query
    select t.id, t.label, t.created_at, t.last_used_at, t.revoked_at
    from public.pdv_integration_tokens t
    where t.market_id = p_market_id
    order by t.created_at desc;
end;
$$;
revoke all on function public.list_pdv_tokens(uuid) from public, anon;
grant execute on function public.list_pdv_tokens(uuid) to authenticated;

-- Revoga um token — some da lista de válidos, mas a linha nunca é
-- apagada (RN-ACL-06), preservando o histórico de uso (last_used_at).
create function public.revoke_pdv_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select m.company_id into v_company_id
  from public.pdv_integration_tokens t
  join public.markets m on m.id = t.market_id
  where t.id = p_token_id;
  if v_company_id is null then
    raise exception 'Token não encontrado';
  end if;
  if not private.has_company_role(v_company_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono revoga token de integração do PDV';
  end if;

  update public.pdv_integration_tokens set revoked_at = now() where id = p_token_id and revoked_at is null;
end;
$$;
revoke all on function public.revoke_pdv_token(uuid) from public, anon;
grant execute on function public.revoke_pdv_token(uuid) to authenticated;

-- Ponto de entrada do conector de PDV real: autenticado pelo token, não
-- por sessão do Supabase Auth — é o PDV (fora do navegador) quem chama
-- isto. Mesmo pipeline de recepção/idempotência/mapeamento/baixa de
-- estoque do receive_sale_event (B7.1/B7.2/B7.3).
create function public.pdv_receive_sale_event(
  p_token text,
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
  v_token_row public.pdv_integration_tokens;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Token de integração ausente';
  end if;

  select * into v_token_row from public.pdv_integration_tokens
  where token_hash = encode(public.digest(p_token, 'sha256'), 'hex');

  if v_token_row.id is null then
    raise exception 'Token de integração inválido';
  end if;
  if v_token_row.revoked_at is not null then
    raise exception 'Token de integração revogado';
  end if;

  update public.pdv_integration_tokens set last_used_at = now() where id = v_token_row.id;

  return private.ingest_sale_event(
    v_token_row.market_id, p_register_code, p_external_event_id, p_event_type,
    p_occurred_at, p_items, p_reference_external_event_id, v_token_row.created_by
  );
end;
$$;
revoke all on function public.pdv_receive_sale_event(text, text, text, public.sale_event_type, timestamptz, jsonb, text) from public;
grant execute on function public.pdv_receive_sale_event(text, text, text, public.sale_event_type, timestamptz, jsonb, text) to anon, authenticated;
