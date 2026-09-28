-- B4.2 — Conferência cega protegida no servidor (RF-REC-02..07, RN-REC-01..03,
-- PA-08).
--
-- Decidido em DECISOES.md: o conferente inicia a própria conferência pela
-- rota /conferente (DEC-B4-03); identifica o produto digitando o código de
-- barras (câmera real fica para o B5.4, DEC-B4-02); só vê fornecedor/nota/
-- pedido/data do recebimento — nunca os itens esperados (PA-08/RN-REC-02,
-- que já são bloqueados desde o B4.1); evidência de contagem é só texto por
-- enquanto (DEC-B4-04, mesma decisão do B3.4 — foto fica para o B5.4).
--
-- RN-REC-01 (blindagem real de verdade): a contagem cega em si é só INSERT —
-- não existe nenhuma consulta nem função que devolva ao conferente o
-- esperado, a diferença ou o percentual. A comparação só existe no B4.3
-- (decisão/entrada no estoque), que é exclusiva de dono/gerente.
--
-- RN-REC-03: a conferência converte a quantidade contada (na embalagem que a
-- pessoa está usando, ex. "caixa de 12") para a unidade base do produto
-- (product_packagings.conversion_factor, já existente desde o B2.2),
-- guardando o valor convertido como um retrato do momento — igual à decisão
-- do B2.2 de nunca reescrever histórico quando o fator muda depois.

alter table public.receivings
  add column conference_started_at timestamptz,
  add column conference_started_by uuid references auth.users (id);

create type public.receiving_item_condition as enum (
  'bom_estado',
  'avariado',
  'embalagem_violada',
  'vencido'
);

create table public.receiving_counted_items (
  id uuid primary key default gen_random_uuid(),
  receiving_id uuid not null references public.receivings (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  packaging_id uuid not null references public.product_packagings (id) on delete restrict,
  counted_quantity numeric(12, 3) not null check (counted_quantity > 0),
  -- Retrato do fator de conversão no momento da contagem (RN-REC-03).
  base_quantity numeric(12, 3) not null check (base_quantity > 0),
  batch_number text check (batch_number is null or char_length(batch_number) <= 40),
  manufactured_at date,
  expires_at date,
  condition public.receiving_item_condition not null default 'bom_estado',
  note text check (note is null or char_length(note) <= 300),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint receiving_counted_items_dates check (
    manufactured_at is null or expires_at is null or manufactured_at <= expires_at
  )
);
comment on table public.receiving_counted_items is 'Itens contados fisicamente na conferência cega (B4.2) — a comparação com o esperado só acontece no B4.3.';

create index receiving_counted_items_receiving_idx on public.receiving_counted_items (receiving_id);

alter table public.receiving_counted_items enable row level security;

-- Mesmo escopo do cabeçalho do recebimento (dono/gerente/conferente com
-- acesso ao mercado) — a contagem em si nunca revela o esperado.
create policy "receiving_counted_items_select" on public.receiving_counted_items for select to authenticated
  using (exists (
    select 1 from public.receivings r
    join public.markets m on m.id = r.market_id
    where r.id = receiving_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (
          private.has_company_role(m.company_id, array['manager', 'receiver']::public.member_role[])
          and private.can_access_market(m.id)
        )
      )
  ));

revoke insert, update, delete on public.receiving_counted_items from authenticated, anon;

-- Inicia (ou retoma) a conferência: dono, gerente ou o próprio conferente
-- com acesso ao mercado. Idempotente enquanto ainda está "em_conferencia"
-- para permitir retomar depois de fechar o app no meio da contagem.
create function public.start_receiving_conference(p_receiving_id uuid)
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
    raise exception 'É preciso estar autenticado para iniciar uma conferência';
  end if;

  select * into v_receiving from public.receivings where id = p_receiving_id;
  if v_receiving.id is null then
    raise exception 'Recebimento não encontrado';
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

  if v_receiving.status = 'em_conferencia' then
    return v_receiving;
  end if;
  if v_receiving.status <> 'aguardando_recebimento' then
    raise exception 'Este recebimento já foi decidido — não é possível iniciar a conferência';
  end if;

  update public.receivings
  set status = 'em_conferencia', conference_started_at = now(), conference_started_by = v_user
  where id = p_receiving_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.start_receiving_conference(uuid) from public, anon;
grant execute on function public.start_receiving_conference(uuid) to authenticated;

-- Registra um item contado fisicamente. Nunca lê receiving_items — a
-- blindagem é estrutural, não uma checagem que poderia ser esquecida.
create function public.add_receiving_count(
  p_receiving_id uuid,
  p_product_id uuid,
  p_packaging_id uuid,
  p_quantity numeric,
  p_batch_number text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_condition public.receiving_item_condition default 'bom_estado',
  p_note text default null
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
  if v_receiving.status <> 'em_conferencia' then
    raise exception 'Este recebimento não está em conferência — inicie a conferência antes de contar';
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
    batch_number, manufactured_at, expires_at, condition, note, created_by
  )
  values (
    p_receiving_id, p_product_id, p_packaging_id, p_quantity, p_quantity * v_packaging.conversion_factor,
    nullif(btrim(coalesce(p_batch_number, '')), ''), p_manufactured_at, p_expires_at, p_condition,
    nullif(btrim(coalesce(p_note, '')), ''), v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.add_receiving_count(uuid, uuid, uuid, numeric, text, date, date, public.receiving_item_condition, text) from public, anon;
grant execute on function public.add_receiving_count(uuid, uuid, uuid, numeric, text, date, date, public.receiving_item_condition, text) to authenticated;

-- Remove um item contado por engano, só enquanto a conferência está aberta.
create function public.remove_receiving_count(p_id uuid)
returns void
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
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para remover uma contagem';
  end if;

  select * into v_item from public.receiving_counted_items where id = p_id;
  if v_item.id is null then
    raise exception 'Item contado não encontrado';
  end if;

  select * into v_receiving from public.receivings where id = v_item.receiving_id;
  if v_receiving.status <> 'em_conferencia' then
    raise exception 'Este recebimento não está mais em conferência';
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

  delete from public.receiving_counted_items where id = p_id;
end;
$$;
revoke all on function public.remove_receiving_count(uuid) from public, anon;
grant execute on function public.remove_receiving_count(uuid) to authenticated;

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
  elsif entity in ('receiving_items', 'receiving_counted_items') then
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

create trigger audit_receiving_counted_items after insert on public.receiving_counted_items
  for each row execute function private.audit_trigger();
