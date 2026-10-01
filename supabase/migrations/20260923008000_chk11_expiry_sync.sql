-- CHK-11 (B10.5) — continuação: usa o novo valor 'lote_vencendo' do enum
-- (tem que ser em arquivo separado do que criou o valor — Postgres não
-- permite usar um valor de enum recém-criado na mesma transação).

create or replace function public.sync_alerts(p_market_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_created integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para sincronizar alertas';
  end if;
  perform private.assert_market_manage_access(p_market_id);

  -- Resolve alertas cuja condição já não existe mais.
  update public.alerts a
  set status = 'resolvido', resolved_at = now()
  where a.market_id = p_market_id
    and a.status = 'aberto'
    and (
      (a.alert_type = 'incidente_aberto' and not exists (
        select 1 from public.incidents i where i.id = a.reference_incident_id and i.status <> 'encerrada'
      ))
      or (a.alert_type = 'saldo_negativo' and not exists (
        select 1 from public.stock_balances sb
        where sb.warehouse_address_id = a.warehouse_address_id and sb.product_id = a.product_id and sb.balance < 0
      ))
      or (a.alert_type = 'gondola_no_minimo' and not exists (
        select 1 from public.gondola_positions gp
        where gp.id = a.gondola_position_id
          and gp.product_id is not null
          and gp.current_balance <= gp.min_quantity
          and not exists (
            select 1 from public.replenishment_tasks rt
            where rt.gondola_position_id = gp.id and rt.status in ('pendente', 'aceita', 'em_transito')
          )
      ))
      or (a.alert_type = 'lote_vencendo' and not exists (
        select 1 from public.expiring_lots el
        where el.lot_id = a.lot_id and el.balance > 0 and el.days_until_expiry <= 90
      ))
    );

  -- Cria alertas novos para condições que ainda não têm um alerta aberto.
  for v_row in
    select i.id as incident_id
    from public.incidents i
    where i.market_id = p_market_id
      and i.status <> 'encerrada'
      and not exists (
        select 1 from public.alerts a
        where a.reference_incident_id = i.id and a.alert_type = 'incidente_aberto' and a.status = 'aberto'
      )
  loop
    insert into public.alerts (market_id, alert_type, reference_incident_id, description)
    values (p_market_id, 'incidente_aberto', v_row.incident_id, 'Inconsistência aberta aguardando resolução na Central de Inconsistências.');
    v_created := v_created + 1;
  end loop;

  for v_row in
    select sb.warehouse_address_id, sb.product_id
    from public.stock_balances sb
    join public.warehouse_addresses wa on wa.id = sb.warehouse_address_id
    where wa.market_id = p_market_id
      and sb.balance < 0
      and not exists (
        select 1 from public.alerts a
        where a.warehouse_address_id = sb.warehouse_address_id
          and a.product_id = sb.product_id
          and a.alert_type = 'saldo_negativo'
          and a.status = 'aberto'
      )
  loop
    insert into public.alerts (market_id, alert_type, warehouse_address_id, product_id, description)
    values (p_market_id, 'saldo_negativo', v_row.warehouse_address_id, v_row.product_id, 'Saldo negativo neste endereço — corrija com um ajuste em Movimentos.');
    v_created := v_created + 1;
  end loop;

  for v_row in
    select gp.id as gondola_position_id
    from public.gondola_positions gp
    where gp.market_id = p_market_id
      and gp.product_id is not null
      and gp.current_balance <= gp.min_quantity
      and not exists (
        select 1 from public.replenishment_tasks rt
        where rt.gondola_position_id = gp.id and rt.status in ('pendente', 'aceita', 'em_transito')
      )
      and not exists (
        select 1 from public.alerts a
        where a.gondola_position_id = gp.id and a.alert_type = 'gondola_no_minimo' and a.status = 'aberto'
      )
  loop
    insert into public.alerts (market_id, alert_type, gondola_position_id, description)
    values (p_market_id, 'gondola_no_minimo', v_row.gondola_position_id, 'Posição de gôndola no mínimo (ou abaixo) sem nenhuma tarefa de reposição ativa.');
    v_created := v_created + 1;
  end loop;

  for v_row in
    select el.lot_id, el.warehouse_address_id, el.product_id, el.days_until_expiry
    from public.expiring_lots el
    where el.market_id = p_market_id
      and el.balance > 0
      and el.days_until_expiry <= 90
      and not exists (
        select 1 from public.alerts a
        where a.lot_id = el.lot_id and a.alert_type = 'lote_vencendo' and a.status = 'aberto'
      )
  loop
    insert into public.alerts (market_id, alert_type, lot_id, warehouse_address_id, product_id, description)
    values (
      p_market_id, 'lote_vencendo', v_row.lot_id, v_row.warehouse_address_id, v_row.product_id,
      case
        when v_row.days_until_expiry < 0 then 'Lote vencido com saldo — registre uma perda para descartá-lo.'
        when v_row.days_until_expiry = 0 then 'Lote vence hoje.'
        else 'Lote vence em ' || v_row.days_until_expiry || ' dia(s).'
      end
    );
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

drop function public.list_alerts(uuid);

create function public.list_alerts(p_market_id uuid)
returns table (
  id uuid,
  alert_type public.alert_type,
  product_id uuid,
  product_name text,
  warehouse_address_code text,
  gondola_position_code text,
  reference_incident_id uuid,
  lot_id uuid,
  lot_batch_number text,
  lot_expires_at date,
  description text,
  status public.alert_status,
  discard_note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para ver os alertas';
  end if;
  perform private.assert_market_manage_access(p_market_id);

  return query
    select
      a.id, a.alert_type, a.product_id, p.name, wa.code, gp.code,
      a.reference_incident_id, a.lot_id, l.batch_number, l.expires_at,
      a.description, a.status, a.discard_note, a.created_at
    from public.alerts a
    left join public.products p on p.id = a.product_id
    left join public.warehouse_addresses wa on wa.id = a.warehouse_address_id
    left join public.gondola_positions gp on gp.id = a.gondola_position_id
    left join public.lots l on l.id = a.lot_id
    where a.market_id = p_market_id
    order by a.status <> 'aberto' asc, a.created_at desc;
end;
$$;
revoke all on function public.list_alerts(uuid) from public, anon;
grant execute on function public.list_alerts(uuid) to authenticated;
