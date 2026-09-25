-- B4.1 — Recebimento e itens esperados (RF-REC-01, PA-07, G-02).
--
-- Escopo decidido em DECISOES.md: nesta etapa só existe digitação manual dos
-- itens esperados — leitura do XML da NF-e fica para uma etapa dedicada
-- futura (formato fiscal complexo, fora de escopo agora).
--
-- Nota fiscal não é obrigatória (PA-07): dono/gerente pode criar um
-- recebimento sem nota (ex.: fornecedor ainda não enviou), mas precisa
-- informar o motivo, que fica gravado — "sempre auditado" da decisão.
--
-- RN-REC-01 (blindagem real, diferente do B3.6): o conferente (perfil
-- 'receiver') só enxerga o cabeçalho do recebimento (fornecedor, status) —
-- NUNCA os itens esperados (receiving_items). Isso é uma proteção de banco
-- de verdade, não só de tela, porque aqui existe um perfil dedicado sem o
-- acesso legítimo que o dono/gerente já tem (diferente da contagem de
-- inventário do B3.6, onde quem contava já podia ver o saldo). A tela real
-- de conferência cega (registrar a contagem, comparar só depois) é o B4.2 —
-- aqui só nasce o recebimento e a lista do que é esperado.

create type public.receiving_status as enum (
  'aguardando_recebimento',
  'em_conferencia',
  'com_divergencia',
  'aguardando_aprovacao',
  'finalizado',
  'recusado'
);

create table public.receivings (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete restrict,
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 60),
  order_reference text check (order_reference is null or char_length(order_reference) <= 120),
  -- PA-07: obrigatório só quando não há nota fiscal.
  no_invoice_reason text check (no_invoice_reason is null or char_length(btrim(no_invoice_reason)) > 0),
  status public.receiving_status not null default 'aguardando_recebimento',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint receivings_invoice_or_reason check (invoice_number is not null or no_invoice_reason is not null)
);
comment on table public.receivings is 'Recebimento de mercadoria por mercado (B4.1). Nota fiscal opcional, mas exige motivo quando ausente (PA-07).';

create index receivings_market_status_idx on public.receivings (market_id, status);

create table public.receiving_items (
  id uuid primary key default gen_random_uuid(),
  receiving_id uuid not null references public.receivings (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  expected_quantity numeric(12, 3) not null check (expected_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.receiving_items is 'Itens esperados de um recebimento (B4.1) — nunca visível ao conferente (RN-REC-01).';

create unique index receiving_items_receiving_product_key on public.receiving_items (receiving_id, product_id);

create trigger receiving_items_updated_at before update on public.receiving_items
  for each row execute function public.set_updated_at();

alter table public.receivings enable row level security;
alter table public.receiving_items enable row level security;

-- Cabeçalho: dono/gerente com acesso ao mercado E o conferente (receiver)
-- vinculado ao mercado — ele precisa ver que existe um recebimento para
-- trabalhar nele (B4.2), mas só o cabeçalho.
create policy "receivings_select" on public.receivings for select to authenticated
  using (
    private.has_company_role((select company_id from public.markets where id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select company_id from public.markets where id = market_id), array['manager', 'receiver']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

-- Itens esperados: só dono/gerente. Conferente nunca — RN-REC-01.
create policy "receiving_items_select" on public.receiving_items for select to authenticated
  using (exists (
    select 1 from public.receivings r
    join public.markets m on m.id = r.market_id
    where r.id = receiving_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

-- Toda escrita passa pelas funções abaixo (mesmo padrão do restante do B3/B4).
revoke insert, update, delete on public.receivings from authenticated, anon;
revoke insert, update, delete on public.receiving_items from authenticated, anon;

create function public.create_receiving(
  p_market_id uuid,
  p_supplier_id uuid default null,
  p_invoice_number text default null,
  p_order_reference text default null,
  p_no_invoice_reason text default null
)
returns public.receivings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_row public.receivings;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para criar um recebimento';
  end if;

  select company_id into v_company_id from public.markets where id = p_market_id;
  if v_company_id is null then
    raise exception 'Mercado não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(p_market_id))
  ) then
    raise exception 'Sem permissão para criar recebimento neste mercado';
  end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company_id
  ) then
    raise exception 'Fornecedor não pertence a esta empresa';
  end if;

  if (p_invoice_number is null or btrim(p_invoice_number) = '')
     and (p_no_invoice_reason is null or btrim(p_no_invoice_reason) = '') then
    raise exception 'Informe a nota fiscal ou o motivo do recebimento sem nota';
  end if;

  insert into public.receivings (market_id, supplier_id, invoice_number, order_reference, no_invoice_reason, created_by)
  values (
    p_market_id, p_supplier_id,
    nullif(btrim(coalesce(p_invoice_number, '')), ''),
    nullif(btrim(coalesce(p_order_reference, '')), ''),
    nullif(btrim(coalesce(p_no_invoice_reason, '')), ''),
    v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_receiving(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.create_receiving(uuid, uuid, text, text, text) to authenticated;

-- Adiciona (ou corrige, enquanto o recebimento ainda não começou a
-- conferência) a quantidade esperada de um produto.
create function public.add_receiving_item(
  p_receiving_id uuid,
  p_product_id uuid,
  p_expected_quantity numeric
)
returns public.receiving_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receiving public.receivings;
  v_company_id uuid;
  v_row public.receiving_items;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para adicionar um item esperado';
  end if;
  if p_expected_quantity is null or p_expected_quantity <= 0 then
    raise exception 'Informe uma quantidade esperada maior que zero';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
  end if;
  if v_receiving.status <> 'aguardando_recebimento' then
    raise exception 'Não é possível alterar os itens esperados depois que a conferência começou';
  end if;

  select company_id into v_company_id from public.markets where id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_receiving.market_id))
  ) then
    raise exception 'Sem permissão para alterar este recebimento';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id and p.company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  insert into public.receiving_items (receiving_id, product_id, expected_quantity)
  values (p_receiving_id, p_product_id, p_expected_quantity)
  on conflict (receiving_id, product_id) do update set expected_quantity = excluded.expected_quantity
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.add_receiving_item(uuid, uuid, numeric) from public, anon;
grant execute on function public.add_receiving_item(uuid, uuid, numeric) to authenticated;

-- Remove um item esperado adicionado por engano, só antes da conferência
-- começar (mesma janela do add_receiving_item).
create function public.remove_receiving_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.receiving_items;
  v_receiving public.receivings;
  v_company_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para remover um item esperado';
  end if;

  select * into v_item from public.receiving_items where id = p_id;
  if v_item.id is null then
    raise exception 'Item não encontrado';
  end if;

  select * into v_receiving from public.receivings where id = v_item.receiving_id;
  if v_receiving.status <> 'aguardando_recebimento' then
    raise exception 'Não é possível alterar os itens esperados depois que a conferência começou';
  end if;

  select company_id into v_company_id from public.markets where id = v_receiving.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_receiving.market_id))
  ) then
    raise exception 'Sem permissão para alterar este recebimento';
  end if;

  delete from public.receiving_items where id = p_id;
end;
$$;
revoke all on function public.remove_receiving_item(uuid) from public, anon;
grant execute on function public.remove_receiving_item(uuid) to authenticated;

-- Auditoria (AUD-05): estende o mecanismo genérico do B0.2.
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
  elsif entity = 'receiving_items' then
    return query
      select m.company_id, m.id
      from public.receivings r
      join public.markets m on m.id = r.market_id
      where r.id = (row_data ->> 'receiving_id')::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_receivings after insert or update on public.receivings
  for each row execute function private.audit_trigger();
create trigger audit_receiving_items after insert or update on public.receiving_items
  for each row execute function private.audit_trigger();
