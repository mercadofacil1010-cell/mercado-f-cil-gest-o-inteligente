-- B7.3 — Baixa de estoque, cancelamento e devolução (RF-PDV-03/04/08,
-- RN-EST-07, RN-PDV-03/04/05).
--
-- Escopo decidido pelo agente com autorização direta do proprietário
-- ("faça o que você achar melhor", 29/09/2026, mesma decisão que abriu o
-- B7). Decisões de negócio tomadas aqui, seguindo a sugestão do próprio
-- documento funcional (PA-16/17/26) sempre que ela existia:
--
-- RN-PDV-03/PA-16 (de qual posição a venda baixa): cada posição de gôndola
-- já tem um produto-alvo (planograma, B3.1). Uma venda baixa da posição
-- daquele produto com o MAIOR saldo atual — mantém as prateleiras mais
-- cheias por mais tempo e nunca escolhe em silêncio (PA-17): a regra é
-- sempre a mesma, documentada aqui. Produto sem nenhuma posição configurada
-- no mercado fica como pendência nova ('pendente_posicao') — nunca inventa
-- posição, mesma lógica de nunca baixar produto errado já usada no B7.2.
--
-- RN-PDV-04 (venda maior que o saldo): NÃO bloqueia a venda (ela já
-- aconteceu de verdade no caixa) — o saldo da posição é zerado (nunca fica
-- negativo, mesma regra física de "saldo pode ser teórico entre contagens"
-- do RN-EST-07) e a diferença vira uma ocorrência na Central de
-- Inconsistências (B6.1, fonte nova 'venda') para o dono investigar/
-- recontar — reaproveita a régua de gravidade já existente, sem inventar
-- uma nova.
--
-- RN-PDV-05/PA-26 (cancelamento/devolução): a devolução é vinculada à
-- venda original (RF-PDV-01 já grava reference_external_event_id) e devolve
-- a quantidade para a MESMA posição de onde a venda original tirou —
-- rastreado item a item via sale_event_items.gondola_position_id. Se a
-- venda original não for encontrada (ex.: não registrada neste sistema),
-- cai na posição mais carente do produto (menor saldo) — de novo, uma
-- regra explícita, nunca uma escolha silenciosa.
--
-- RF-PDV-08 (avaliar reposição): reaproveita exatamente a mesma lógica de
-- "saldo caiu para o mínimo ou menos" já criada no B5.1 para o registro
-- manual de saldo — fatorada aqui numa função privada compartilhada, para
-- não duplicar a regra.

alter type public.sale_event_status add value 'pendente_posicao';
alter type public.incident_source add value 'venda';

alter table public.sale_event_items
  add column gondola_position_id uuid references public.gondola_positions (id);

alter table public.incidents
  add column reference_sale_event_id uuid references public.sale_events (id);

-- Fatora a criação da tarefa de reposição (B5.1) para ser reaproveitada
-- tanto pelo registro manual de saldo quanto pela baixa automática do PDV
-- (RF-PDV-08) — mesma regra, sem duplicar.
create function private.maybe_create_replenishment_task(
  p_position public.gondola_positions,
  p_balance numeric,
  p_user uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_threshold_days integer;
  v_quantity_needed numeric;
  v_is_ruptura boolean;
  v_is_near_expiry boolean;
  v_task public.replenishment_tasks;
begin
  if p_balance > p_position.min_quantity then
    return jsonb_build_object('task_created', false);
  end if;

  -- PA-13: já existe tarefa pendente para esta posição — nada a fazer.
  if exists (select 1 from public.replenishment_tasks where gondola_position_id = p_position.id and status = 'pendente') then
    return jsonb_build_object('task_created', false, 'reason', 'já existe uma tarefa pendente para esta posição');
  end if;

  select company_id into v_company_id from public.markets where id = p_position.market_id;
  select near_expiry_priority_days into v_threshold_days from public.companies where id = v_company_id;

  v_quantity_needed := p_position.ideal_quantity - p_balance;
  v_is_ruptura := p_balance <= 0;
  v_is_near_expiry := exists (
    select 1
    from public.lots l
    join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
    join public.lot_balances lb on lb.lot_id = l.id
    where wa.market_id = p_position.market_id
      and l.product_id = p_position.product_id
      and l.status = 'available'
      and l.expires_at is not null
      and l.expires_at <= (current_date + v_threshold_days)
      and lb.balance > 0
  );

  insert into public.replenishment_tasks (
    market_id, gondola_position_id, product_id, quantity_needed, is_ruptura, is_near_expiry, created_by, balance_before
  )
  values (
    p_position.market_id, p_position.id, p_position.product_id, v_quantity_needed, v_is_ruptura, v_is_near_expiry, p_user, p_balance
  )
  returning * into v_task;

  return jsonb_build_object('task_created', true, 'task_id', v_task.id, 'quantity_needed', v_task.quantity_needed);
end;
$$;

-- record_gondola_balance (B5.1/B5.3) passa a chamar a função fatorada
-- acima — mesmo comportamento de sempre (inclusive gravar balance_before,
-- B5.3), mesma assinatura.
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

  return private.maybe_create_replenishment_task(v_position, p_balance, v_user);
end;
$$;

-- create_incident (B6.1) ganha um parâmetro novo, no fim, com default —
-- like `create or replace` não basta aqui porque a lista de parâmetros
-- muda de tamanho (viraria uma sobrecarga nova, ambígua com a antiga nas
-- chamadas existentes): precisa de DROP explícito antes.
drop function private.create_incident(
  uuid, public.incident_source, text, uuid, uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid
);

create function private.create_incident(
  p_market_id uuid,
  p_source public.incident_source,
  p_description text,
  p_product_id uuid default null,
  p_warehouse_address_id uuid default null,
  p_reference_receiving_id uuid default null,
  p_reference_task_id uuid default null,
  p_reference_inventory_count_id uuid default null,
  p_reference_lot_id uuid default null,
  p_expected numeric default null,
  p_counted numeric default null,
  p_correction_movement_id uuid default null,
  p_reference_sale_event_id uuid default null
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_recurring boolean;
  v_severity public.incident_severity;
  v_row public.incidents;
begin
  v_is_recurring := p_product_id is not null and exists (
    select 1 from public.incidents i
    where i.market_id = p_market_id
      and i.product_id = p_product_id
      and i.created_at > now() - interval '30 days'
  );

  v_severity := private.calc_incident_severity(p_expected, p_counted, v_is_recurring);

  insert into public.incidents (
    market_id, source, severity, is_recurring, product_id, warehouse_address_id,
    reference_receiving_id, reference_task_id, reference_inventory_count_id, reference_lot_id,
    expected_quantity, counted_quantity, difference, description, correction_movement_id,
    reference_sale_event_id
  ) values (
    p_market_id, p_source, v_severity, v_is_recurring, p_product_id, p_warehouse_address_id,
    p_reference_receiving_id, p_reference_task_id, p_reference_inventory_count_id, p_reference_lot_id,
    p_expected, p_counted, coalesce(p_counted, 0) - coalesce(p_expected, 0), p_description, p_correction_movement_id,
    p_reference_sale_event_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Baixa o estoque (venda) ou devolve (cancelamento/devolução) da posição de
-- gôndola de cada item já mapeado (B7.2) — item ainda sem mapeamento não é
-- tocado aqui (continua com o try_map_sale_event). Sempre idempotente: só
-- mexe em item que ainda não tem gondola_position_id gravado.
--
-- security definer (diferente de try_map_sale_event): além de ser chamada
-- de dentro de funções já security definer (receive_sale_event etc.),
-- também é chamada pelo gatilho da tabela gondola_positions abaixo, que
-- roda com o privilégio de quem cadastra a posição (dono/gerente) — sem
-- elevar aqui, essa chamada não teria permissão de escrever em
-- sale_event_items/sale_events (mesmo padrão de private.create_incident).
create function private.try_process_sale_event(p_sale_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.sale_events;
  v_item record;
  v_position public.gondola_positions;
  v_new_balance numeric;
  v_shortfall numeric;
  v_all_processed boolean := true;
  v_any_unpositioned boolean := false;
  v_user uuid := (select auth.uid());
begin
  select * into v_event from public.sale_events where id = p_sale_event_id;

  -- Só processa depois que o mapeamento de produto (B7.2) já terminou.
  if v_event.status not in ('recebido', 'pendente_posicao') then
    return;
  end if;

  for v_item in
    select sei.* from public.sale_event_items sei
    where sei.sale_event_id = p_sale_event_id
      and sei.product_id is not null
      and sei.gondola_position_id is null
  loop
    v_position := null;

    if v_event.event_type = 'venda' then
      -- RN-PDV-03/PA-16/17: sempre a posição do produto com maior saldo —
      -- regra explícita, documentada, nunca uma escolha silenciosa.
      select gp.* into v_position from public.gondola_positions gp
      where gp.market_id = v_event.market_id and gp.product_id = v_item.product_id
      order by gp.current_balance desc, gp.code
      limit 1;
    else
      -- RN-PDV-05: devolve na mesma posição de onde a venda original
      -- tirou; sem isso, cai na posição mais carente do produto.
      select gp.* into v_position
      from public.sale_events se0
      join public.sale_event_items sei0 on sei0.sale_event_id = se0.id
      join public.gondola_positions gp on gp.id = sei0.gondola_position_id
      where se0.market_id = v_event.market_id
        and se0.external_event_id = v_event.reference_external_event_id
        and sei0.external_product_code = v_item.external_product_code;

      if v_position.id is null then
        select gp.* into v_position from public.gondola_positions gp
        where gp.market_id = v_event.market_id and gp.product_id = v_item.product_id
        order by gp.current_balance asc, gp.code
        limit 1;
      end if;
    end if;

    if v_position.id is null then
      v_all_processed := false;
      v_any_unpositioned := true;
      continue;
    end if;

    if v_event.event_type = 'venda' then
      v_new_balance := v_position.current_balance - v_item.base_quantity;
      if v_new_balance < 0 then
        v_shortfall := -v_new_balance;
        v_new_balance := 0;
      else
        v_shortfall := 0;
      end if;
    else
      v_new_balance := v_position.current_balance + v_item.base_quantity;
      v_shortfall := 0;
    end if;

    update public.gondola_positions
    set current_balance = v_new_balance, balance_updated_at = now(), balance_updated_by = v_user
    where id = v_position.id;

    update public.sale_event_items
    set gondola_position_id = v_position.id
    where id = v_item.id;

    if v_event.event_type = 'venda' then
      perform private.maybe_create_replenishment_task(v_position, v_new_balance, v_user);
    end if;

    if v_shortfall > 0 then
      perform private.create_incident(
        v_event.market_id, 'venda',
        format(
          'Venda de %s unidades não coube no saldo da posição %s — faltaram %s unidades (saldo zerado, corrija com uma recontagem).',
          v_item.base_quantity, v_position.code, v_shortfall
        ),
        v_item.product_id, null, null, null, null, null,
        v_item.base_quantity, v_position.current_balance, null, p_sale_event_id
      );
    end if;
  end loop;

  update public.sale_events
  set status = (case
    when v_all_processed then 'processado'
    when v_any_unpositioned then 'pendente_posicao'
    else status
  end)::public.sale_event_status
  where id = p_sale_event_id;
end;
$$;

-- receive_sale_event/create_pdv_product_mapping/reprocess_sale_event (B7.1/
-- B7.2) agora encadeiam também a baixa de estoque — mesmas assinaturas.
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
  perform private.try_process_sale_event(v_event.id);
  select * into v_event from public.sale_events where id = v_event.id;

  return jsonb_build_object('duplicate', false, 'event', to_jsonb(v_event));
end;
$$;

create or replace function public.create_pdv_product_mapping(
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
  -- este código específico — nunca duplica.
  for v_pending_event in
    select distinct se.id
    from public.sale_events se
    join public.sale_event_items sei on sei.sale_event_id = se.id
    where se.market_id = p_market_id
      and se.status = 'pendente_mapeamento'
      and sei.external_product_code = v_row.external_product_code
  loop
    perform private.try_map_sale_event(v_pending_event.id);
    perform private.try_process_sale_event(v_pending_event.id);
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_pdv_product_mapping(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.create_pdv_product_mapping(uuid, text, uuid, uuid) to authenticated;

create or replace function public.reprocess_sale_event(p_id uuid)
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
  perform private.try_process_sale_event(p_id);
  select * into v_event from public.sale_events where id = p_id;

  return v_event;
end;
$$;
revoke all on function public.reprocess_sale_event(uuid) from public, anon;
grant execute on function public.reprocess_sale_event(uuid) to authenticated;

-- Assim que uma posição de gôndola ganha (ou troca de) produto-alvo,
-- reprocessa sozinho os eventos que só estavam esperando por uma posição
-- (RF-PDV-07 aplicado também a esta pendência nova).
create function private.reprocess_sale_events_for_position()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pending record;
begin
  if new.product_id is not null and (tg_op = 'INSERT' or old.product_id is distinct from new.product_id) then
    for v_pending in
      select distinct se.id
      from public.sale_events se
      join public.sale_event_items sei on sei.sale_event_id = se.id
      where se.market_id = new.market_id
        and se.status = 'pendente_posicao'
        and sei.product_id = new.product_id
    loop
      perform private.try_process_sale_event(v_pending.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger gondola_positions_reprocess_sales
  after insert or update on public.gondola_positions
  for each row execute function private.reprocess_sale_events_for_position();

-- list_sale_events (B7.1/B7.2) também devolve os códigos com produto já
-- mapeado mas sem nenhuma posição de gôndola configurada no mercado —
-- pendência nova deste estágio. Lista de colunas muda de novo (DROP + CREATE).
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
  unmapped_codes text[],
  unpositioned_codes text[]
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
      array_remove(array_agg(distinct case when sei.product_id is null then sei.external_product_code end), null),
      array_remove(array_agg(distinct case when sei.product_id is not null and sei.gondola_position_id is null then sei.external_product_code end), null)
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
