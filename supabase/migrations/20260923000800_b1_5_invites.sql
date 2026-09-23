-- B1.5 — Convites e vínculos da equipe (RF-ORG-05, RN-ORG-04, G-06, AUD-02,
-- DEC-B1-06 prazo de 7 dias, DEC-B1-07 quem convida quem).
--
-- O convidado pode ainda não ter conta no Mercado Fácil, então o convite vive
-- numa tabela própria (não em company_members, que exige um user_id real) até
-- ser aceito.

create type public.invite_status as enum ('pending', 'accepted', 'revoked');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role public.member_role not null,
  status public.invite_status not null default 'pending',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- O dono nasce do cadastro (create_company); nunca é convidado (DEC-B1-07).
  check (role <> 'owner')
);

comment on table public.invites is 'Convites de equipe (B1.5). Prazo de 7 dias (DEC-B1-06); reenviar renova o prazo, sem trocar o token.';

create unique index invites_token_key on public.invites (token);
create index invites_company_idx on public.invites (company_id);
create index invites_email_idx on public.invites (lower(email));

create trigger invites_updated_at before update on public.invites
  for each row execute function public.set_updated_at();

create table public.invite_markets (
  invite_id uuid not null references public.invites (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  primary key (invite_id, market_id)
);

comment on table public.invite_markets is 'Mercados que o convite vai liberar quando aceito (vira member_markets).';

-- O mercado do convite precisa ser da mesma empresa do convite.
create function private.check_invite_market()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.invites i join public.markets m on m.company_id = i.company_id
    where i.id = new.invite_id and m.id = new.market_id
  ) then
    raise exception 'O mercado informado não pertence à empresa deste convite';
  end if;
  return new;
end;
$$;

create trigger invite_markets_check before insert or update on public.invite_markets
  for each row execute function private.check_invite_market();

alter table public.invites enable row level security;
alter table public.invite_markets enable row level security;

-- Leitura: dono vê todos os convites da empresa; quem convidou vê os que criou
-- (cobre o gerente, que só enxerga os próprios convites).
create policy "invites_select" on public.invites for select to authenticated
  using (
    private.has_company_role(company_id, array['owner']::public.member_role[])
    or invited_by = (select auth.uid())
  );
create policy "invite_markets_select" on public.invite_markets for select to authenticated
  using (exists (
    select 1 from public.invites i where i.id = invite_id and (
      private.has_company_role(i.company_id, array['owner']::public.member_role[])
      or i.invited_by = (select auth.uid())
    )
  ));

-- Ninguém grava direto: só as funções abaixo, que aplicam a regra de quem
-- pode convidar quem (DEC-B1-07) e o limite do gerente (G-06).
revoke all on public.invites, public.invite_markets from anon, authenticated;
grant select on public.invites, public.invite_markets to authenticated;

create function public.create_invite(p_company_id uuid, p_email text, p_role public.member_role, p_market_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_caller_role public.member_role;
  v_invite_id uuid;
  v_market_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para convidar';
  end if;
  if p_role = 'owner' then
    raise exception 'Não é possível convidar alguém como dono';
  end if;
  if p_email is null or btrim(p_email) = '' then
    raise exception 'Informe o e-mail da pessoa convidada';
  end if;

  select cm.role into v_caller_role
  from public.company_members cm
  where cm.company_id = p_company_id and cm.user_id = v_user and cm.status = 'active';

  if v_caller_role is null then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if v_caller_role = 'manager' then
    if p_role not in ('receiver', 'stocker') then
      raise exception 'Gerente só pode convidar conferente ou repositor';
    end if;
    if p_market_ids is null or array_length(p_market_ids, 1) is null then
      raise exception 'Informe ao menos um mercado para o convite';
    end if;
    -- Gerente não pode conceder acesso a um mercado que ele mesmo não tem (G-06).
    foreach v_market_id in array p_market_ids loop
      if not private.can_access_market(v_market_id) then
        raise exception 'Você não tem acesso a um dos mercados informados';
      end if;
    end loop;
  elsif v_caller_role <> 'owner' then
    raise exception 'Sem permissão para convidar';
  end if;

  insert into public.invites (company_id, email, role, invited_by)
  values (p_company_id, lower(btrim(p_email)), p_role, v_user)
  returning id into v_invite_id;

  if p_market_ids is not null then
    foreach v_market_id in array p_market_ids loop
      insert into public.invite_markets (invite_id, market_id) values (v_invite_id, v_market_id);
    end loop;
  end if;

  return v_invite_id;
end;
$$;

comment on function public.create_invite(uuid, text, public.member_role, uuid[]) is 'Cria convite de equipe aplicando DEC-B1-07 (quem convida quem) e G-06 (gerente não concede mais acesso do que tem).';

revoke execute on function public.create_invite(uuid, text, public.member_role, uuid[]) from public, anon;
grant execute on function public.create_invite(uuid, text, public.member_role, uuid[]) to authenticated;

-- Reenviar: renova os 7 dias (DEC-B1-06), sem trocar o link. Só quem convidou ou o dono.
create function public.resend_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.invites;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if v_invite.id is null then
    raise exception 'Convite não encontrado';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Este convite não está mais pendente';
  end if;
  if not (v_invite.invited_by = v_user or private.has_company_role(v_invite.company_id, array['owner']::public.member_role[])) then
    raise exception 'Sem permissão para reenviar este convite';
  end if;

  update public.invites set expires_at = now() + interval '7 days' where id = p_invite_id;
end;
$$;

revoke execute on function public.resend_invite(uuid) from public, anon;
grant execute on function public.resend_invite(uuid) to authenticated;

-- Revogar: só quem convidou ou o dono, e só enquanto pendente.
create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.invites;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if v_invite.id is null then
    raise exception 'Convite não encontrado';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Este convite não está mais pendente';
  end if;
  if not (v_invite.invited_by = v_user or private.has_company_role(v_invite.company_id, array['owner']::public.member_role[])) then
    raise exception 'Sem permissão para revogar este convite';
  end if;

  update public.invites set status = 'revoked' where id = p_invite_id;
end;
$$;

revoke execute on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- Prévia do convite (tela de aceite, antes de logar): só o que é preciso para
-- a pessoa saber para qual empresa/papel está sendo chamada. O token é
-- imprevisível (uuid aleatório), então não dá pra "adivinhar" outro convite.
create function public.get_invite_preview(p_token uuid)
returns table (email text, role public.member_role, company_name text, status public.invite_status, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, i.role, c.trade_name, i.status, i.expires_at
  from public.invites i
  join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

revoke execute on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

-- Aceitar convite: exige sessão de verdade e o e-mail da conta batendo com o
-- do convite (evita alguém aceitar um convite que não é dele mesmo com o link).
create function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_invite public.invites;
  v_member_id uuid;
  v_market_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para aceitar o convite';
  end if;

  select email into v_email from auth.users where id = v_user;

  select * into v_invite from public.invites where token = p_token for update;
  if v_invite.id is null then
    raise exception 'Convite não encontrado';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Este convite já foi usado ou revogado';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Este convite expirou';
  end if;
  if v_email is null or lower(v_email) <> v_invite.email then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_invite.company_id, v_user, v_invite.role, 'active')
  on conflict (company_id, user_id) do update set role = excluded.role, status = 'active'
  returning id into v_member_id;

  for v_market_id in select market_id from public.invite_markets where invite_id = v_invite.id loop
    insert into public.member_markets (member_id, market_id) values (v_member_id, v_market_id)
    on conflict do nothing;
  end loop;

  update public.invites set status = 'accepted', accepted_at = now(), accepted_by = v_user where id = v_invite.id;

  return v_invite.company_id;
end;
$$;

revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Auditoria (AUD-02): convites entram no mesmo mecanismo genérico de B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_invites after insert or update on public.invites
  for each row execute function private.audit_trigger();
