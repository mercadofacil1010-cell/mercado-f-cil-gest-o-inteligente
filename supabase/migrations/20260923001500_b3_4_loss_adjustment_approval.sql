-- B3.4 — Perdas e ajustes com aprovação por limite (RN-CRT-VAL-05, PA-21).
--
-- Decidido em DECISOES.md: como o catálogo ainda não tem preço/custo, o
-- limite só pode ser por quantidade (limite por valor fica para quando
-- houver preço). Perda ou ajuste cujo valor absoluto passa do limite da
-- empresa não entra direto no livro (stock_movements) — fica pendente numa
-- fila própria até o dono ou um gerente (nunca quem pediu) aprovar ou
-- recusar. "Evidência" por enquanto é o texto do motivo (já obrigatório
-- para valores altos); foto real fica para o B5.4 (câmera do app mobile).
--
-- O limite é uma configuração por empresa (companies.loss_adjustment_approval_threshold),
-- com um valor padrão inicial — ajustável pelo dono quando a tela de
-- Configurações for construída; por ora, via suporte/SQL direto.

alter table public.companies
  add column loss_adjustment_approval_threshold numeric(12, 3) not null default 20
    check (loss_adjustment_approval_threshold > 0);

create type public.pending_adjustment_status as enum ('pending', 'approved', 'rejected');

create table public.pending_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  warehouse_address_id uuid not null references public.warehouse_addresses (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  lot_id uuid references public.lots (id),
  -- Só perda e ajuste passam por aprovação (entrada/saída/devolução não têm limite).
  type public.stock_movement_type not null check (type in ('perda', 'ajuste')),
  quantity numeric(12, 3) not null check (quantity <> 0),
  reference text check (reference is null or char_length(reference) <= 200),
  -- RN-CRT-VAL-05: motivo/evidência obrigatório para pedir aprovação.
  reason text not null check (char_length(btrim(reason)) > 0),
  status public.pending_adjustment_status not null default 'pending',
  requested_by uuid not null references auth.users (id),
  resolved_by uuid references auth.users (id),
  resolution_note text,
  resulting_movement_id uuid references public.stock_movements (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.pending_stock_adjustments is 'Fila de aprovação de perdas/ajustes acima do limite da empresa (B3.4). Só quando aprovado gera a linha real em stock_movements.';

create index pending_stock_adjustments_address_idx on public.pending_stock_adjustments (warehouse_address_id, status);

alter table public.pending_stock_adjustments enable row level security;

create policy "pending_stock_adjustments_select" on public.pending_stock_adjustments for select to authenticated
  using (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

-- Toda escrita passa pelas funções abaixo (mesmo padrão do ledger de B3.2).
revoke insert, update, delete on public.pending_stock_adjustments from authenticated, anon;

-- Substitui register_stock_movement (B3.3) para desviar perda/ajuste acima
-- do limite da empresa para a fila de aprovação em vez de gravar direto no
-- livro. Muda o retorno para jsonb porque agora há dois resultados possíveis
-- (lançado direto ou pendente) — nenhum teste ou código depende do formato
-- de linha antigo, todos reconsultam pelas views/tabelas.
drop function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid);

create function public.register_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_lot_id uuid default null
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

  -- RN-CRT-VAL-05/PA-21: perda ou ajuste acima do limite da empresa não
  -- entra direto no livro — fica pendente de aprovação.
  if p_type in ('perda', 'ajuste') then
    select loss_adjustment_approval_threshold into v_threshold
    from public.companies where id = v_company_id;

    if abs(p_quantity) > v_threshold then
      if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Esse % passa do limite de aprovação da empresa (%). Informe o motivo para enviar para aprovação.', p_type, v_threshold;
      end if;

      insert into public.pending_stock_adjustments
        (warehouse_address_id, product_id, lot_id, type, quantity, reference, reason, requested_by)
      values (
        p_warehouse_address_id, p_product_id, p_lot_id, p_type, p_quantity,
        nullif(btrim(coalesce(p_reference, '')), ''), p_reason, v_user
      )
      returning * into v_pending;

      return jsonb_build_object('status', 'pending', 'pending_id', v_pending.id, 'threshold', v_threshold);
    end if;
  end if;

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), p_lot_id, v_user)
  returning * into v_row;

  return jsonb_build_object('status', 'posted', 'movement', to_jsonb(v_row));
end;
$$;
revoke all on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid) to authenticated;

-- Aprova um pedido pendente: cria a linha real em stock_movements e fecha o
-- pedido. Quem pediu nunca pode aprovar o próprio pedido.
create function public.approve_pending_stock_adjustment(p_id uuid, p_note text default null)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_pending public.pending_stock_adjustments;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.stock_movements;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para aprovar um pedido';
  end if;

  select * into v_pending from public.pending_stock_adjustments where id = p_id;
  if v_pending.id is null then
    raise exception 'Pedido de aprovação não encontrado';
  end if;
  if v_pending.status <> 'pending' then
    raise exception 'Este pedido já foi % — não pode ser aprovado de novo', v_pending.status;
  end if;
  if v_pending.requested_by = v_user then
    raise exception 'Quem pediu a aprovação não pode aprovar o próprio pedido';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = v_pending.warehouse_address_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para aprovar pedidos neste mercado';
  end if;

  perform set_config('app.justification', coalesce(p_note, v_pending.reason), true);

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, created_by)
  values (
    v_pending.warehouse_address_id, v_pending.product_id, v_pending.type, v_pending.quantity,
    v_pending.reference, v_pending.lot_id, v_pending.requested_by
  )
  returning * into v_row;

  update public.pending_stock_adjustments
  set status = 'approved', resolved_by = v_user, resolution_note = p_note, resulting_movement_id = v_row.id, resolved_at = now()
  where id = p_id;

  return v_row;
end;
$$;
revoke all on function public.approve_pending_stock_adjustment(uuid, text) from public, anon;
grant execute on function public.approve_pending_stock_adjustment(uuid, text) to authenticated;

-- Recusa um pedido pendente (exige motivo da recusa). Não gera movimento.
create function public.reject_pending_stock_adjustment(p_id uuid, p_note text)
returns public.pending_stock_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_pending public.pending_stock_adjustments;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.pending_stock_adjustments;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para recusar um pedido';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_pending from public.pending_stock_adjustments where id = p_id;
  if v_pending.id is null then
    raise exception 'Pedido de aprovação não encontrado';
  end if;
  if v_pending.status <> 'pending' then
    raise exception 'Este pedido já foi % — não pode ser recusado de novo', v_pending.status;
  end if;
  if v_pending.requested_by = v_user then
    raise exception 'Quem pediu a aprovação não pode recusar o próprio pedido';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = v_pending.warehouse_address_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para recusar pedidos neste mercado';
  end if;

  perform set_config('app.justification', p_note, true);

  update public.pending_stock_adjustments
  set status = 'rejected', resolved_by = v_user, resolution_note = p_note, resolved_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reject_pending_stock_adjustment(uuid, text) from public, anon;
grant execute on function public.reject_pending_stock_adjustment(uuid, text) to authenticated;

-- Auditoria (AUD-07): estende o mecanismo genérico do B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_pending_stock_adjustments after insert or update on public.pending_stock_adjustments
  for each row execute function private.audit_trigger();
