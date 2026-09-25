-- B3.5 — Transferências entre endereços de depósito do mesmo mercado
-- (RN-ORG-06/RN-EST-05 parcial, PA-22).
--
-- Escopo decidido em DECISOES.md: nesta etapa só existe transferência entre
-- dois endereços de depósito do MESMO mercado. Transferência entre mercados
-- diferentes (com estado "em trânsito" e confirmação de recebimento) fica
-- para depois — não construir agora seria inventar regra sem necessidade
-- real ainda (PA-22).
--
-- Decidido (DEC-B3-01): transferência entre endereços do mesmo mercado é
-- instantânea — uma chamada registra a saída da origem e a entrada no
-- destino ao mesmo tempo, sem estado intermediário.
--
-- Decidido (DEC-B3-02): produto com lote mantém o mesmo número/validade no
-- endereço de destino (get_or_create_lot já é idempotente para isso); lote
-- bloqueado ou vencido não pode ser transferido, e a saída da origem segue
-- FEFO/FIFO com exceção justificada — mesma regra já aplicada à saída
-- (B3.3), agora reaproveitada para o novo tipo de movimento.
--
-- Implementação: novo valor 'transferencia' no enum de tipo de movimento
-- (aceita os dois sinais, como 'ajuste'); a perna negativa (saída da origem)
-- passa pelas mesmas validações de lote bloqueado/vencido/FEFO que a saída.
-- As duas pernas (origem e destino) são linhas independentes e imutáveis do
-- mesmo ledger de sempre, ligadas por stock_movements.transfer_id só para
-- facilitar a leitura — cada uma pode ser estornada individualmente pelo
-- mecanismo já existente (reverse_stock_movement).

alter type public.stock_movement_type add value 'transferencia';

alter table public.stock_movements add column transfer_id uuid;
create index stock_movements_transfer_idx on public.stock_movements (transfer_id);

-- Substitui register_stock_movement (B3.4) para: aceitar 'transferencia' com
-- os dois sinais (como 'ajuste'); aplicar a mesma validação de lote
-- bloqueado/vencido/FEFO da saída também na perna negativa da transferência;
-- e gravar o transfer_id que liga as duas pernas.
drop function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid);

create function public.register_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_lot_id uuid default null,
  p_transfer_id uuid default null
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

  -- Transferência aceita os dois sinais (como ajuste): negativo é a saída da
  -- origem, positivo é a entrada no destino.
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

      -- FEFO (com validade) / FIFO (sem validade): RN-LOT-01/02, obrigatório
      -- com exceção justificada.
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
  -- entra direto no livro — fica pendente de aprovação. Transferência nunca
  -- passa por aprovação (não é perda nem ajuste).
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

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, transfer_id, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), p_lot_id, p_transfer_id, v_user)
  returning * into v_row;

  return jsonb_build_object('status', 'posted', 'movement', to_jsonb(v_row));
end;
$$;
revoke all on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, uuid) to authenticated;

-- Orquestra as duas pernas de uma transferência (saída da origem + entrada
-- no destino) como uma única operação, atômica, entre dois endereços do
-- MESMO mercado (RN-ORG-06/RN-EST-05, escopo desta etapa). Reaproveita
-- register_stock_movement para cada perna, herdando validações de saldo,
-- lote bloqueado/vencido e FEFO/FIFO sem duplicar a lógica.
create function public.register_stock_transfer(
  p_source_warehouse_address_id uuid,
  p_destination_warehouse_address_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_source_lot_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_source_company_id uuid;
  v_source_market_id uuid;
  v_dest_company_id uuid;
  v_dest_market_id uuid;
  v_source_code text;
  v_dest_code text;
  v_tracks_lot boolean;
  v_source_lot public.lots;
  v_dest_lot public.lots;
  v_transfer_id uuid := gen_random_uuid();
  v_note text;
  v_source_reference text;
  v_dest_reference text;
  v_source_result jsonb;
  v_dest_result jsonb;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar uma transferência';
  end if;
  if p_source_warehouse_address_id = p_destination_warehouse_address_id then
    raise exception 'A origem e o destino da transferência não podem ser o mesmo endereço';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe uma quantidade positiva para transferir';
  end if;

  select m.company_id, m.id, wa.code into v_source_company_id, v_source_market_id, v_source_code
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = p_source_warehouse_address_id;

  select m.company_id, m.id, wa.code into v_dest_company_id, v_dest_market_id, v_dest_code
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = p_destination_warehouse_address_id;

  if v_source_company_id is null then
    raise exception 'Endereço de origem não encontrado';
  end if;
  if v_dest_company_id is null then
    raise exception 'Endereço de destino não encontrado';
  end if;
  if v_source_market_id <> v_dest_market_id then
    raise exception 'Nesta etapa só é possível transferir entre endereços do mesmo mercado';
  end if;

  if not (
    private.has_company_role(v_source_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_source_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_source_market_id))
  ) then
    raise exception 'Sem permissão para transferir estoque neste mercado';
  end if;

  select p.tracks_batch_expiry into v_tracks_lot
  from public.products p
  where p.id = p_product_id and p.company_id = v_source_company_id;

  if v_tracks_lot is null then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  v_note := nullif(btrim(coalesce(p_reference, '')), '');
  v_source_reference := 'Transferência para ' || v_dest_code || coalesce(' — ' || v_note, '');
  v_dest_reference := 'Transferência de ' || v_source_code || coalesce(' — ' || v_note, '');

  if v_tracks_lot then
    if p_source_lot_id is null then
      raise exception 'Este produto controla lote e validade — escolha o lote de origem da transferência.';
    end if;
    select * into v_source_lot from public.lots
    where id = p_source_lot_id
      and warehouse_address_id = p_source_warehouse_address_id
      and product_id = p_product_id;
    if v_source_lot.id is null then
      raise exception 'Lote não encontrado para o endereço de origem e o produto informados.';
    end if;

    -- DEC-B3-02: o lote mantém o mesmo número/validade no destino.
    select * into v_dest_lot from public.get_or_create_lot(
      p_destination_warehouse_address_id, p_product_id, v_source_lot.batch_number, v_source_lot.expires_at
    );
  elsif p_source_lot_id is not null then
    raise exception 'Este produto não controla lote e validade — não informe um lote.';
  end if;

  -- Saída da origem: herda a validação de saldo/lote bloqueado/vencido/FEFO.
  v_source_result := public.register_stock_movement(
    p_source_warehouse_address_id, p_product_id, 'transferencia', -p_quantity,
    v_source_reference, p_reason, p_source_lot_id, v_transfer_id
  );

  -- Entrada no destino: sempre imediata, sem as checagens de saída.
  v_dest_result := public.register_stock_movement(
    p_destination_warehouse_address_id, p_product_id, 'transferencia', p_quantity,
    v_dest_reference, p_reason, v_dest_lot.id, v_transfer_id
  );

  return jsonb_build_object(
    'transfer_id', v_transfer_id,
    'source', v_source_result,
    'destination', v_dest_result
  );
end;
$$;
revoke all on function public.register_stock_transfer(uuid, uuid, uuid, numeric, text, text, uuid) from public, anon;
grant execute on function public.register_stock_transfer(uuid, uuid, uuid, numeric, text, text, uuid) to authenticated;
