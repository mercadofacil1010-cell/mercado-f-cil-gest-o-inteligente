-- B5.4 — Câmera e leitor de código de barras reais (RF-REP-05, PA-47,
-- INT-SCAN, INT-CAM).
--
-- Decidido em DECISOES.md: só a câmera do celular por enquanto (DEC-B5-10)
-- — leitor físico USB/Bluetooth normalmente emula teclado e já funciona
-- digitando no campo manual existente, sem código novo (PA-47). A foto de
-- evidência, adiada desde o B3.4 (PA-21), entra de uma vez em todos os
-- lugares que já pediam isso (DEC-B5-09): perdas/ajustes pendentes de
-- aprovação (B3.4), contagem de recebimento (B4.2), recusa de item/carga
-- (B4.4) e impedimento de reposição (B5.2) — mesma infraestrutura de
-- upload, um parâmetro opcional a mais em cada função. Visibilidade da
-- foto é a mesma de quem já vê o registro onde ela foi anexada, mais quem
-- enviou (DEC-B5-11).
--
-- Bucket e políticas do Storage: o Postgres de teste local (supabase/tests)
-- não tem o schema `storage` (só existe no projeto Supabase de verdade) —
-- por isso todo o bloco abaixo roda dentro de um `if exists` dinâmico, que
-- não faz nada localmente e cria o bucket/políticas de verdade quando
-- aplicado ao projeto real. Caminho do objeto: {company_id}/{market_id}/
-- {uploaded_by}/{arquivo} — a política de leitura reconhece dono, gerente
-- com acesso ao mercado, ou o próprio uploader (DEC-B5-11); a de escrita só
-- permite gravar na própria pasta de uploaded_by, dentro de uma empresa da
-- qual a pessoa é membro ativo.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $sql$
      insert into storage.buckets (id, name, public)
      values ('evidence-photos', 'evidence-photos', false)
      on conflict (id) do nothing
    $sql$;

    execute $sql$
      create policy "evidence_photos_select" on storage.objects for select to authenticated
      using (
        bucket_id = 'evidence-photos'
        and (
          private.has_company_role(((storage.foldername(name))[1])::uuid, array['owner']::public.member_role[])
          or (
            private.has_company_role(((storage.foldername(name))[1])::uuid, array['manager']::public.member_role[])
            and private.can_access_market(((storage.foldername(name))[2])::uuid)
          )
          or (storage.foldername(name))[3] = (select auth.uid())::text
        )
      )
    $sql$;

    execute $sql$
      create policy "evidence_photos_insert" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'evidence-photos'
        and (storage.foldername(name))[3] = (select auth.uid())::text
        and exists (
          select 1 from public.company_members cm
          where cm.company_id = ((storage.foldername(name))[1])::uuid
            and cm.user_id = (select auth.uid())
            and cm.status = 'active'
        )
      )
    $sql$;
  end if;
end;
$$;

-- RF-REC-XX (lacuna descoberta agora): o conferente (receiver) e o
-- repositor (stocker) nunca tiveram select em products/product_packagings
-- — a busca por código de barras do B4.2 (findProductByBarcode) sempre
-- teria devolvido "não encontrado" para eles. Corrige junto com a câmera,
-- que reaproveita a mesma busca.
drop policy "products_select" on public.products;
create policy "products_select" on public.products for select to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager', 'receiver', 'stocker']::public.member_role[]));

drop policy "product_packagings_select" on public.product_packagings;
create policy "product_packagings_select" on public.product_packagings for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id
      and private.has_company_role(p.company_id, array['owner', 'manager', 'receiver', 'stocker']::public.member_role[])
  ));

-- Perdas/ajustes pendentes (B3.4) ganham foto opcional, anexada no pedido.
alter table public.pending_stock_adjustments
  add column photo_path text;

drop function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, uuid);

create function public.register_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_lot_id uuid default null,
  p_transfer_id uuid default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_market_id uuid;
  v_tracks_lot boolean;
  v_lot public.lots;
  v_current_balance numeric;
  v_new_balance numeric;
  v_lot_balance numeric;
  v_lot_new_balance numeric;
  v_suggested_lot_id uuid;
  v_needs_reason boolean := false;
  v_threshold numeric;
  v_is_outbound boolean;
  v_row public.stock_movements;
  v_pending public.pending_stock_adjustments;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um movimento';
  end if;
  if p_quantity = 0 then
    raise exception 'A quantidade não pode ser zero';
  end if;
  if p_type = 'entrada' and p_quantity <= 0 then
    raise exception 'Entrada precisa ter quantidade positiva';
  end if;
  if p_type in ('saida', 'perda', 'devolucao_fornecedor') and p_quantity >= 0 then
    raise exception 'Saída, perda e devolução ao fornecedor precisam ter quantidade negativa';
  end if;

  v_is_outbound := p_type = 'saida' or (p_type = 'transferencia' and p_quantity < 0);

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = p_warehouse_address_id;

  if v_company_id is null then
    raise exception 'Endereço de depósito não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para registrar movimento neste mercado';
  end if;

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

    if v_is_outbound then
      if v_lot.status = 'blocked' then
        raise exception 'Este lote está bloqueado e não pode ser usado em saídas ou transferências.';
      end if;
      if v_lot.expires_at is not null and v_lot.expires_at < current_date then
        raise exception 'Este lote está vencido e não pode ser usado em saídas ou transferências — registre uma perda para descartá-lo.';
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

  if p_type in ('perda', 'ajuste') then
    select loss_adjustment_approval_threshold into v_threshold
    from public.companies where id = v_company_id;

    if abs(p_quantity) > v_threshold then
      if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Esse % passa do limite de aprovação da empresa (%). Informe o motivo para enviar para aprovação.', p_type, v_threshold;
      end if;

      insert into public.pending_stock_adjustments
        (warehouse_address_id, product_id, lot_id, type, quantity, reference, reason, requested_by, photo_path)
      values (
        p_warehouse_address_id, p_product_id, p_lot_id, p_type, p_quantity,
        nullif(btrim(coalesce(p_reference, '')), ''), p_reason, v_user, p_photo_path
      )
      returning * into v_pending;

      return jsonb_build_object('status', 'pending', 'pending_id', v_pending.id, 'threshold', v_threshold);
    end if;
  end if;

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, transfer_id, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), p_lot_id, p_transfer_id, v_user)
  returning * into v_row;

  return jsonb_build_object('status', 'posted', 'movement', to_jsonb(v_row));
end;
$$;
revoke all on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, uuid, text) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, uuid, text) to authenticated;

-- Contagem de recebimento (B4.2) ganha foto opcional.
alter table public.receiving_counted_items
  add column photo_path text,
  add column rejection_photo_path text;

drop function public.add_receiving_count(uuid, uuid, uuid, numeric, text, date, date, public.receiving_item_condition, text);

create function public.add_receiving_count(
  p_receiving_id uuid,
  p_product_id uuid,
  p_packaging_id uuid,
  p_quantity numeric,
  p_batch_number text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_condition public.receiving_item_condition default 'bom_estado',
  p_note text default null,
  p_photo_path text default null
)
returns public.receiving_counted_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_packaging public.product_packagings;
  v_row public.receiving_counted_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar uma contagem';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe uma quantidade contada maior que zero';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem') then
    raise exception 'Este recebimento não está em conferência — inicie a conferência (ou a recontagem) antes de contar';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (
      private.has_company_role(v_company_id, array['manager', 'receiver']::public.member_role[])
      and private.can_access_market(v_market_id)
    )
  ) then
    raise exception 'Sem permissão para conferir este recebimento';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id and p.company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  select * into v_packaging from public.product_packagings
  where id = p_packaging_id and product_id = p_product_id;
  if v_packaging.id is null then
    raise exception 'Embalagem não encontrada para este produto';
  end if;

  insert into public.receiving_counted_items (
    receiving_id, product_id, packaging_id, counted_quantity, base_quantity,
    batch_number, manufactured_at, expires_at, condition, note, created_by, attempt, photo_path
  )
  values (
    p_receiving_id, p_product_id, p_packaging_id, p_quantity, p_quantity * v_packaging.conversion_factor,
    nullif(btrim(coalesce(p_batch_number, '')), ''), p_manufactured_at, p_expires_at, p_condition,
    nullif(btrim(coalesce(p_note, '')), ''), v_user, v_receiving.active_attempt, p_photo_path
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.add_receiving_count(uuid, uuid, uuid, numeric, text, date, date, public.receiving_item_condition, text, text) from public, anon;
grant execute on function public.add_receiving_count(uuid, uuid, uuid, numeric, text, date, date, public.receiving_item_condition, text, text) to authenticated;

-- Recusa de item e de carga (B4.4) ganham foto opcional.
alter table public.receivings
  add column rejection_photo_path text;

drop function public.reject_receiving_count(uuid, text);

create function public.reject_receiving_count(p_id uuid, p_reason text, p_photo_path text default null)
returns public.receiving_counted_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.receiving_counted_items;
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.receiving_counted_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para recusar um item';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_item from public.receiving_counted_items where id = p_id;
  if v_item.id is null then
    raise exception 'Item contado não encontrado';
  end if;
  if v_item.rejected then
    raise exception 'Este item já foi recusado';
  end if;

  select * into v_receiving from public.receivings where id = v_item.receiving_id;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento já foi decidido — não é possível recusar mais itens';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para recusar itens deste recebimento';
  end if;

  update public.receiving_counted_items
  set rejected = true, rejection_reason = p_reason, rejected_by = v_user, rejected_at = now(), rejection_photo_path = p_photo_path
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reject_receiving_count(uuid, text, text) from public, anon;
grant execute on function public.reject_receiving_count(uuid, text, text) to authenticated;

drop function public.reject_receiving(uuid, text);

create function public.reject_receiving(p_receiving_id uuid, p_reason text, p_photo_path text default null)
returns public.receivings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.receivings;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para recusar um recebimento';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status not in ('em_conferencia', 'em_recontagem', 'aguardando_aprovacao') then
    raise exception 'Este recebimento já foi decidido — não é possível recusar';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para recusar este recebimento';
  end if;

  update public.receivings
  set status = 'recusado', rejected_at = now(), rejected_by = v_user, rejection_reason = p_reason, rejection_photo_path = p_photo_path
  where id = p_receiving_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reject_receiving(uuid, text, text) from public, anon;
grant execute on function public.reject_receiving(uuid, text, text) to authenticated;

-- Impedimento de reposição (B5.2) ganha foto opcional.
alter table public.replenishment_tasks
  add column last_impediment_photo_path text;

drop function public.register_replenishment_impediment(uuid, text);

create function public.register_replenishment_impediment(p_task_id uuid, p_reason text, p_photo_path text default null)
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
      last_impediment_at = now(),
      last_impediment_photo_path = p_photo_path
  where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_replenishment_impediment(uuid, text, text) from public, anon;
grant execute on function public.register_replenishment_impediment(uuid, text, text) to authenticated;

-- list_replenishment_tasks (B5.2/B5.3) passa a devolver também o código de
-- barras do produto — o repositor já vê o código da posição (gondola_
-- position_code) desde o B5.2; com o código de barras ele consegue
-- conferir produto E endereço/posição antes de retirar ou repor (RF-REP-05,
-- DEC-B5-12), sem precisar de select em gondola_positions (continua
-- bloqueado desde o B3.1 — a conferência usa só o que a tarefa já expõe).
drop function public.list_replenishment_tasks(uuid);
create function public.list_replenishment_tasks(p_market_id uuid)
returns table (
  id uuid,
  gondola_position_id uuid,
  gondola_position_code text,
  product_id uuid,
  product_name text,
  product_barcode text,
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
      p.barcode,
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
