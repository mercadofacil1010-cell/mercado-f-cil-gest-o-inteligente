-- B6.2 — Motor de alertas e notificações (RF-EST-06/RF-INC-06/RN-DSH-05).
--
-- Escopo decidido em DECISOES.md: em vez de reinventar detecção de
-- divergência ou de gôndola no mínimo (já cobertas pela Central de
-- Inconsistências do B6.1 e pela tarefa automática do B5.1), este feed
-- reúne num só lugar os sinais que hoje ficam espalhados e sem lifecycle
-- próprio: inconsistência aberta (referência ao B6.1), saldo negativo em
-- algum endereço, e posição de gôndola no mínimo SEM tarefa ativa (o caso
-- que o B5.1 não cobre — ele só cria a tarefa quando alguém registra um
-- novo saldo; se ninguém registrar de novo, a posição pode ficar baixa sem
-- nenhum aviso). Ponto de pedido do depósito com sugestão de compra fica de
-- fora — sem histórico de vendas (B7) não dá para calcular consumo de
-- verdade.
--
-- Canais (PA-37): só sistema (dentro do app) por enquanto — nenhuma
-- integração de e-mail/push/WhatsApp existe no projeto. Quem recebe
-- (PA-38): dono e gerente com acesso ao mercado, sem preferências ainda —
-- todo alerta é crítico. Perfil "comprador" (G-10) fica de fora.
--
-- RN-DSH-05: um alerta nunca desaparece só porque o painel foi aberto —
-- só uma sincronização explícita resolve automaticamente (quando a
-- condição realmente deixou de existir) ou um descarte manual do
-- dono/gerente.

create type public.alert_type as enum ('incidente_aberto', 'saldo_negativo', 'gondola_no_minimo');
create type public.alert_status as enum ('aberto', 'resolvido', 'descartado');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  alert_type public.alert_type not null,
  product_id uuid references public.products (id),
  warehouse_address_id uuid references public.warehouse_addresses (id),
  gondola_position_id uuid references public.gondola_positions (id),
  reference_incident_id uuid references public.incidents (id),
  description text not null check (char_length(btrim(description)) > 0),
  status public.alert_status not null default 'aberto',
  resolved_at timestamptz,
  discarded_at timestamptz,
  discarded_by uuid references auth.users (id),
  discard_note text,
  created_at timestamptz not null default now()
);
comment on table public.alerts is 'Feed de alertas do dono/gerente (B6.2) — reúne inconsistência aberta, saldo negativo e gôndola no mínimo sem tarefa ativa. Nunca desaparece sozinho (RN-DSH-05): só sync_alerts resolve automaticamente ou discard_alert descarta.';

create index alerts_market_status_idx on public.alerts (market_id, status);

alter table public.alerts enable row level security;

create policy "alerts_select" on public.alerts for select to authenticated
  using (
    private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

revoke insert, update, delete on public.alerts from authenticated, anon;

create function private.assert_market_manage_access(p_market_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.markets where id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para gerenciar este mercado';
  end if;
end;
$$;

-- Reconcilia o feed: resolve sozinho o que não é mais verdade, cria o que
-- é novo. Nunca chamado implicitamente ao listar — só quando o dono/gerente
-- pede para sincronizar (RN-DSH-05: abrir o painel não resolve nada).
create function public.sync_alerts(p_market_id uuid)
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

  return v_created;
end;
$$;
revoke all on function public.sync_alerts(uuid) from public, anon;
grant execute on function public.sync_alerts(uuid) to authenticated;

create function public.list_alerts(p_market_id uuid)
returns table (
  id uuid,
  alert_type public.alert_type,
  product_id uuid,
  product_name text,
  warehouse_address_code text,
  gondola_position_code text,
  reference_incident_id uuid,
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
      a.reference_incident_id, a.description, a.status, a.discard_note, a.created_at
    from public.alerts a
    left join public.products p on p.id = a.product_id
    left join public.warehouse_addresses wa on wa.id = a.warehouse_address_id
    left join public.gondola_positions gp on gp.id = a.gondola_position_id
    where a.market_id = p_market_id
    order by a.status <> 'aberto' asc, a.created_at desc;
end;
$$;
revoke all on function public.list_alerts(uuid) from public, anon;
grant execute on function public.list_alerts(uuid) to authenticated;

-- Descarte manual (RN-DSH-05) — dono/gerente autorizado, só a partir de
-- 'aberto'. Nota é opcional (diferente de encerrar inconsistência, que
-- exige justificativa por RF-INC-08 — aqui não há esse requisito).
create function public.discard_alert(p_id uuid, p_note text default null)
returns public.alerts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_alert public.alerts;
  v_row public.alerts;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para descartar um alerta';
  end if;

  select * into v_alert from public.alerts where id = p_id;
  if v_alert.id is null then
    raise exception 'Alerta não encontrado';
  end if;
  perform private.assert_market_manage_access(v_alert.market_id);
  if v_alert.status <> 'aberto' then
    raise exception 'Este alerta já foi % — não pode ser descartado de novo', v_alert.status;
  end if;

  update public.alerts
  set status = 'descartado', discarded_at = now(), discarded_by = v_user, discard_note = p_note
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.discard_alert(uuid, text) from public, anon;
grant execute on function public.discard_alert(uuid, text) to authenticated;

-- Auditoria genérica (B0.2) — corpo idêntico ao já publicado (B6.1), só
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger alerts_audit
  after insert or update on public.alerts
  for each row execute function private.audit_trigger();
