-- Etapa 1 — Fundação multiempresa do Mercado Fácil.
-- Empresas (clientes da plataforma), mercados, perfis, membros com papéis,
-- administradores da plataforma e regras de acesso (RLS) por empresa.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'manager', 'receiver', 'stocker');
comment on type public.member_role is 'owner = dono da rede, manager = gerente, receiver = conferente, stocker = repositor';

create type public.member_status as enum ('active', 'invited', 'disabled');
create type public.company_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.market_status as enum ('open', 'closed', 'inactive');

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  cpf text check (cpf is null or cpf ~ '^\d{11}$'),
  birth_date date,
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.cpf is 'Somente dígitos. Dado pessoal (LGPD): visível apenas ao próprio usuário e aos gestores da empresa.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Administradores da plataforma
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.platform_admins is 'Proprietários da plataforma. Inserção somente via SQL/painel do Supabase.';

-- ---------------------------------------------------------------------------
-- Empresas e mercados
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 3 and 160),
  trade_name text not null check (char_length(trade_name) between 2 and 120),
  cnpj text not null unique check (cnpj ~ '^\d{14}$'),
  state_registration text check (char_length(state_registration) <= 30),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  zip_code text check (zip_code is null or zip_code ~ '^\d{8}$'),
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  segment text,
  product_range text,
  has_pos boolean not null default false,
  pos_name text,
  status public.company_status not null default 'trial',
  trial_ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  legal_name text,
  cnpj text check (cnpj is null or cnpj ~ '^\d{14}$'),
  uses_parent_cnpj boolean not null default false,
  internal_code text not null check (char_length(internal_code) between 2 and 30),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  email text,
  opening_hours text,
  status public.market_status not null default 'open',
  zip_code text check (zip_code is null or zip_code ~ '^\d{8}$'),
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  reference text,
  checkouts integer check (checkouts is null or checkouts >= 0),
  warehouses integer check (warehouses is null or warehouses >= 0),
  employees integer check (employees is null or employees >= 0),
  area_m2 numeric(10, 2) check (area_m2 is null or area_m2 >= 0),
  pos_system text,
  has_barcode_readers boolean not null default false,
  has_label_printer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, internal_code)
);

create index markets_company_id_idx on public.markets (company_id);

create trigger markets_updated_at before update on public.markets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membros da empresa (quem acessa o quê)
-- ---------------------------------------------------------------------------

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  -- null = acesso a todos os mercados da empresa
  market_id uuid references public.markets (id) on delete cascade,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members (user_id);
create index company_members_market_id_idx on public.company_members (market_id);

create trigger company_members_updated_at before update on public.company_members
  for each row execute function public.set_updated_at();

-- O mercado de um membro precisa pertencer à mesma empresa.
create function public.check_member_market()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.market_id is not null and not exists (
    select 1 from public.markets m where m.id = new.market_id and m.company_id = new.company_id
  ) then
    raise exception 'O mercado informado não pertence a esta empresa';
  end if;
  return new;
end;
$$;

create trigger company_members_check_market before insert or update on public.company_members
  for each row execute function public.check_member_market();

-- A empresa de um mercado ou de um vínculo nunca muda depois de criada.
create function public.prevent_company_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'Não é permitido mover o registro para outra empresa';
  end if;
  return new;
end;
$$;

create trigger markets_lock_company before update on public.markets
  for each row execute function public.prevent_company_change();
create trigger company_members_lock_company before update on public.company_members
  for each row execute function public.prevent_company_change();

-- ---------------------------------------------------------------------------
-- Funções de autorização (security definer evita recursão nas políticas)
-- ---------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create function public.has_company_role(target_company uuid, roles public.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and (roles is null or cm.role = any (roles))
  );
$$;

-- Acesso a um mercado: membro ativo da empresa com acesso a todos os mercados
-- ou vinculado àquele mercado específico.
create function public.can_access_market(target_market uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.markets m
    join public.company_members cm on cm.company_id = m.company_id
    where m.id = target_market
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and (cm.market_id is null or cm.market_id = m.id)
  );
$$;

-- Dois usuários compartilham alguma empresa em que o solicitante é gestor.
create function public.manages_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members other on other.company_id = me.company_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and me.role in ('owner', 'manager')
      and other.user_id = target_user
  );
$$;

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.has_company_role(uuid, public.member_role[]) from public, anon;
revoke execute on function public.can_access_market(uuid) from public, anon;
revoke execute on function public.manages_user(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_company_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.can_access_market(uuid) to authenticated;
grant execute on function public.manages_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Criação da empresa no cadastro (atômica: empresa + dono)
-- ---------------------------------------------------------------------------

create function public.create_company(
  p_legal_name text,
  p_trade_name text,
  p_cnpj text,
  p_state_registration text default null,
  p_phone text default null,
  p_email text default null,
  p_zip_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_segment text default null,
  p_product_range text default null,
  p_has_pos boolean default false,
  p_pos_name text default null,
  p_start_trial boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para criar uma empresa';
  end if;

  insert into public.companies (
    legal_name, trade_name, cnpj, state_registration, phone, email, zip_code, street, number,
    complement, district, city, state, segment, product_range, has_pos, pos_name,
    status, trial_ends_at, created_by
  ) values (
    trim(p_legal_name), trim(p_trade_name), regexp_replace(p_cnpj, '\D', '', 'g'), nullif(trim(p_state_registration), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g'), ''), p_street, p_number, p_complement, p_district, p_city,
    upper(nullif(trim(p_state), '')), p_segment, p_product_range, coalesce(p_has_pos, false), p_pos_name,
    case when p_start_trial then 'trial'::public.company_status else 'active'::public.company_status end,
    case when p_start_trial then now() + interval '15 days' else null end,
    v_user
  )
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company, v_user, 'owner', 'active');

  return v_company;
end;
$$;

revoke execute on function public.create_company from public, anon;
grant execute on function public.create_company to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.companies enable row level security;
alter table public.markets enable row level security;
alter table public.company_members enable row level security;

-- Perfis: o próprio usuário, gestores da mesma empresa e administradores.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.manages_user(id) or public.is_platform_admin());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Administradores: cada um vê o próprio registro; alterações só pelo painel do Supabase.
create policy "platform_admins_select_own" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Empresas: membros veem; dono edita; criação apenas pela função create_company.
create policy "companies_select" on public.companies for select to authenticated
  using (public.has_company_role(id) or public.is_platform_admin());
create policy "companies_update_owner" on public.companies for update to authenticated
  using (public.has_company_role(id, array['owner']::public.member_role[]) or public.is_platform_admin())
  with check (public.has_company_role(id, array['owner']::public.member_role[]) or public.is_platform_admin());

-- Mercados: quem tem acesso vê; dono cria/exclui; dono e gerente editam.
create policy "markets_select" on public.markets for select to authenticated
  using (public.can_access_market(id) or public.is_platform_admin());
create policy "markets_insert_owner" on public.markets for insert to authenticated
  with check (public.has_company_role(company_id, array['owner']::public.member_role[]));
create policy "markets_update_managers" on public.markets for update to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[])
         or (public.has_company_role(company_id, array['manager']::public.member_role[]) and public.can_access_market(id)))
  with check (public.has_company_role(company_id, array['owner', 'manager']::public.member_role[]));
create policy "markets_delete_owner" on public.markets for delete to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[]));

-- Membros: cada um vê o próprio vínculo; gestores veem a equipe; só o dono gerencia.
create policy "members_select" on public.company_members for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_company_role(company_id, array['owner', 'manager']::public.member_role[])
         or public.is_platform_admin());
create policy "members_insert_owner" on public.company_members for insert to authenticated
  with check (public.has_company_role(company_id, array['owner']::public.member_role[]));
create policy "members_update_owner" on public.company_members for update to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[]) and user_id <> (select auth.uid()))
  with check (public.has_company_role(company_id, array['owner']::public.member_role[]));
create policy "members_delete_owner" on public.company_members for delete to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[]) and user_id <> (select auth.uid()));
