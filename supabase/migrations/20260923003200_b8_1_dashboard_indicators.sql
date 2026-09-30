-- B8.1 — Indicadores reais da rede e do mercado (RF-DSH-*/RN-DSH-*).
--
-- Escopo decidido com o proprietário (29/09/2026): até agora o catálogo não
-- tinha nenhum campo de preço (perda/ajuste do B3.4 já registrava essa
-- lacuna) — sem preço não dá para calcular faturamento nem ticket médio de
-- verdade. Decisão: acrescentar preço de venda opcional ao produto
-- (`products.sale_price`) e guardar o preço realmente usado em cada item de
-- venda (`sale_event_items.unit_price`, RF-DSH-03/RN-DSH-03: rastreável até
-- a origem) — se o PDV não mandar o preço, cai no preço do catálogo no
-- momento em que o item é mapeado (nunca recalcula depois, então o
-- faturamento de um dia não muda se o preço mudar amanhã). Item de produto
-- sem nenhum preço conhecido simplesmente não soma no faturamento — não
-- inventa valor.
--
-- PA-48 (dados financeiros): só faturamento e vendas do PDV, como o
-- documento sugere — custo e margem ficam de fora porque o catálogo não tem
-- custo (só preço de venda), então calcular margem seria inventar dado.
--
-- Fórmulas dos 15 indicadores do cliente (escolhidas pelo agente, aceitando
-- a sugestão de usar fórmulas padrão do varejo, já que o texto original da
-- seção 6.1 não está disponível neste repositório):
--   IND-01 Faturamento do dia   = soma(base_quantity * unit_price) de vendas
--                                  processadas hoje, MENOS cancelamento/devolução
--   IND-02 Vendas realizadas     = nº de eventos tipo 'venda' processados hoje
--   IND-03 Ticket médio          = faturamento do dia / vendas realizadas
--   IND-04 Itens vendidos        = soma(base_quantity) de vendas processadas hoje
--   IND-05 Estoque baixo         = nº posições de gôndola com saldo <= mínimo
--   IND-06 Ruptura               = nº posições de gôndola com saldo <= 0
--   IND-07 Reposições pendentes = nº tarefas de reposição não concluídas
--   IND-08 Tempo médio de reposição = média (concluída_em - criada_em) das
--                                  últimas tarefas concluídas (30 dias)
--   IND-09 Próx. do vencimento  = nº lotes com saldo vencendo em até
--                                  near_expiry_priority_days (RN-EST, B3.3/B5.1)
--   IND-10 Perdas                = soma (valor absoluto) dos movimentos tipo
--                                  'perda' no período — em unidades (sem custo,
--                                  não dá para converter em R$: PA-48)
--   IND-11 Inconsistências abertas = nº ocorrências não encerradas
--   IND-12 Acuracidade de estoque = 100 * (1 - soma|diferença| / soma(teórico))
--                                  dos últimos inventários finalizados (90 dias)
--   IND-13 Giro do estoque        = unidades vendidas no período / saldo atual
--                                  total (proxy de saldo médio — sem custo,
--                                  giro é calculado em unidades, não em R$)
--   IND-14 Produto sem giro       = nº produtos com posição de gôndola e
--                                  zero unidades vendidas no período
--   IND-15 Cobertura de estoque   = saldo atual total / venda média diária
--                                  do período, em dias

alter table public.products
  add column sale_price numeric(12, 2) check (sale_price is null or sale_price >= 0);
comment on column public.products.sale_price is 'Preço de venda ao consumidor (B8.1, opcional). Sem ele, o produto não entra no cálculo de faturamento/ticket médio.';

alter table public.sale_event_items
  add column unit_price numeric(12, 2);
comment on column public.sale_event_items.unit_price is 'Preço realmente usado nesta venda (B8.1) — vem do PDV quando informado, senão é o preço do catálogo no momento do mapeamento (nunca recalculado depois).';

-- try_map_sale_event (B7.2/B7.3) agora também resolve o preço do item —
-- mesma assinatura, `create or replace`.
create or replace function private.try_map_sale_event(p_sale_event_id uuid)
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
            base_quantity = v_item.quantity * (select conversion_factor from public.product_packagings where id = v_mapping.packaging_id),
            unit_price = coalesce(v_item.unit_price, (select sale_price from public.products where id = v_mapping.product_id))
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

-- receive_sale_event (B7.1/B7.2/B7.3) aceita opcionalmente o preço de cada
-- item (RF-PDV, já usado pelo PDV real quando existir) — mesma assinatura.
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

-- Indicadores de um único mercado (RF-DSH-01/03/06/07, IND-01..15). Um só
-- jsonb para facilitar extensão sem precisar de DROP a cada campo novo.
create function public.get_market_dashboard(p_market_id uuid, p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_period_start timestamptz;
  v_threshold_days integer;
  v_revenue numeric;
  v_sales_count bigint;
  v_items_sold numeric;
  v_low_stock bigint;
  v_ruptura bigint;
  v_pending_replenishment bigint;
  v_avg_replenishment_hours numeric;
  v_near_expiry bigint;
  v_losses numeric;
  v_open_incidents bigint;
  v_accuracy numeric;
  v_current_balance numeric;
  v_turnover numeric;
  v_no_turnover_count bigint;
  v_coverage_days numeric;
begin
  perform private.assert_market_manage_access(p_market_id);
  select company_id into v_company_id from public.markets where id = p_market_id;
  select near_expiry_priority_days into v_threshold_days from public.companies where id = v_company_id;
  v_period_start := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);

  -- IND-01/02/03/04: vendas líquidas do período (venda menos cancelamento/devolução).
  select
    coalesce(sum(case when se.event_type = 'venda' then sei.base_quantity * sei.unit_price
                       else -sei.base_quantity * sei.unit_price end)
             filter (where sei.unit_price is not null), 0),
    count(distinct se.id) filter (where se.event_type = 'venda'),
    coalesce(sum(case when se.event_type = 'venda' then sei.base_quantity else -sei.base_quantity end), 0)
  into v_revenue, v_sales_count, v_items_sold
  from public.sale_events se
  join public.sale_event_items sei on sei.sale_event_id = se.id
  where se.market_id = p_market_id and se.status = 'processado' and se.occurred_at >= v_period_start;

  -- IND-05/06: estado atual das posições de gôndola (não depende do período).
  select
    count(*) filter (where current_balance <= min_quantity),
    count(*) filter (where current_balance <= 0)
  into v_low_stock, v_ruptura
  from public.gondola_positions
  where market_id = p_market_id and product_id is not null;

  select sum(current_balance) into v_current_balance
  from public.gondola_positions where market_id = p_market_id and product_id is not null;

  -- IND-07/08: reposição.
  select count(*) into v_pending_replenishment
  from public.replenishment_tasks
  where market_id = p_market_id and status <> 'concluida';

  select avg(extract(epoch from (completed_at - created_at)) / 3600.0) into v_avg_replenishment_hours
  from public.replenishment_tasks
  where market_id = p_market_id and status = 'concluida' and completed_at >= now() - interval '30 days';

  -- IND-09: validade (mesma janela do B5.1).
  select count(*) into v_near_expiry
  from public.lots l
  join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
  join public.lot_balances lb on lb.lot_id = l.id
  where wa.market_id = p_market_id
    and l.status = 'available'
    and l.expires_at is not null
    and l.expires_at <= (current_date + coalesce(v_threshold_days, 7))
    and lb.balance > 0;

  -- IND-10: perdas no período (unidades — sem custo cadastrado, PA-48).
  select coalesce(sum(abs(sm.quantity)), 0) into v_losses
  from public.stock_movements sm
  join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
  where wa.market_id = p_market_id and sm.type = 'perda' and sm.created_at >= v_period_start;

  -- IND-11: inconsistências abertas (não depende do período).
  select count(*) into v_open_incidents
  from public.incidents
  where market_id = p_market_id and status <> 'encerrada';

  -- IND-12: acuracidade dos últimos inventários finalizados (90 dias).
  select case when coalesce(sum(ici.theoretical_balance), 0) = 0 then null
    else greatest(0, 100 * (1 - sum(abs(ici.difference)) / sum(ici.theoretical_balance)))
  end into v_accuracy
  from public.inventory_count_items ici
  join public.inventory_counts ic on ic.id = ici.inventory_count_id
  join public.warehouse_addresses wa on wa.id = ic.warehouse_address_id
  where wa.market_id = p_market_id and ic.status = 'finalizada' and ic.finalized_at >= now() - interval '90 days';

  -- IND-13/14/15: giro, produto sem giro e cobertura (sem custo — em unidades, PA-48).
  v_turnover := case when coalesce(v_current_balance, 0) = 0 then null else v_items_sold / v_current_balance end;
  v_coverage_days := case when v_items_sold <= 0 then null else v_current_balance / (v_items_sold / greatest(p_days, 1)) end;

  select count(distinct gp.product_id) into v_no_turnover_count
  from public.gondola_positions gp
  where gp.market_id = p_market_id and gp.product_id is not null
    and not exists (
      select 1 from public.sale_events se
      join public.sale_event_items sei on sei.sale_event_id = se.id
      where se.market_id = p_market_id and se.event_type = 'venda' and se.status = 'processado'
        and se.occurred_at >= v_period_start and sei.product_id = gp.product_id
    );

  return jsonb_build_object(
    'generatedAt', now(),
    'periodDays', p_days,
    'revenue', v_revenue,
    'salesCount', v_sales_count,
    'avgTicket', case when v_sales_count > 0 then v_revenue / v_sales_count else null end,
    'itemsSold', v_items_sold,
    'lowStockPositions', v_low_stock,
    'rupturaPositions', v_ruptura,
    'pendingReplenishments', v_pending_replenishment,
    'avgReplenishmentHours', v_avg_replenishment_hours,
    'nearExpiryLots', v_near_expiry,
    'losses', v_losses,
    'openIncidents', v_open_incidents,
    'accuracyPct', v_accuracy,
    'turnover', v_turnover,
    'noTurnoverProducts', v_no_turnover_count,
    'coverageDays', v_coverage_days
  );
end;
$$;
revoke all on function public.get_market_dashboard(uuid, integer) from public, anon;
grant execute on function public.get_market_dashboard(uuid, integer) to authenticated;

-- Indicadores consolidados da rede (RF-DSH-02, comparar mercados) — só o
-- dono vê (RN-DSH-01: soma só os mercados da empresa).
create function public.get_company_dashboard(p_company_id uuid, p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_markets jsonb;
begin
  if not private.has_company_role(p_company_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono vê os indicadores consolidados da rede';
  end if;

  select jsonb_agg(jsonb_build_object(
    'marketId', m.id,
    'marketName', m.name,
    'dashboard', public.get_market_dashboard(m.id, p_days)
  ) order by m.name)
  into v_markets
  from public.markets m
  -- Mesmo filtro de listMarkets (RF-ORG-02): só o mercado inativado some da
  -- lista — "active" não serve de filtro porque a cobrança (B9) ainda não
  -- existe, então nenhum mercado chega lá de verdade por enquanto.
  where m.company_id = p_company_id and m.status <> 'inactive';

  return jsonb_build_object(
    'generatedAt', now(),
    'periodDays', p_days,
    'markets', coalesce(v_markets, '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_company_dashboard(uuid, integer) from public, anon;
grant execute on function public.get_company_dashboard(uuid, integer) to authenticated;

-- RF-DSH-03: produtos mais vendidos / sem giro, para a listagem detalhada.
create function public.list_product_sales_ranking(
  p_market_id uuid,
  p_days integer default 30,
  p_limit integer default 5,
  p_direction text default 'top'
)
returns table (product_id uuid, product_name text, quantity_sold numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start timestamptz;
begin
  perform private.assert_market_manage_access(p_market_id);
  if p_direction not in ('top', 'bottom') then
    raise exception 'Direção inválida (use "top" ou "bottom")';
  end if;
  v_period_start := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);

  return query
    select gp.product_id, p.name,
      coalesce((
        select sum(case when se.event_type = 'venda' then sei.base_quantity else -sei.base_quantity end)
        from public.sale_events se
        join public.sale_event_items sei on sei.sale_event_id = se.id
        where se.market_id = p_market_id and se.status = 'processado'
          and se.occurred_at >= v_period_start and sei.product_id = gp.product_id
      ), 0) as quantity_sold
    from (select distinct gp2.product_id from public.gondola_positions gp2 where gp2.market_id = p_market_id and gp2.product_id is not null) gp
    join public.products p on p.id = gp.product_id
    order by
      case when p_direction = 'top' then quantity_sold end desc nulls last,
      case when p_direction = 'bottom' then quantity_sold end asc nulls last
    limit p_limit;
end;
$$;
revoke all on function public.list_product_sales_ranking(uuid, integer, integer, text) from public, anon;
grant execute on function public.list_product_sales_ranking(uuid, integer, integer, text) to authenticated;

-- RF-DSH-04: feed de operação (últimos eventos reais do mercado).
create function public.list_market_feed(p_market_id uuid, p_limit integer default 15)
returns table (
  kind text,
  title text,
  detail text,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_market_manage_access(p_market_id);

  return query
    select * from (
      select 'venda'::text, 'Venda registrada'::text,
        se.register_code || ' · ' || count(sei.id)::text || ' item(ns)', se.occurred_at
      from public.sale_events se
      join public.sale_event_items sei on sei.sale_event_id = se.id
      where se.market_id = p_market_id and se.event_type = 'venda' and se.status = 'processado'
      group by se.id, se.register_code, se.occurred_at
      union all
      select 'recebimento'::text, 'Recebimento finalizado'::text,
        coalesce(s.name, 'Sem fornecedor'), r.finalized_at
      from public.receivings r
      left join public.suppliers s on s.id = r.supplier_id
      where r.market_id = p_market_id and r.status = 'finalizado' and r.finalized_at is not null
      union all
      select 'reposicao'::text, 'Reposição concluída'::text,
        p.name, rt.completed_at
      from public.replenishment_tasks rt
      join public.products p on p.id = rt.product_id
      where rt.market_id = p_market_id and rt.status = 'concluida' and rt.completed_at is not null
      union all
      select 'inconsistencia'::text, 'Inconsistência aberta'::text,
        i.description, i.created_at
      from public.incidents i
      where i.market_id = p_market_id
    ) feed
    order by occurred_at desc nulls last
    limit p_limit;
end;
$$;
revoke all on function public.list_market_feed(uuid, integer) from public, anon;
grant execute on function public.list_market_feed(uuid, integer) to authenticated;
