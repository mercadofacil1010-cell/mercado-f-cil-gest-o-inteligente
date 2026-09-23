-- B2.2 — Produtos, embalagens e conversões (RF-PROD-01..07, RN-PROD-01..03/06,
-- RN-CRT-EMB-01..04, PA-04, AUD-04).
--
-- O produto é o registro do catálogo (nome, código de barras, categoria,
-- marca, unidade base). As embalagens formam uma cadeia de conversão até a
-- unidade base (RN-CRT-EMB-03): cada uma guarda seu próprio fator, nunca é
-- apagada de verdade (RN-ACL-06) e, quando o fator muda, uma nova linha é
-- criada em vez de sobrescrever a antiga (DEC-B2, RN-PROD-02/RN-CRT-EMB-04) —
-- assim o histórico de movimentos (quando existir, no B3) sempre aponta para
-- o fator que valia no momento de cada movimento.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text check (description is null or char_length(description) <= 500),
  category_id uuid references public.categories (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  barcode text check (barcode is null or barcode ~ '^\d{6,14}$'),
  sku text check (sku is null or char_length(sku) <= 40),
  -- Unidade base do produto (RF-PROD-05): tudo se converte para ela (RN-PROD-01).
  base_unit text not null check (base_unit in ('unidade', 'quilograma', 'litro')),
  -- RF-PROD-06: produto pesável ou de medida fracionada.
  is_weighable boolean not null default false,
  -- RF-PROD-07: controle por lote e validade (a operação em si chega no B3.3).
  tracks_batch_expiry boolean not null default false,
  image_url text,
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.products is 'Catálogo de produtos (B2.2). Estoque, preço e lotes de verdade chegam no B2.3/B3.';

-- Código de barras único por empresa quando informado (mas dois produtos sem
-- código de barras não conflitam entre si).
create unique index products_company_barcode_key on public.products (company_id, barcode) where barcode is not null;

create index products_company_idx on public.products (company_id);
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_packagings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Nome livre (Unidade, Pacote, Caixa, Fardo...) — RF-PROD-03/RF-PROD-05 não fecham uma lista fixa.
  name text not null check (char_length(name) between 1 and 40),
  barcode text check (barcode is null or barcode ~ '^\d{6,14}$'),
  -- RN-CRT-EMB-01: toda embalagem tem fator em relação à unidade base.
  -- RN-PROD-03: fator não pode ser zero nem negativo.
  -- RN-PROD-06/RN-CRT-EMB-04: 3 casas decimais (kg/litro fracionado).
  conversion_factor numeric(12, 3) not null check (conversion_factor > 0),
  -- A embalagem "base" é a própria unidade base do produto: fator sempre 1.
  is_base boolean not null default false,
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_base or conversion_factor = 1)
);
comment on table public.product_packagings is 'Embalagens e fatores de conversão até a unidade base do produto (RN-CRT-EMB-01..04). Trocar o fator cria uma linha nova em vez de sobrescrever (preserva histórico).';

-- No máximo uma embalagem-base ativa por produto.
create unique index product_packagings_one_base_key on public.product_packagings (product_id) where is_base and status = 'active';

create index product_packagings_product_idx on public.product_packagings (product_id);

create trigger product_packagings_updated_at before update on public.product_packagings
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_packagings enable row level security;

-- Visível e editável por dono e gerente (PA-04, DEC-B1-10) — mesma regra do B2.1.
create policy "products_select" on public.products for select to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "products_insert" on public.products for insert to authenticated
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "products_update" on public.products for update to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));

create policy "product_packagings_select" on public.product_packagings for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and private.has_company_role(p.company_id, array['owner', 'manager']::public.member_role[])
  ));
create policy "product_packagings_insert" on public.product_packagings for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and private.has_company_role(p.company_id, array['owner', 'manager']::public.member_role[])
  ));
create policy "product_packagings_update" on public.product_packagings for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and private.has_company_role(p.company_id, array['owner', 'manager']::public.member_role[])
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and private.has_company_role(p.company_id, array['owner', 'manager']::public.member_role[])
  ));

-- Sem exclusão física (RN-ACL-06): inativar em vez de apagar.
revoke delete on public.products, public.product_packagings from authenticated, anon;

-- Auditoria (AUD-04): entram no mesmo mecanismo genérico do B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_products after insert or update on public.products
  for each row execute function private.audit_trigger();
create trigger audit_product_packagings after insert or update on public.product_packagings
  for each row execute function private.audit_trigger();
