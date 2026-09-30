-- B8.2 — Relatórios e exportação (RF-RPT-*/RN-RPT-*/REL-01..12/AUD-10).
--
-- Escopo decidido pelo agente, seguindo as sugestões do próprio documento
-- quando existiam (mesmo padrão de transparência das etapas anteriores):
--
-- PA-50/RF-RPT-02 (formatos): aceita a sugestão — tela + CSV no MVP. O CSV é
-- gerado no próprio navegador a partir dos dados já buscados (mesmo padrão
-- de `exportProductsCsv`, B2.4); nenhum arquivo fica armazenado no servidor.
--
-- RN-RPT-04 (retenção): relatório nunca é um artefato salvo — é sempre
-- calculado na hora a partir das tabelas de origem, que já seguem a regra
-- de "sem exclusão física" (RN-ACL-06) em todo o projeto. Não existe um
-- "relatório antigo" para reter ou expirar: a retenção é a mesma dos dados
-- de origem, que é indefinida.
--
-- RN-RPT-05 (fuso horário): mesmo padrão já usado em todo o painel desde o
-- B8.1 — horário formatado no fuso do navegador de quem está vendo, sem
-- mecanismo de fuso por mercado (nenhuma tela do projeto tem isso hoje).
--
-- REL-13 (assinaturas e cobrança) fica de fora: o Bloco B9 (cobrança) ainda
-- não existe, não há o que relatar. REL-14 (auditoria) é o B8.3, a próxima
-- etapa — não duplicado aqui.
--
-- Um único `get_report` (em vez de 11 funções) — mesma permissão de sempre
-- (`assert_market_manage_access`), um `case` por tipo de relatório, todos
-- devolvendo um jsonb (array de linhas) para a tela desenhar genericamente e
-- exportar em CSV. RF-RPT-06 (restringir por perfil/mercado) e RN-RPT-01
-- (mesmo isolamento das telas operacionais) vêm de graça: é a mesma checagem
-- de acesso usada em toda função do sistema.

create function public.get_report(
  p_market_id uuid,
  p_report text,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_date_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_date_to, now());
  v_result jsonb;
begin
  perform private.assert_market_manage_access(p_market_id);

  if p_report = 'estoque_atual' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.produto), '[]'::jsonb) into v_result
    from (
      select wa.code as endereco, p.name as produto, sb.balance as saldo
      from public.stock_balances sb
      join public.warehouse_addresses wa on wa.id = sb.warehouse_address_id
      join public.products p on p.id = sb.product_id
      where wa.market_id = p_market_id
        and (p_product_id is null or sb.product_id = p_product_id)
    ) t;

  elsif p_report = 'movimentacoes' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select sm.created_at as data, wa.code as endereco, p.name as produto,
        sm.type as tipo, sm.quantity as quantidade, sm.reference as referencia,
        coalesce(resp.full_name, '') as responsavel
      from public.stock_movements sm
      join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
      join public.products p on p.id = sm.product_id
      left join public.profiles resp on resp.id = sm.created_by
      where wa.market_id = p_market_id
        and sm.created_at between v_from and v_to
        and (p_product_id is null or sm.product_id = p_product_id)
    ) t;

  elsif p_report = 'recebimentos' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select r.created_at as data, r.finalized_at as finalizado_em, r.status as situacao,
        coalesce(s.name, 'Sem fornecedor') as fornecedor, coalesce(r.invoice_number, '') as nota_fiscal,
        coalesce(resp.full_name, '') as responsavel
      from public.receivings r
      left join public.suppliers s on s.id = r.supplier_id
      left join public.profiles resp on resp.id = r.created_by
      where r.market_id = p_market_id and r.created_at between v_from and v_to
    ) t;

  elsif p_report = 'divergencias_recebimento' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select i.created_at as data, coalesce(p.name, '') as produto,
        i.expected_quantity as esperado, i.counted_quantity as contado,
        i.difference as diferenca, i.severity as gravidade, i.status as situacao
      from public.incidents i
      left join public.products p on p.id = i.product_id
      where i.market_id = p_market_id and i.source = 'recebimento'
        and i.created_at between v_from and v_to
        and (p_product_id is null or i.product_id = p_product_id)
    ) t;

  elsif p_report = 'reposicoes' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select rt.created_at as data, rt.completed_at as concluida_em, rt.status as situacao,
        p.name as produto, gp.code as posicao, rt.quantity_needed as quantidade_necessaria,
        rt.is_ruptura as ruptura
      from public.replenishment_tasks rt
      join public.products p on p.id = rt.product_id
      join public.gondola_positions gp on gp.id = rt.gondola_position_id
      where rt.market_id = p_market_id and rt.created_at between v_from and v_to
        and (p_product_id is null or rt.product_id = p_product_id)
    ) t;

  elsif p_report = 'rupturas' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.produto), '[]'::jsonb) into v_result
    from (
      select gp.code as posicao, p.name as produto, gp.current_balance as saldo_atual, gp.min_quantity as minimo
      from public.gondola_positions gp
      join public.products p on p.id = gp.product_id
      where gp.market_id = p_market_id and gp.current_balance <= 0
        and (p_product_id is null or gp.product_id = p_product_id)
    ) t;

  elsif p_report = 'validade' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.vencimento), '[]'::jsonb) into v_result
    from (
      select p.name as produto, l.batch_number as lote, l.expires_at as vencimento,
        lb.balance as saldo, wa.code as endereco
      from public.lots l
      join public.lot_balances lb on lb.lot_id = l.id
      join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
      join public.products p on p.id = l.product_id
      where wa.market_id = p_market_id and l.status = 'available' and lb.balance > 0
        and (p_product_id is null or l.product_id = p_product_id)
    ) t;

  elsif p_report = 'perdas' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select sm.created_at as data, wa.code as endereco, p.name as produto,
        abs(sm.quantity) as quantidade, coalesce(sm.reference, '') as motivo
      from public.stock_movements sm
      join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
      join public.products p on p.id = sm.product_id
      where wa.market_id = p_market_id and sm.type = 'perda'
        and sm.created_at between v_from and v_to
        and (p_product_id is null or sm.product_id = p_product_id)
    ) t;

  elsif p_report = 'vendas' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select se.occurred_at as data, se.event_type as tipo, se.register_code as caixa,
        coalesce(p.name, sei.external_product_code) as produto,
        sei.base_quantity as quantidade, sei.unit_price as preco_unitario, se.status as situacao
      from public.sale_events se
      join public.sale_event_items sei on sei.sale_event_id = se.id
      left join public.products p on p.id = sei.product_id
      where se.market_id = p_market_id and se.occurred_at between v_from and v_to
        and (p_product_id is null or sei.product_id = p_product_id)
    ) t;

  elsif p_report = 'sem_giro' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.produto), '[]'::jsonb) into v_result
    from (
      select r.product_name as produto, r.quantity_sold as quantidade_vendida
      from public.list_product_sales_ranking(p_market_id, (extract(day from (v_to - v_from)))::integer, 1000, 'bottom') r
    ) t;

  elsif p_report = 'inconsistencias' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select i.created_at as data, i.source as origem, coalesce(p.name, '') as produto,
        i.severity as gravidade, i.status as situacao, i.description as descricao
      from public.incidents i
      left join public.products p on p.id = i.product_id
      where i.market_id = p_market_id and i.created_at between v_from and v_to
        and (p_product_id is null or i.product_id = p_product_id)
    ) t;

  elsif p_report = 'transferencias' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.data desc), '[]'::jsonb) into v_result
    from (
      select min(sm.created_at) as data, p.name as produto,
        max(case when sm.quantity < 0 then wa.code end) as origem,
        max(case when sm.quantity > 0 then wa.code end) as destino,
        max(abs(sm.quantity)) as quantidade
      from public.stock_movements sm
      join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
      join public.products p on p.id = sm.product_id
      where wa.market_id = p_market_id and sm.type = 'transferencia'
        and sm.created_at between v_from and v_to
        and (p_product_id is null or sm.product_id = p_product_id)
      group by sm.transfer_id, p.name
    ) t;

  else
    raise exception 'Relatório desconhecido: %', p_report;
  end if;

  return v_result;
end;
$$;
revoke all on function public.get_report(uuid, text, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_report(uuid, text, timestamptz, timestamptz, uuid) to authenticated;
