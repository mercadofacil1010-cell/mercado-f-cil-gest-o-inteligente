-- B2.1 — Fornecedores, categorias e marcas (G-01, PA-23).
-- Cadastros de apoio ao catálogo: usados em produtos (B2.2), recebimento (B4) e
-- ponto de pedido (B2.3/B5). Pertencem à empresa (não a um mercado específico):
-- o catálogo é compartilhado entre todos os mercados da rede.

create type public.support_status as enum ('active', 'inactive');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  cnpj text check (cnpj is null or cnpj ~ '^\d{14}$'),
  contact_name text check (contact_name is null or char_length(contact_name) <= 160),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.suppliers is 'Fornecedores (G-01): cadastro de apoio usado por produtos, recebimento e ponto de pedido.';

create unique index suppliers_company_name_key on public.suppliers (company_id, lower(name));

create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.categories is 'Categorias de produto (B2.2): cadastro de apoio, compartilhado por toda a rede.';

create unique index categories_company_name_key on public.categories (company_id, lower(name));

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.brands is 'Marcas de produto (B2.2): cadastro de apoio, compartilhado por toda a rede.';

create unique index brands_company_name_key on public.brands (company_id, lower(name));

create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;

-- Visível e editável por dono e gerente (PA-04, DEC-B1-10): conferente e
-- repositor ainda não têm tela de catálogo (Correção 3, apps próprios não
-- construídos) — quando existirem, decide-se então se precisam de leitura aqui.
create policy "suppliers_select" on public.suppliers for select to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "suppliers_insert" on public.suppliers for insert to authenticated
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "suppliers_update" on public.suppliers for update to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));

create policy "categories_select" on public.categories for select to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "categories_insert" on public.categories for insert to authenticated
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "categories_update" on public.categories for update to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));

create policy "brands_select" on public.brands for select to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "brands_insert" on public.brands for insert to authenticated
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "brands_update" on public.brands for update to authenticated
  using (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));

-- Sem exclusão física (RN-ACL-06): inativar em vez de apagar — fornecedor,
-- categoria e marca podem estar referenciados em produtos e recebimentos.
revoke delete on public.suppliers, public.categories, public.brands from authenticated, anon;

-- Auditoria: entram no mesmo mecanismo genérico do B0.2.
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
  elsif entity in ('suppliers', 'categories', 'brands') then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_suppliers after insert or update on public.suppliers
  for each row execute function private.audit_trigger();
create trigger audit_categories after insert or update on public.categories
  for each row execute function private.audit_trigger();
create trigger audit_brands after insert or update on public.brands
  for each row execute function private.audit_trigger();
