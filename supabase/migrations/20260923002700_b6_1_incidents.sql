-- B6.1 — Central de inconsistências (RF-INC-*, RN-INC-*).
--
-- Escopo decidido em DECISOES.md: ocorrência nasce automaticamente a partir
-- de 4 origens que já existem e já detectam divergência hoje — recebimento
-- com divergência (B4.3), reposição com inconsistência (B5.3), inventário
-- com diferença (B3.6) e lote vencido ainda com saldo (B3.3). Venda fica de
-- fora (não existe até o B7); transferência fica de fora (é instantânea,
-- não gera divergência hoje).
--
-- Gravidade (RN-INC-03) = tamanho percentual da diferença + recorrência (o
-- catálogo ainda não tem preço/custo, B3.4, então não dá para usar valor
-- monetário). Recorrência (RN-INC-04) só sinaliza (`is_recurring`), nunca
-- esconde a ocorrência individual. Encerrar (RN-INC-01/02/05, RF-INC-08)
-- é só dono/gerente com acesso ao mercado, sempre com justificativa, e
-- NUNCA lança movimento de estoque sozinho — só vincula uma correção que
-- já foi feita em outro lugar (`correction_movement_id`, quando existir).

create type public.incident_source as enum ('recebimento', 'reposicao', 'inventario', 'validade');
create type public.incident_status as enum ('aberta', 'reconhecida', 'em_investigacao', 'encerrada');
create type public.incident_resolution as enum ('corrigida', 'descartada');
create type public.incident_severity as enum ('baixa', 'media', 'alta');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  source public.incident_source not null,
  severity public.incident_severity not null,
  is_recurring boolean not null default false,
  product_id uuid references public.products (id),
  warehouse_address_id uuid references public.warehouse_addresses (id),
  reference_receiving_id uuid references public.receivings (id),
  reference_task_id uuid references public.replenishment_tasks (id),
  reference_inventory_count_id uuid references public.inventory_counts (id),
  reference_lot_id uuid references public.lots (id),
  expected_quantity numeric(12, 3),
  counted_quantity numeric(12, 3),
  difference numeric(12, 3),
  description text not null check (char_length(btrim(description)) > 0),
  status public.incident_status not null default 'aberta',
  assigned_to uuid references auth.users (id),
  due_date date,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users (id),
  investigation_started_at timestamptz,
  resolution public.incident_resolution,
  resolution_note text,
  correction_movement_id uuid references public.stock_movements (id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  reopened_count integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.incidents is 'Central de inconsistências (B6.1) — ocorrências automáticas de recebimento, reposição, inventário e validade. Nunca apagada (RN-INC-01): só reconhecida, investigada, encerrada (corrigida/descartada, sempre com justificativa) ou reaberta.';

create index incidents_market_status_idx on public.incidents (market_id, status);

alter table public.incidents enable row level security;

create policy "incidents_select" on public.incidents for select to authenticated
  using (
    private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

revoke insert, update, delete on public.incidents from authenticated, anon;

-- Gravidade: % de diferença sobre o esperado + recorrência (RN-INC-03/04).
create function private.calc_incident_severity(p_expected numeric, p_counted numeric, p_is_recurring boolean)
returns public.incident_severity
language plpgsql
stable
set search_path = ''
as $$
declare
  v_pct numeric;
  v_base public.incident_severity;
begin
  if p_expected is null or p_expected = 0 then
    v_pct := case when coalesce(p_counted, 0) = 0 then 0 else 100 end;
  else
    v_pct := abs(coalesce(p_counted, 0) - p_expected) / abs(p_expected) * 100;
  end if;

  v_base := case when v_pct > 50 then 'alta' when v_pct > 10 then 'media' else 'baixa' end;

  if not p_is_recurring then
    return v_base;
  end if;

  return case v_base
    when 'baixa' then 'media'
    else 'alta'
  end;
end;
$$;

-- Cria a ocorrência (chamado internamente pelas funções que detectam a
-- divergência — nunca exposto direto ao cliente, por isso sem checagem de
-- permissão própria: quem chama já validou o acesso ao mercado).
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
  p_correction_movement_id uuid default null
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
    expected_quantity, counted_quantity, difference, description, correction_movement_id
  ) values (
    p_market_id, p_source, v_severity, v_is_recurring, p_product_id, p_warehouse_address_id,
    p_reference_receiving_id, p_reference_task_id, p_reference_inventory_count_id, p_reference_lot_id,
    p_expected, p_counted, coalesce(p_counted, 0) - coalesce(p_expected, 0), p_description, p_correction_movement_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Origem 1: recebimento com divergência (B4.3/B4.4) — mesmo corpo já
-- publicado, só acrescentando a criação da ocorrência por produto
-- divergente no momento em que ela é confirmada (precisa de justificativa
-- para chegar aqui, já é divergência real, não uma tentativa). Mesma
-- assinatura de sempre — `create or replace`, sem precisar de DROP.
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

    -- B6.1: registra a ocorrência assim que a divergência é confirmada, não
    -- só quando o dono finalmente decidir — é aí que ela precisa de atenção.
    if not exists (select 1 from public.incidents where reference_receiving_id = p_receiving_id) then
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
        select
          coalesce(e.product_id, c.product_id) as product_id,
          coalesce(e.expected_quantity, 0) as expected_quantity,
          coalesce(c.total, 0) as counted_quantity
        from expected e
        full outer join counted c on c.product_id = e.product_id
        where coalesce(c.total, 0) - coalesce(e.expected_quantity, 0) <> 0
      loop
        perform private.create_incident(
          v_market_id, 'recebimento',
          'Divergência no recebimento — esperado e contado não bateram.',
          v_row.product_id, null, p_receiving_id, null, null, null,
          v_row.expected_quantity, v_row.counted_quantity
        );
      end loop;
    end if;

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

  -- B6.1: se a divergência ficou dentro do limite (gerente decidiu direto,
  -- sem precisar do dono), a ocorrência ainda nasce aqui, só que já como
  -- decisão já tomada — fica para acompanhamento/histórico, não para agir.
  if v_has_divergence and not exists (select 1 from public.incidents where reference_receiving_id = p_receiving_id) then
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
      select
        coalesce(e.product_id, c.product_id) as product_id,
        coalesce(e.expected_quantity, 0) as expected_quantity,
        coalesce(c.total, 0) as counted_quantity
      from expected e
      full outer join counted c on c.product_id = e.product_id
      where coalesce(c.total, 0) - coalesce(e.expected_quantity, 0) <> 0
    loop
      perform private.create_incident(
        v_market_id, 'recebimento',
        'Divergência no recebimento — esperado e contado não bateram.',
        v_row.product_id, null, p_receiving_id, null, null, null,
        v_row.expected_quantity, v_row.counted_quantity
      );
    end loop;
  end if;

  return jsonb_build_object('status', 'finalizado', 'movements_posted', v_posted, 'had_divergence', v_has_divergence);
end;
$$;

-- Origem 2: reposição com inconsistência (B5.3) — trigger, não precisa
-- tocar em submit_replenishment_count (já testado e estável).
create function private.create_replenishment_incident()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected numeric;
  v_counted numeric;
begin
  if new.status = 'com_inconsistencia' and old.status is distinct from new.status then
    v_expected := coalesce(new.balance_before, 0) + coalesce(new.quantity_withdrawn, 0) - coalesce(new.quantity_returned, 0);

    select counted_quantity into v_counted
    from public.replenishment_task_counts
    where task_id = new.id
    order by attempt desc
    limit 1;

    perform private.create_incident(
      new.market_id, 'reposicao',
      'Contagem cega da gôndola não bateu com o esperado após 3 tentativas.',
      new.product_id, null, null, new.id, null, null,
      v_expected, v_counted
    );
  end if;
  return new;
end;
$$;

create trigger replenishment_tasks_incident
  after update on public.replenishment_tasks
  for each row execute function private.create_replenishment_incident();

-- Origem 3: inventário com diferença (B3.6) — mesmo padrão do recebimento,
-- ocorrência criada no mesmo loop que já calcula a diferença por item.
-- Mesma assinatura de sempre — `create or replace`, sem precisar de DROP.
create or replace function public.finalize_inventory_count(p_inventory_count_id uuid)
returns setof public.inventory_count_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count public.inventory_counts;
  v_company_id uuid;
  v_market_id uuid;
  v_item record;
  v_theoretical numeric;
  v_difference numeric;
  v_tracks_lot boolean;
  v_lot_id uuid;
  v_result jsonb;
  v_status text;
  v_reason text;
  v_correction_movement_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para finalizar uma contagem';
  end if;

  select * into v_count from public.inventory_counts where id = p_inventory_count_id;
  if v_count.id is null then
    raise exception 'Contagem não encontrada';
  end if;
  if v_count.status <> 'aberta' then
    raise exception 'Esta contagem já foi finalizada';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = v_count.warehouse_address_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para finalizar contagem neste mercado';
  end if;

  if not exists (select 1 from public.inventory_count_items where inventory_count_id = p_inventory_count_id) then
    raise exception 'Esta contagem não tem nenhum item contado';
  end if;

  for v_item in
    select * from public.inventory_count_items where inventory_count_id = p_inventory_count_id
  loop
    select coalesce(sum(quantity), 0) into v_theoretical
    from public.stock_movements
    where warehouse_address_id = v_count.warehouse_address_id and product_id = v_item.product_id;

    v_difference := v_item.counted_quantity - v_theoretical;
    v_correction_movement_id := null;

    if v_difference = 0 then
      v_status := 'none';
    else
      select p.tracks_batch_expiry into v_tracks_lot from public.products p where p.id = v_item.product_id;
      v_lot_id := null;

      if v_tracks_lot then
        select l.id into v_lot_id
        from public.lots l
        where l.warehouse_address_id = v_count.warehouse_address_id
          and l.product_id = v_item.product_id
          and l.status = 'available'
          and coalesce((select sum(sm.quantity) from public.stock_movements sm where sm.lot_id = l.id), 0) > 0
        order by l.expires_at asc nulls last, l.created_at asc
        limit 1;

        if v_lot_id is null then
          raise exception 'Produto % controla lote e não há nenhum lote disponível com saldo neste endereço para lançar o ajuste — corrija esse item direto em Movimentos.', v_item.product_id;
        end if;
      end if;

      v_reason := 'Ajuste automático da contagem de inventário ' || p_inventory_count_id;
      v_result := public.register_stock_movement(
        v_count.warehouse_address_id, v_item.product_id, 'ajuste', v_difference,
        'Contagem de inventário ' || p_inventory_count_id, v_reason, v_lot_id
      );
      v_status := coalesce(v_result ->> 'status', 'posted');
      if v_status = 'posted' then
        v_correction_movement_id := (v_result -> 'movement' ->> 'id')::uuid;
      end if;

      -- B6.1: toda diferença de inventário vira ocorrência — o ajuste já
      -- foi feito (ou está na fila de aprovação), a ocorrência é o registro
      -- para acompanhamento/investigação, nunca um segundo movimento.
      perform private.create_incident(
        v_market_id, 'inventario',
        'Contagem de inventário divergiu do saldo teórico.',
        v_item.product_id, v_count.warehouse_address_id, null, null, p_inventory_count_id, null,
        v_theoretical, v_item.counted_quantity, v_correction_movement_id
      );
    end if;

    update public.inventory_count_items
    set theoretical_balance = v_theoretical, difference = v_difference, resulting_movement_status = v_status
    where id = v_item.id;
  end loop;

  update public.inventory_counts
  set status = 'finalizada', finalized_by = v_user, finalized_at = now()
  where id = p_inventory_count_id;

  return query select * from public.inventory_count_items where inventory_count_id = p_inventory_count_id;
end;
$$;
revoke all on function public.finalize_inventory_count(uuid) from public, anon;
grant execute on function public.finalize_inventory_count(uuid) to authenticated;

-- Origem 4: lote vencido ainda com saldo (B3.3) — não existe um evento
-- discreto (é uma condição contínua), então é sincronizado sob demanda:
-- chamado quando dono/gerente abre a Central de Inconsistências do mercado.
create function public.sync_expiry_incidents(p_market_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_lot record;
  v_balance numeric;
  v_created integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para sincronizar validade';
  end if;

  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para sincronizar validade neste mercado';
  end if;

  for v_lot in
    select l.* from public.lots l
    join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
    where wa.market_id = p_market_id
      and l.status = 'available'
      and l.expires_at is not null
      and l.expires_at < current_date
      and not exists (
        select 1 from public.incidents i
        where i.reference_lot_id = l.id and i.status <> 'encerrada'
      )
  loop
    select coalesce(sum(sm.quantity), 0) into v_balance
    from public.stock_movements sm where sm.lot_id = v_lot.id;

    if v_balance > 0 then
      perform private.create_incident(
        p_market_id, 'validade',
        'Lote vencido em ' || v_lot.expires_at || ' ainda com saldo no endereço.',
        v_lot.product_id, v_lot.warehouse_address_id, null, null, null, v_lot.id,
        null, v_balance
      );
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;
revoke all on function public.sync_expiry_incidents(uuid) from public, anon;
grant execute on function public.sync_expiry_incidents(uuid) to authenticated;

-- Consulta e ciclo de vida (RF-INC-02/03/04/05, RN-INC-01/02/05).
create function public.list_incidents(p_market_id uuid)
returns table (
  id uuid,
  source public.incident_source,
  severity public.incident_severity,
  is_recurring boolean,
  product_id uuid,
  product_name text,
  warehouse_address_code text,
  expected_quantity numeric,
  counted_quantity numeric,
  difference numeric,
  description text,
  status public.incident_status,
  assigned_to uuid,
  due_date date,
  resolution public.incident_resolution,
  resolution_note text,
  reopened_count integer,
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
    raise exception 'É preciso estar autenticado para ver as inconsistências';
  end if;

  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para ver inconsistências deste mercado';
  end if;

  return query
    select
      i.id, i.source, i.severity, i.is_recurring, i.product_id, p.name,
      wa.code, i.expected_quantity, i.counted_quantity, i.difference, i.description,
      i.status, i.assigned_to, i.due_date, i.resolution, i.resolution_note, i.reopened_count, i.created_at
    from public.incidents i
    left join public.products p on p.id = i.product_id
    left join public.warehouse_addresses wa on wa.id = i.warehouse_address_id
    where i.market_id = p_market_id
    order by i.status <> 'encerrada' desc, i.severity desc, i.created_at desc;
end;
$$;
revoke all on function public.list_incidents(uuid) from public, anon;
grant execute on function public.list_incidents(uuid) to authenticated;

create function private.assert_incident_access(p_incident public.incidents)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.markets where id = p_incident.market_id;
  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_incident.market_id))
  ) then
    raise exception 'Sem permissão para gerenciar inconsistências deste mercado';
  end if;
end;
$$;

create function public.acknowledge_incident(p_id uuid)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_incident public.incidents;
  v_row public.incidents;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para reconhecer uma inconsistência';
  end if;

  select * into v_incident from public.incidents where id = p_id;
  if v_incident.id is null then
    raise exception 'Inconsistência não encontrada';
  end if;
  perform private.assert_incident_access(v_incident);
  if v_incident.status <> 'aberta' then
    raise exception 'Esta inconsistência já foi reconhecida';
  end if;

  update public.incidents
  set status = 'reconhecida', acknowledged_at = now(), acknowledged_by = v_user
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.acknowledge_incident(uuid) from public, anon;
grant execute on function public.acknowledge_incident(uuid) to authenticated;

create function public.start_incident_investigation(p_id uuid)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident public.incidents;
  v_row public.incidents;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para investigar uma inconsistência';
  end if;

  select * into v_incident from public.incidents where id = p_id;
  if v_incident.id is null then
    raise exception 'Inconsistência não encontrada';
  end if;
  perform private.assert_incident_access(v_incident);
  if v_incident.status not in ('aberta', 'reconhecida') then
    raise exception 'Esta inconsistência não pode entrar em investigação (status atual: %)', v_incident.status;
  end if;

  update public.incidents
  set status = 'em_investigacao', investigation_started_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.start_incident_investigation(uuid) from public, anon;
grant execute on function public.start_incident_investigation(uuid) to authenticated;

create function public.assign_incident(p_id uuid, p_assignee_user_id uuid, p_due_date date default null)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident public.incidents;
  v_company_id uuid;
  v_row public.incidents;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para atribuir uma inconsistência';
  end if;

  select * into v_incident from public.incidents where id = p_id;
  if v_incident.id is null then
    raise exception 'Inconsistência não encontrada';
  end if;
  perform private.assert_incident_access(v_incident);
  if v_incident.status = 'encerrada' then
    raise exception 'Esta inconsistência já foi encerrada';
  end if;

  select company_id into v_company_id from public.markets where id = v_incident.market_id;

  if not exists (
    select 1 from public.company_members cm
    where cm.user_id = p_assignee_user_id and cm.company_id = v_company_id and cm.status = 'active'
  ) then
    raise exception 'Responsável não encontrado ou sem vínculo ativo nesta empresa';
  end if;

  update public.incidents
  set assigned_to = p_assignee_user_id, due_date = p_due_date
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.assign_incident(uuid, uuid, date) from public, anon;
grant execute on function public.assign_incident(uuid, uuid, date) to authenticated;

create function public.resolve_incident(
  p_id uuid,
  p_resolution public.incident_resolution,
  p_note text,
  p_correction_movement_id uuid default null
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_incident public.incidents;
  v_row public.incidents;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para encerrar uma inconsistência';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Informe a justificativa para encerrar';
  end if;

  select * into v_incident from public.incidents where id = p_id;
  if v_incident.id is null then
    raise exception 'Inconsistência não encontrada';
  end if;
  perform private.assert_incident_access(v_incident);
  if v_incident.status = 'encerrada' then
    raise exception 'Esta inconsistência já foi encerrada';
  end if;

  -- RN-INC-02: encerrar não lança movimento — só vincula uma correção que
  -- já existe (ex.: o ajuste feito à parte em Movimentos).
  if p_correction_movement_id is not null and not exists (
    select 1 from public.stock_movements sm
    join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
    where sm.id = p_correction_movement_id and wa.market_id = v_incident.market_id
  ) then
    raise exception 'Movimento de correção não encontrado neste mercado';
  end if;

  update public.incidents
  set status = 'encerrada', resolution = p_resolution, resolution_note = p_note,
      correction_movement_id = coalesce(p_correction_movement_id, correction_movement_id),
      resolved_at = now(), resolved_by = v_user
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.resolve_incident(uuid, public.incident_resolution, text, uuid) from public, anon;
grant execute on function public.resolve_incident(uuid, public.incident_resolution, text, uuid) to authenticated;

create function public.reopen_incident(p_id uuid, p_note text)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident public.incidents;
  v_row public.incidents;
begin
  if (select auth.uid()) is null then
    raise exception 'É preciso estar autenticado para reabrir uma inconsistência';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Informe o motivo da reabertura';
  end if;

  select * into v_incident from public.incidents where id = p_id;
  if v_incident.id is null then
    raise exception 'Inconsistência não encontrada';
  end if;
  perform private.assert_incident_access(v_incident);
  if v_incident.status <> 'encerrada' then
    raise exception 'Só uma inconsistência encerrada pode ser reaberta';
  end if;

  update public.incidents
  set status = 'aberta', resolution = null, resolution_note = p_note,
      resolved_at = null, resolved_by = null, correction_movement_id = null,
      acknowledged_at = null, acknowledged_by = null, investigation_started_at = null,
      reopened_count = reopened_count + 1
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reopen_incident(uuid, text) from public, anon;
grant execute on function public.reopen_incident(uuid, text) to authenticated;

-- Auditoria genérica (B0.2) — corpo idêntico ao já publicado (B5.5), só com
-- mais um `elsif` para a tabela nova.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger incidents_audit
  after insert or update on public.incidents
  for each row execute function private.audit_trigger();
