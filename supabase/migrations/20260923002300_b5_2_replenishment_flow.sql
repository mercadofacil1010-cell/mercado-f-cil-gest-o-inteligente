-- B5.2 — Fluxo do repositor gravado no banco (RF-REP-02/03/04/06/08/10,
-- RN-REP-07/08, RN-CRT-REP-03, PA-12, G-09, AUD-06).
--
-- Decidido em DECISOES.md: o repositor aceita a tarefa direto da fila do
-- mercado, e o gerente/dono também pode atribuir uma tarefa específica a um
-- repositor (PA-12). Na retirada, o repositor registra a quantidade real que
-- tirou do depósito — pode ser diferente da sugerida (DEC-B5-03). Quando a
-- reposição + a sobra devolvida não fecham com o que foi retirado, a tarefa
-- sempre vira "com_inconsistencia" e espera decisão do gerente/dono — nunca
-- um limite automático como o do B3.4 (DEC-B5-04): aqui o volume de tarefas
-- é maior e a quantidade normalmente pequena, então não vale a pena montar
-- uma fila de aprovação por limite. Evidência de impedimento/observação é só
-- texto por enquanto (DEC-B5-05, mesma decisão adiada desde o B3.4). Um
-- impedimento (ex.: gôndola quebrada) devolve a tarefa para "pendente" com o
-- motivo registrado, sem exigir decisão do gerente (DEC-B5-06) — se já tinha
-- retirada feita, o estoque retirado volta para o depósito de origem.
--
-- G-09 (local "em trânsito"): não existe um endereço físico novo para isso —
-- o status da tarefa ('em_transito') é o próprio local, entre a retirada
-- (RN-REP-07: reduz o depósito) e a reposição (aumenta a gôndola) ou a
-- devolução da sobra (volta para o endereço escolhido).
--
-- RF-REP-02/03: a experiência do repositor ganha rota própria (/repositor),
-- mesma decisão de arquitetura do /conferente (Correção 1, DEC-B4-01) — não
-- é uma aba do painel do dono.

alter type public.replenishment_task_status add value 'aceita';
alter type public.replenishment_task_status add value 'em_transito';
alter type public.replenishment_task_status add value 'com_inconsistencia';
alter type public.replenishment_task_status add value 'concluida';

alter table public.replenishment_tasks
  add column accepted_at timestamptz,
  add column accepted_by uuid references auth.users (id),
  add column source_warehouse_address_id uuid references public.warehouse_addresses (id),
  add column withdrawal_lot_id uuid references public.lots (id),
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references auth.users (id),
  add column quantity_withdrawn numeric(12, 3),
  add column return_warehouse_address_id uuid references public.warehouse_addresses (id),
  add column quantity_placed numeric(12, 3),
  add column quantity_returned numeric(12, 3),
  add column completed_at timestamptz,
  add column completed_by uuid references auth.users (id),
  add column last_impediment_reason text,
  add column last_impediment_at timestamptz,
  add column resolved_at timestamptz,
  add column resolved_by uuid references auth.users (id),
  add column resolution_note text;

-- RLS: além de dono/gerente (já existente), o repositor com acesso ao
-- mercado enxerga as tarefas pendentes (para aceitar) e as próprias tarefas
-- (qualquer status), nunca as tarefas de outro repositor.
drop policy "replenishment_tasks_select" on public.replenishment_tasks;
create policy "replenishment_tasks_select" on public.replenishment_tasks for select to authenticated
  using (
    private.has_company_role((select company_id from public.markets where id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select company_id from public.markets where id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
    or (
      private.has_company_role((select company_id from public.markets where id = market_id), array['stocker']::public.member_role[])
      and private.can_access_market(market_id)
      and (status = 'pendente' or accepted_by = (select auth.uid()))
    )
  );

-- Núcleo de register_stock_movement (B3.2/B3.3), sem a checagem de permissão
-- de dono/gerente — usado tanto por register_stock_movement (permissão
-- dono/gerente) quanto pelas funções do repositor abaixo (permissão própria,
-- restrita à tarefa aceita por quem chama). Mesmas regras de saldo/lote/FEFO,
-- uma única fonte da verdade.
create function private.post_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_lot_id uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_tracks_lot boolean;
  v_lot public.lots;
  v_current_balance numeric;
  v_new_balance numeric;
  v_lot_balance numeric;
  v_lot_new_balance numeric;
  v_suggested_lot_id uuid;
  v_needs_reason boolean := false;
  v_row public.stock_movements;
begin
  if p_quantity = 0 then
    raise exception 'A quantidade não pode ser zero';
  end if;
  if p_type = 'entrada' and p_quantity <= 0 then
    raise exception 'Entrada precisa ter quantidade positiva';
  end if;
  if p_type in ('saida', 'perda', 'devolucao_fornecedor') and p_quantity >= 0 then
    raise exception 'Saída, perda e devolução ao fornecedor precisam ter quantidade negativa';
  end if;

  select m.company_id into v_company_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = p_warehouse_address_id;

  select p.tracks_batch_expiry into v_tracks_lot
  from public.products p
  where p.id = p_product_id and p.company_id = v_company_id;

  if v_tracks_lot is null then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  if v_tracks_lot then
    if p_lot_id is null then
      raise exception 'Este produto controla lote e validade — informe o lote do movimento.';
    end if;
    select * into v_lot from public.lots
    where id = p_lot_id and warehouse_address_id = p_warehouse_address_id and product_id = p_product_id;
    if v_lot.id is null then
      raise exception 'Lote não encontrado para este endereço e produto.';
    end if;

    if p_type = 'saida' then
      if v_lot.status = 'blocked' then
        raise exception 'Este lote está bloqueado e não pode ser usado em saídas.';
      end if;
      if v_lot.expires_at is not null and v_lot.expires_at < current_date then
        raise exception 'Este lote está vencido e não pode ser usado em saídas — registre uma perda para descartá-lo.';
      end if;

      select l.id into v_suggested_lot_id
      from public.lots l
      where l.warehouse_address_id = p_warehouse_address_id
        and l.product_id = p_product_id
        and l.status = 'available'
        and (l.expires_at is null or l.expires_at >= current_date)
        and coalesce((select sum(sm.quantity) from public.stock_movements sm where sm.lot_id = l.id), 0) > 0
      order by l.expires_at asc nulls last, l.created_at asc
      limit 1;

      if v_suggested_lot_id is not null and v_suggested_lot_id <> p_lot_id then
        v_needs_reason := true;
      end if;
    end if;
  elsif p_lot_id is not null then
    raise exception 'Este produto não controla lote e validade — não informe um lote.';
  end if;

  select coalesce(sum(quantity), 0) into v_current_balance
  from public.stock_movements
  where warehouse_address_id = p_warehouse_address_id and product_id = p_product_id;
  v_new_balance := v_current_balance + p_quantity;
  if v_new_balance < 0 then
    v_needs_reason := true;
  end if;

  if p_lot_id is not null then
    select coalesce(sum(quantity), 0) into v_lot_balance from public.stock_movements where lot_id = p_lot_id;
    v_lot_new_balance := v_lot_balance + p_quantity;
    if v_lot_new_balance < 0 then
      v_needs_reason := true;
    end if;
  end if;

  if v_needs_reason then
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Esse movimento deixaria o saldo negativo ou pula a ordem de saída do lote (%). Informe uma justificativa para confirmar mesmo assim.', v_new_balance;
    end if;
    perform set_config('app.justification', p_reason, true);
  end if;

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), p_lot_id, v_user)
  returning * into v_row;

  return v_row;
end;
$$;

-- Aceita uma tarefa pendente — o próprio repositor, direto da fila (PA-12).
create function public.accept_replenishment_task(p_task_id uuid)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_company_id uuid;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para aceitar uma tarefa';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'pendente' then
    raise exception 'Esta tarefa já foi aceita por alguém';
  end if;

  select company_id into v_company_id from public.markets where id = v_task.market_id;

  if not (
    private.has_company_role(v_company_id, array['stocker']::public.member_role[])
    and private.can_access_market(v_task.market_id)
  ) then
    raise exception 'Sem permissão para aceitar tarefas deste mercado';
  end if;

  update public.replenishment_tasks
  set status = 'aceita', accepted_by = v_user, accepted_at = now()
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.accept_replenishment_task(uuid) from public, anon;
grant execute on function public.accept_replenishment_task(uuid) to authenticated;

-- Atribui uma tarefa pendente a um repositor específico (PA-12) — dono ou gerente.
create function public.assign_replenishment_task(p_task_id uuid, p_stocker_user_id uuid)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_company_id uuid;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para atribuir uma tarefa';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'pendente' then
    raise exception 'Esta tarefa já foi aceita por alguém';
  end if;

  select company_id into v_company_id from public.markets where id = v_task.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_task.market_id))
  ) then
    raise exception 'Sem permissão para atribuir tarefas deste mercado';
  end if;

  if not exists (
    select 1 from public.company_members cm
    join public.member_markets mm on mm.member_id = cm.id
    where cm.user_id = p_stocker_user_id
      and cm.company_id = v_company_id
      and cm.role = 'stocker'
      and cm.status = 'active'
      and mm.market_id = v_task.market_id
  ) then
    raise exception 'Repositor não encontrado ou sem acesso a este mercado';
  end if;

  update public.replenishment_tasks
  set status = 'aceita', accepted_by = p_stocker_user_id, accepted_at = now()
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.assign_replenishment_task(uuid, uuid) from public, anon;
grant execute on function public.assign_replenishment_task(uuid, uuid) to authenticated;

-- Registra a retirada do depósito (RF-REP-04/RN-REP-07) — quantidade real,
-- que pode ser diferente da sugerida (DEC-B5-03). Segue FEFO automaticamente
-- para produto com lote (sem escolha manual nesta etapa).
create function public.register_replenishment_withdrawal(
  p_task_id uuid,
  p_quantity numeric,
  p_source_warehouse_address_id uuid
)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_source_market_id uuid;
  v_tracks_lot boolean;
  v_lot_id uuid;
  v_current_balance numeric;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar a retirada';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe uma quantidade retirada maior que zero';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'aceita' then
    raise exception 'Esta tarefa não está aceita — aceite antes de retirar';
  end if;
  if v_task.accepted_by <> v_user then
    raise exception 'Esta tarefa foi aceita por outro repositor';
  end if;

  select market_id into v_source_market_id from public.warehouse_addresses where id = p_source_warehouse_address_id;
  if v_source_market_id is null or v_source_market_id <> v_task.market_id then
    raise exception 'Endereço de depósito não pertence ao mercado desta tarefa';
  end if;

  select tracks_batch_expiry into v_tracks_lot from public.products where id = v_task.product_id;

  if v_tracks_lot then
    select l.id into v_lot_id
    from public.lots l
    where l.warehouse_address_id = p_source_warehouse_address_id
      and l.product_id = v_task.product_id
      and l.status = 'available'
      and (l.expires_at is null or l.expires_at >= current_date)
      and coalesce((select sum(sm.quantity) from public.stock_movements sm where sm.lot_id = l.id), 0) > 0
    order by l.expires_at asc nulls last, l.created_at asc
    limit 1;
    if v_lot_id is null then
      raise exception 'Nenhum lote disponível deste produto neste endereço de depósito';
    end if;
  end if;

  select coalesce(sum(quantity), 0) into v_current_balance
  from public.stock_movements
  where warehouse_address_id = p_source_warehouse_address_id and product_id = v_task.product_id;
  if v_current_balance < p_quantity then
    raise exception 'Saldo insuficiente neste endereço de depósito (saldo atual: %)', v_current_balance;
  end if;

  perform private.post_stock_movement(
    p_source_warehouse_address_id, v_task.product_id, 'saida', -p_quantity,
    'Reposição ' || p_task_id, null, v_lot_id
  );

  update public.replenishment_tasks
  set status = 'em_transito',
      source_warehouse_address_id = p_source_warehouse_address_id,
      withdrawal_lot_id = v_lot_id,
      withdrawn_at = now(),
      withdrawn_by = v_user,
      quantity_withdrawn = p_quantity,
      last_impediment_reason = null,
      last_impediment_at = null
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_replenishment_withdrawal(uuid, numeric, uuid) from public, anon;
grant execute on function public.register_replenishment_withdrawal(uuid, numeric, uuid) to authenticated;

-- Registra a reposição na gôndola e a sobra devolvida (RF-REP-06/08,
-- RN-REP-07/08) — conclui a tarefa quando reposto + devolvido fecham com o
-- retirado; senão vira 'com_inconsistencia' para o gerente/dono decidir
-- (DEC-B5-04, sem limite automático).
create function public.register_replenishment_completion(
  p_task_id uuid,
  p_quantity_placed numeric,
  p_quantity_returned numeric default 0,
  p_return_warehouse_address_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_return_market_id uuid;
  v_return_lot_id uuid;
  v_withdrawal_lot public.lots;
  v_matches boolean;
  v_final_status public.replenishment_task_status;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para concluir a reposição';
  end if;
  if p_quantity_placed is null or p_quantity_placed < 0 or p_quantity_returned is null or p_quantity_returned < 0 then
    raise exception 'Informe quantidades válidas (zero ou maiores) para reposto e devolvido';
  end if;
  if p_quantity_placed = 0 and p_quantity_returned = 0 then
    raise exception 'Nada foi reposto nem devolvido — se houve um impedimento, registre o impedimento em vez disso';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'em_transito' then
    raise exception 'Esta tarefa não está em trânsito — registre a retirada antes de concluir';
  end if;
  if v_task.accepted_by <> v_user then
    raise exception 'Esta tarefa foi aceita por outro repositor';
  end if;

  if p_quantity_returned > 0 then
    if p_return_warehouse_address_id is null then
      raise exception 'Informe o endereço de depósito para devolver a sobra';
    end if;
    select market_id into v_return_market_id from public.warehouse_addresses where id = p_return_warehouse_address_id;
    if v_return_market_id is null or v_return_market_id <> v_task.market_id then
      raise exception 'Endereço de devolução não pertence ao mercado desta tarefa';
    end if;

    if v_task.withdrawal_lot_id is not null then
      select * into v_withdrawal_lot from public.lots where id = v_task.withdrawal_lot_id;
      select id into v_return_lot_id from public.get_or_create_lot(
        p_return_warehouse_address_id, v_task.product_id, v_withdrawal_lot.batch_number, v_withdrawal_lot.expires_at
      );
    end if;

    perform private.post_stock_movement(
      p_return_warehouse_address_id, v_task.product_id, 'entrada', p_quantity_returned,
      'Reposição ' || p_task_id || ' - sobra devolvida', null, v_return_lot_id
    );
  end if;

  if p_quantity_placed > 0 then
    update public.gondola_positions
    set current_balance = current_balance + p_quantity_placed, balance_updated_at = now(), balance_updated_by = v_user
    where id = v_task.gondola_position_id;
  end if;

  v_matches := (p_quantity_placed + p_quantity_returned) = v_task.quantity_withdrawn;
  v_final_status := case when v_matches then 'concluida' else 'com_inconsistencia' end;

  update public.replenishment_tasks
  set status = v_final_status,
      quantity_placed = p_quantity_placed,
      quantity_returned = p_quantity_returned,
      return_warehouse_address_id = p_return_warehouse_address_id,
      completed_at = now(),
      completed_by = v_user,
      resolution_note = case when not v_matches then p_note else resolution_note end
  where id = p_task_id;

  return jsonb_build_object('status', v_final_status, 'matches', v_matches);
end;
$$;
revoke all on function public.register_replenishment_completion(uuid, numeric, numeric, uuid, text) from public, anon;
grant execute on function public.register_replenishment_completion(uuid, numeric, numeric, uuid, text) to authenticated;

-- Registra um impedimento (RF-REP-08) — a tarefa volta para 'pendente' com o
-- motivo registrado (DEC-B5-06); se já tinha retirada feita, devolve o
-- estoque retirado ao depósito de origem.
create function public.register_replenishment_impediment(p_task_id uuid, p_reason text)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um impedimento';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo do impedimento';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status not in ('aceita', 'em_transito') then
    raise exception 'Esta tarefa não está em andamento';
  end if;
  if v_task.accepted_by <> v_user then
    raise exception 'Esta tarefa foi aceita por outro repositor';
  end if;

  if v_task.status = 'em_transito' then
    perform private.post_stock_movement(
      v_task.source_warehouse_address_id, v_task.product_id, 'entrada', v_task.quantity_withdrawn,
      'Estorno da retirada — impedimento na reposição ' || p_task_id, null, v_task.withdrawal_lot_id
    );
  end if;

  update public.replenishment_tasks
  set status = 'pendente',
      accepted_by = null,
      accepted_at = null,
      source_warehouse_address_id = null,
      withdrawal_lot_id = null,
      withdrawn_at = null,
      withdrawn_by = null,
      quantity_withdrawn = null,
      last_impediment_reason = p_reason,
      last_impediment_at = now()
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_replenishment_impediment(uuid, text) from public, anon;
grant execute on function public.register_replenishment_impediment(uuid, text) to authenticated;

-- Dono/gerente decide uma inconsistência (RN-REP-08) — a tarefa fecha com a
-- decisão registrada; nenhum novo movimento de estoque acontece aqui (se
-- precisar corrigir saldo, é o ajuste comum do B3.4).
create function public.resolve_replenishment_inconsistency(p_task_id uuid, p_note text)
returns public.replenishment_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_task public.replenishment_tasks;
  v_company_id uuid;
  v_row public.replenishment_tasks;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para decidir uma inconsistência';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Informe uma observação sobre a decisão';
  end if;

  select * into v_task from public.replenishment_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.status <> 'com_inconsistencia' then
    raise exception 'Esta tarefa não está com inconsistência pendente';
  end if;

  select company_id into v_company_id from public.markets where id = v_task.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_task.market_id))
  ) then
    raise exception 'Sem permissão para decidir esta inconsistência';
  end if;

  update public.replenishment_tasks
  set status = 'concluida', resolved_at = now(), resolved_by = v_user, resolution_note = p_note
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.resolve_replenishment_inconsistency(uuid, text) from public, anon;
grant execute on function public.resolve_replenishment_inconsistency(uuid, text) to authenticated;

-- Lista as tarefas de um mercado (RN-CRT-REP-03: mostra o andamento de
-- cada uma). Dono/gerente veem tudo que não está concluído; o repositor vê
-- as pendentes (para aceitar) e as próprias (qualquer status ativo).
drop function public.list_replenishment_tasks(uuid);
create function public.list_replenishment_tasks(p_market_id uuid)
returns table (
  id uuid,
  gondola_position_id uuid,
  gondola_position_code text,
  product_id uuid,
  product_name text,
  quantity_needed numeric,
  is_ruptura boolean,
  is_near_expiry boolean,
  waiting_hours numeric,
  priority_score numeric,
  status public.replenishment_task_status,
  accepted_by uuid,
  quantity_withdrawn numeric,
  last_impediment_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_is_owner boolean;
  v_is_manager boolean;
  v_is_stocker boolean;
begin
  select m.company_id into v_company_id from public.markets m where m.id = p_market_id;

  v_is_owner := private.has_company_role(v_company_id, array['owner']::public.member_role[]);
  v_is_manager := private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id);
  v_is_stocker := private.has_company_role(v_company_id, array['stocker']::public.member_role[]) and private.can_access_market(p_market_id);

  if not (v_is_owner or v_is_manager or v_is_stocker) then
    raise exception 'Sem permissão para ver as tarefas de reposição deste mercado';
  end if;

  return query
    select
      rt.id,
      rt.gondola_position_id,
      gp.code,
      rt.product_id,
      p.name,
      rt.quantity_needed,
      rt.is_ruptura,
      rt.is_near_expiry,
      extract(epoch from (now() - rt.created_at)) / 3600 as waiting_hours,
      (case when rt.is_ruptura then 1000 else 0 end)
        + (case when rt.is_near_expiry then 500 else 0 end)
        + (extract(epoch from (now() - rt.created_at)) / 3600) as priority_score,
      rt.status,
      rt.accepted_by,
      rt.quantity_withdrawn,
      rt.last_impediment_reason,
      rt.created_at
    from public.replenishment_tasks rt
    join public.gondola_positions gp on gp.id = rt.gondola_position_id
    join public.products p on p.id = rt.product_id
    where rt.market_id = p_market_id
      and (
        (v_is_owner or v_is_manager) and rt.status <> 'concluida'
        or (v_is_stocker and (rt.status = 'pendente' or rt.accepted_by = v_user))
      )
    order by priority_score desc;
end;
$$;
revoke all on function public.list_replenishment_tasks(uuid) from public, anon;
grant execute on function public.list_replenishment_tasks(uuid) to authenticated;

-- O repositor precisa ver os endereços de depósito do mercado para escolher
-- de onde retira e para onde devolve a sobra (RF-REP-04/06).
drop policy "warehouse_addresses_select" on public.warehouse_addresses;
create policy "warehouse_addresses_select" on public.warehouse_addresses for select to authenticated
  using (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
        or (private.has_company_role(m.company_id, array['stocker']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));

-- Auditoria (AUD-06): a trilha completa da tarefa (aceite, retirada,
-- conclusão, inconsistência, impedimento) agora também cobre atualizações,
-- não só a criação.
drop trigger audit_replenishment_tasks on public.replenishment_tasks;
create trigger audit_replenishment_tasks after insert or update on public.replenishment_tasks
  for each row execute function private.audit_trigger();
