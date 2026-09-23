-- B0.1 — Correções da fundação conforme a Documentação Funcional v1.0.
-- Itens: D-01..D-06, D-08, D-09, E-03, RN-ACL-04, RN-ACL-06, RN-ACC-02, RN-ORG-03, RN-ORG-05, PA-03, PA-49.
-- O banco ainda não tem dados de clientes, por isso as mudanças de estrutura são diretas.

-- ---------------------------------------------------------------------------
-- 1. Validação de CPF e CNPJ com dígitos verificadores (D-06)
-- ---------------------------------------------------------------------------

create function public.is_valid_cpf(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  s int;
  r int;
begin
  if value is null or value !~ '^\d{11}$' or value ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := regexp_split_to_array(value, '')::int[];
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;

create function public.is_valid_cnpj(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
begin
  if value is null or value !~ '^\d{14}$' or value ~ '^(\d)\1{13}$' then
    return false;
  end if;
  d := regexp_split_to_array(value, '')::int[];
  s := 0;
  for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> d[13] then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = d[14];
end;
$$;

alter table public.profiles drop constraint profiles_cpf_check;
alter table public.profiles add constraint profiles_cpf_valid check (cpf is null or public.is_valid_cpf(cpf));

alter table public.companies drop constraint companies_cnpj_check;
alter table public.companies add constraint companies_cnpj_valid check (public.is_valid_cnpj(cnpj));

alter table public.markets drop constraint markets_cnpj_check;
alter table public.markets add constraint markets_cnpj_valid check (cnpj is null or public.is_valid_cnpj(cnpj));

-- ---------------------------------------------------------------------------
-- 2. Situação da conta separada da situação da assinatura (E-03)
-- ---------------------------------------------------------------------------

alter type public.company_status rename to subscription_status;
alter type public.subscription_status add value if not exists 'expired';
alter table public.companies rename column status to subscription_status;

create type public.account_status as enum ('pending', 'active', 'blocked', 'cancelled');
alter table public.companies add column account_status public.account_status not null default 'active';
comment on column public.companies.account_status is 'Situação da conta (cadastro/segurança): pending, active, blocked, cancelled.';
comment on column public.companies.subscription_status is 'Situação comercial da assinatura: trial, active, past_due, suspended, cancelled, expired.';

-- ---------------------------------------------------------------------------
-- 3. Mercados: ciclo de vida, funcionamento, código, nome e fuso (D-03, D-04, D-05, PA-49)
-- ---------------------------------------------------------------------------

alter table public.markets drop column status;
drop type public.market_status;

create type public.market_status as enum ('draft', 'awaiting_billing', 'active', 'suspended', 'inactive');
alter table public.markets add column status public.market_status not null default 'draft';
alter table public.markets add column is_open boolean not null default false;
alter table public.markets add column timezone text not null default 'America/Sao_Paulo';
comment on column public.markets.status is 'Ciclo de vida: draft → awaiting_billing → active ↔ suspended → inactive.';
comment on column public.markets.is_open is 'Funcionamento no momento (aberto/fechado), independente do ciclo de vida.';

alter table public.markets alter column internal_code drop not null;
alter table public.markets drop constraint markets_company_id_internal_code_key;
create unique index markets_company_internal_code_key on public.markets (company_id, lower(internal_code)) where internal_code is not null;
create unique index markets_company_name_key on public.markets (company_id, lower(name));

-- Transições permitidas do ciclo de vida do mercado.
create function public.check_market_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if not (
    (old.status = 'draft' and new.status in ('awaiting_billing', 'inactive'))
    or (old.status = 'awaiting_billing' and new.status in ('active', 'draft', 'inactive'))
    or (old.status = 'active' and new.status in ('suspended', 'inactive'))
    or (old.status = 'suspended' and new.status in ('active', 'inactive'))
  ) then
    raise exception 'Transição de situação do mercado não permitida: % → %', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger markets_status_transition before update of status on public.markets
  for each row execute function public.check_market_status_transition();

-- ---------------------------------------------------------------------------
-- 4. Vínculo de membros com vários mercados (D-01, RN-ACL-04, RN-ORG-05, PA-03)
-- ---------------------------------------------------------------------------

drop trigger company_members_check_market on public.company_members;
drop function public.check_member_market();
drop index public.company_members_market_id_idx;
alter table public.company_members drop column market_id;

create table public.member_markets (
  member_id uuid not null references public.company_members (id) on delete restrict,
  market_id uuid not null references public.markets (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (member_id, market_id)
);
create index member_markets_market_id_idx on public.member_markets (market_id);
comment on table public.member_markets is 'Mercados a que cada membro tem acesso. O dono (owner) acessa todos os mercados sem precisar de linhas aqui.';

-- O mercado vinculado precisa ser da mesma empresa do membro.
create function public.check_member_market()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.company_members cm
    join public.markets m on m.company_id = cm.company_id
    where cm.id = new.member_id and m.id = new.market_id
  ) then
    raise exception 'O mercado informado não pertence à empresa deste membro';
  end if;
  return new;
end;
$$;

create trigger member_markets_check before insert or update on public.member_markets
  for each row execute function public.check_member_market();

-- ---------------------------------------------------------------------------
-- 5. Nunca apagar histórico: inativar em vez de excluir (D-02, RN-ACL-06, RN-ORG-03)
-- ---------------------------------------------------------------------------

drop policy "markets_delete_owner" on public.markets;
drop policy "members_delete_owner" on public.company_members;

alter table public.markets drop constraint markets_company_id_fkey;
alter table public.markets add constraint markets_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;
alter table public.company_members drop constraint company_members_company_id_fkey;
alter table public.company_members add constraint company_members_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

revoke delete on public.companies, public.markets, public.company_members, public.profiles, public.platform_admins
  from anon, authenticated;
revoke truncate on public.companies, public.markets, public.company_members, public.profiles, public.platform_admins, public.member_markets
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Sempre ao menos um dono ativo (D-08, RN-ACC-02)
-- ---------------------------------------------------------------------------

create function public.ensure_active_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active')
     and not exists (
       select 1 from public.company_members cm
       where cm.company_id = old.company_id and cm.id <> old.id
         and cm.role = 'owner' and cm.status = 'active'
     ) then
    raise exception 'A empresa precisa manter ao menos um dono ativo';
  end if;
  return new;
end;
$$;

create trigger company_members_keep_owner before update on public.company_members
  for each row execute function public.ensure_active_owner();

-- ---------------------------------------------------------------------------
-- 7. Funções de autorização atualizadas
-- ---------------------------------------------------------------------------

-- Acesso ao mercado: dono ativo acessa todos; demais, somente os mercados vinculados.
create or replace function private.can_access_market(target_market uuid)
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
      and (
        cm.role = 'owner'
        or exists (select 1 from public.member_markets mm where mm.member_id = cm.id and mm.market_id = m.id)
      )
  );
$$;

-- Gestor enxerga perfis das pessoas que compartilham mercado com ele (dono: toda a empresa).
create or replace function private.manages_user(target_user uuid)
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
      and other.user_id = target_user
      and (
        me.role = 'owner'
        or (
          me.role = 'manager'
          and exists (
            select 1
            from public.member_markets a
            join public.member_markets b on b.market_id = a.market_id
            where a.member_id = me.id and b.member_id = other.id
          )
        )
      )
  );
$$;

-- Gerente ativo vê membros que compartilham mercado com ele (conferente e repositor não veem a equipe).
create function private.shares_market_with(target_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members me
    join public.member_markets a on a.member_id = me.id
    join public.member_markets b on b.market_id = a.market_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and me.role = 'manager'
      and b.member_id = target_member
  );
$$;

revoke execute on function private.shares_market_with(uuid) from public, anon;
grant execute on function private.shares_market_with(uuid) to authenticated;

-- Dono da empresa do membro.
create function private.owns_member_company(target_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members target
    join public.company_members me on me.company_id = target.company_id
    where target.id = target_member
      and me.user_id = (select auth.uid())
      and me.role = 'owner'
      and me.status = 'active'
  );
$$;

revoke execute on function private.owns_member_company(uuid) from public, anon;
grant execute on function private.owns_member_company(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Políticas de acesso revisadas
-- ---------------------------------------------------------------------------

-- Perfis: administrador da plataforma não lê CPF e dados pessoais do cliente (D-09).
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.manages_user(id));

-- Membros: próprio vínculo, dono vê todos, gerente vê quem compartilha mercado.
drop policy "members_select" on public.company_members;
create policy "members_select" on public.company_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_company_role(company_id, array['owner']::public.member_role[])
    or private.shares_market_with(id)
    or private.is_platform_admin()
  );

-- Vínculos de mercado: o próprio membro, o dono e o gerente que compartilha mercado veem;
-- somente o dono cria ou remove vínculos (gerente convidando equipe: B1.5). Remoções serão auditadas (B0.2).
alter table public.member_markets enable row level security;
create policy "member_markets_select" on public.member_markets for select to authenticated
  using (
    private.owns_member_company(member_id)
    or exists (select 1 from public.company_members cm where cm.id = member_id and cm.user_id = (select auth.uid()))
    or private.shares_market_with(member_id)
  );
create policy "member_markets_insert_owner" on public.member_markets for insert to authenticated
  with check (private.owns_member_company(member_id));
create policy "member_markets_delete_owner" on public.member_markets for delete to authenticated
  using (private.owns_member_company(member_id));
revoke update on public.member_markets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. create_company: situação da conta ativa e assinatura em teste
-- ---------------------------------------------------------------------------

create or replace function public.create_company(
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
    account_status, subscription_status, trial_ends_at, created_by
  ) values (
    trim(p_legal_name), trim(p_trade_name), regexp_replace(p_cnpj, '\D', '', 'g'), nullif(trim(p_state_registration), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g'), ''), p_street, p_number, p_complement, p_district, p_city,
    upper(nullif(trim(p_state), '')), p_segment, p_product_range, coalesce(p_has_pos, false), p_pos_name,
    'active',
    case when p_start_trial then 'trial'::public.subscription_status else 'active'::public.subscription_status end,
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
