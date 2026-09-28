-- B4.3 — Decisão, entrada no estoque e finalização (RF-REC-08/09, RN-REC-05/
-- 08/09, PA-05/06).
--
-- Decidido em DECISOES.md: sem tolerância automática (PA-06) — qualquer
-- diferença entre esperado e contado, por menor que seja, é uma divergência
-- e exige justificativa. O limite que decide se a divergência precisa do
-- dono reaproveita companies.loss_adjustment_approval_threshold, o mesmo
-- campo já usado nas perdas/ajustes do B3.4 (DEC-B4-05) — abaixo do limite,
-- o gerente já finaliza direto; acima, fica "aguardando_aprovacao" até o
-- dono decidir. Prazo mínimo de validade (PA-20) fica adiado — a validade
-- de cada lote já é visível na comparação, sem bloqueio automático ainda.
--
-- RF-REC-07/RN-EST-08 (comparação só para quem decide): get_receiving_comparison
-- é a única função que junta esperado x contado, e só devolve algo para
-- dono/gerente — nunca para o conferente (mesma blindagem do B4.2, agora
-- pelo lado de quem tem permissão de ver o resultado).
--
-- RN-REC-09 (entrada pela quantidade física aceita): finalize_receiving
-- lança uma entrada por item CONTADO (preservando o lote de cada contagem
-- individual, não um agregado por produto) — nunca pela quantidade só
-- documental. RN-REC-08 (lote e endereço): o endereço de destino é
-- escolhido por quem finaliza; o lote é criado/reaproveitado no destino via
-- get_or_create_lot (B3.3), com o mesmo número/validade informados na
-- contagem (B4.2).
--
-- Recontagem e recusa (RF-REC-08, a outra metade) ficam para o B4.4 — não
-- construir agora seria inventar um fluxo que a decisão ainda não cobre.

alter table public.receivings
  add column finalized_at timestamptz,
  add column finalized_by uuid references auth.users (id);

-- Comparação esperado x contado — só para quem vai decidir (dono/gerente).
create function public.get_receiving_comparison(p_receiving_id uuid)
returns table (
  product_id uuid,
  product_name text,
  expected_quantity numeric,
  counted_quantity numeric,
  difference numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_market_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para ver a comparação do recebimento';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.markets m where m.id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para ver a comparação deste recebimento';
  end if;

  return query
    with expected as (
      select ri.product_id, ri.expected_quantity
      from public.receiving_items ri
      where ri.receiving_id = p_receiving_id
    ), counted as (
      select rci.product_id, sum(rci.base_quantity) as total
      from public.receiving_counted_items rci
      where rci.receiving_id = p_receiving_id
      group by rci.product_id
    )
    select
      coalesce(e.product_id, c.product_id),
      p.name,
      coalesce(e.expected_quantity, 0),
      coalesce(c.total, 0),
      coalesce(c.total, 0) - coalesce(e.expected_quantity, 0)
    from expected e
    full outer join counted c on c.product_id = e.product_id
    join public.products p on p.id = coalesce(e.product_id, c.product_id);
end;
$$;
revoke all on function public.get_receiving_comparison(uuid) from public, anon;
grant execute on function public.get_receiving_comparison(uuid) to authenticated;

-- Decide e finaliza: sem divergência, lança direto; com divergência dentro
-- do limite da empresa, gerente já finaliza com justificativa; acima do
-- limite, só o dono finaliza (gerente fica "aguardando_aprovacao").
create function public.finalize_receiving(
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
  if v_receiving.status not in ('em_conferencia', 'aguardando_aprovacao') then
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

  -- PA-06: sem tolerância — qualquer diferença é divergência.
  for v_row in
    with expected as (
      select ri.product_id, ri.expected_quantity
      from public.receiving_items ri
      where ri.receiving_id = p_receiving_id
    ), counted as (
      select rci.product_id, sum(rci.base_quantity) as total
      from public.receiving_counted_items rci
      where rci.receiving_id = p_receiving_id
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
    return jsonb_build_object('status', 'aguardando_aprovacao');
  end if;

  if v_has_divergence then
    perform set_config('app.justification', p_justification, true);
  end if;

  -- RN-REC-09: uma entrada por item CONTADO, preservando o lote de cada
  -- contagem — nunca um lançamento pela quantidade só documental.
  for v_count_row in
    select * from public.receiving_counted_items where receiving_id = p_receiving_id
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

  return jsonb_build_object('status', 'finalizado', 'movements_posted', v_posted, 'had_divergence', v_has_divergence);
end;
$$;
revoke all on function public.finalize_receiving(uuid, uuid, text) from public, anon;
grant execute on function public.finalize_receiving(uuid, uuid, text) to authenticated;
