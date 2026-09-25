-- B3.6 — Inventário e contagem geral (RF-EST-04, RF-EST-05, G-04).
--
-- Escopo decidido em DECISOES.md: uma "contagem" é uma sessão aberta num
-- endereço de depósito, com vários produtos dentro. A pessoa digita a
-- quantidade contada de cada produto sem que a tela mostre o saldo teórico
-- (cega); só ao finalizar a contagem o banco calcula a diferença e gera um
-- movimento de ajuste automaticamente para cada item divergente — que, se
-- passar do limite de aprovação da empresa, cai na mesma fila do B3.4 (nada
-- de mecanismo novo). Produto com lote é contado só pelo total no endereço
-- (sem abrir por lote); o ajuste, quando precisa de lote, usa o mesmo
-- critério de sugestão FEFO/FIFO já usado nas saídas — sem nenhum lote com
-- saldo disponível para atribuir a sobra, a contagem desse item é recusada
-- na finalização e precisa ser corrigida direto em Movimentos.
--
-- Nota sobre "cega": diferente da conferência do B4 (que terá um perfil
-- "conferente" sem acesso ao esperado), aqui quem conta é o próprio
-- dono/gerente, que já tem acesso legítimo ao saldo do endereço. A cegueira
-- é de fluxo de tela (a tela de contagem não exibe o teórico), não uma
-- restrição de permissão no banco — não corresponde a inventar uma proteção
-- que a decisão não pediu.

create type public.inventory_count_status as enum ('aberta', 'finalizada');

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  warehouse_address_id uuid not null references public.warehouse_addresses (id) on delete restrict,
  status public.inventory_count_status not null default 'aberta',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  finalized_by uuid references auth.users (id),
  finalized_at timestamptz
);
comment on table public.inventory_counts is 'Sessão de contagem geral de um endereço de depósito (B3.6). Fica aberta até finalizar.';

create unique index inventory_counts_one_open_per_address
  on public.inventory_counts (warehouse_address_id)
  where status = 'aberta';

create table public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  inventory_count_id uuid not null references public.inventory_counts (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  counted_quantity numeric(12, 3) not null check (counted_quantity >= 0),
  -- Preenchidos só na finalização (RF-EST-05) — ficam nulos enquanto a
  -- contagem está aberta, reforçando que a tela nunca mostrou o teórico.
  theoretical_balance numeric(12, 3),
  difference numeric(12, 3),
  resulting_movement_status text check (resulting_movement_status in ('none', 'posted', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.inventory_count_items is 'Itens contados dentro de uma sessão de inventário (B3.6); um por produto.';

create unique index inventory_count_items_count_product_key
  on public.inventory_count_items (inventory_count_id, product_id);

create trigger inventory_count_items_updated_at before update on public.inventory_count_items
  for each row execute function public.set_updated_at();

alter table public.inventory_counts enable row level security;
alter table public.inventory_count_items enable row level security;

create policy "inventory_counts_select" on public.inventory_counts for select to authenticated
  using (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

create policy "inventory_count_items_select" on public.inventory_count_items for select to authenticated
  using (exists (
    select 1 from public.inventory_counts ic
    join public.warehouse_addresses wa on wa.id = ic.warehouse_address_id
    join public.markets m on m.id = wa.market_id
    where ic.id = inventory_count_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

-- Toda escrita passa pelas funções abaixo (mesmo padrão do ledger de B3.2).
revoke insert, update, delete on public.inventory_counts from authenticated, anon;
revoke insert, update, delete on public.inventory_count_items from authenticated, anon;

-- Abre uma nova sessão de contagem no endereço. Só uma sessão aberta por
-- endereço por vez (índice único parcial acima evita duas contagens
-- simultâneas confundindo os dados).
create function public.start_inventory_count(p_warehouse_address_id uuid)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_market_id uuid;
  v_row public.inventory_counts;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para iniciar uma contagem';
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
    raise exception 'Sem permissão para iniciar contagem neste mercado';
  end if;

  if exists (select 1 from public.inventory_counts where warehouse_address_id = p_warehouse_address_id and status = 'aberta') then
    raise exception 'Já existe uma contagem em aberto para este endereço';
  end if;

  insert into public.inventory_counts (warehouse_address_id, created_by)
  values (p_warehouse_address_id, v_user)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.start_inventory_count(uuid) from public, anon;
grant execute on function public.start_inventory_count(uuid) to authenticated;

-- Registra (ou corrige, enquanto a contagem estiver aberta) a quantidade
-- contada de um produto. Não revela o saldo teórico (contagem cega).
create function public.set_inventory_count_item(
  p_inventory_count_id uuid,
  p_product_id uuid,
  p_quantity numeric
)
returns public.inventory_count_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count public.inventory_counts;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.inventory_count_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para contar um item';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Informe uma quantidade contada válida (zero ou mais)';
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
    raise exception 'Sem permissão para contar itens neste mercado';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id and p.company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  insert into public.inventory_count_items (inventory_count_id, product_id, counted_quantity)
  values (p_inventory_count_id, p_product_id, p_quantity)
  on conflict (inventory_count_id, product_id) do update set counted_quantity = excluded.counted_quantity
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.set_inventory_count_item(uuid, uuid, numeric) from public, anon;
grant execute on function public.set_inventory_count_item(uuid, uuid, numeric) to authenticated;

-- Finaliza a contagem: para cada item, calcula o saldo teórico só agora,
-- compara com o contado e gera um movimento de ajuste para cada diferença
-- (reaproveitando register_stock_movement, inclusive a fila de aprovação
-- por limite do B3.4 quando a diferença passa do limite da empresa).
create function public.finalize_inventory_count(p_inventory_count_id uuid)
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_inventory_counts after insert or update on public.inventory_counts
  for each row execute function private.audit_trigger();
create trigger audit_inventory_count_items after insert or update on public.inventory_count_items
  for each row execute function private.audit_trigger();
