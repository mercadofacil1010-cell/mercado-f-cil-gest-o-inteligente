-- B0.2 — Trilha de auditoria (RNF-AUD-01, RNF-AUD-02, RN-ACL-05, RN-RPT-02, RN-RPT-03, D-10, G-07).
-- Registra quem fez o quê, quando, em qual empresa e mercado, com valores antes e depois.
-- O registro não pode ser alterado nem apagado por usuários do sistema.

-- ---------------------------------------------------------------------------
-- 1. Contexto da requisição (dispositivo, origem e justificativa)
-- ---------------------------------------------------------------------------

-- O app envia esses dados por requisição (cabeçalhos do PostgREST ou set_config).
-- Decisão DEC-B0-03: "dispositivo" = navegador/aparelho + IP + identificador do app.
create function private.request_context()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb;
begin
  begin
    headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    headers := '{}'::jsonb;
  end;
  return jsonb_strip_nulls(jsonb_build_object(
    'device', nullif(current_setting('app.device', true), ''),
    'user_agent', headers ->> 'user-agent',
    'ip', coalesce(nullif(current_setting('app.ip', true), ''), headers ->> 'x-forwarded-for'),
    'origin', headers ->> 'origin',
    'justification', nullif(current_setting('app.justification', true), '')
  ));
end;
$$;

revoke execute on function private.request_context() from public, anon;
grant execute on function private.request_context() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabela de auditoria
-- ---------------------------------------------------------------------------

create type public.audit_action as enum ('insert', 'update', 'delete', 'event');

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text,
  company_id uuid references public.companies (id) on delete set null,
  market_id uuid references public.markets (id) on delete set null,
  action public.audit_action not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  changed_fields text[],
  context jsonb not null default '{}'::jsonb,
  -- Guarda o horário absoluto (UTC) e o fuso do mercado (PA-49).
  market_timezone text
);

comment on table public.audit_log is 'Trilha de auditoria. Registro imutável: sem UPDATE nem DELETE para usuários do sistema. Retenção: 5 anos (PA-43).';
comment on column public.audit_log.context is 'Dispositivo, navegador, IP, origem e justificativa da ação (DEC-B0-03).';
comment on column public.audit_log.changed_fields is 'Campos alterados, para facilitar a consulta.';

create index audit_log_company_idx on public.audit_log (company_id, occurred_at desc);
create index audit_log_market_idx on public.audit_log (market_id, occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 3. Imutabilidade (RNF-AUD-02, RN-RPT-02, RN-RPT-03)
-- ---------------------------------------------------------------------------

create function private.audit_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A trilha de auditoria não pode ser alterada nem apagada';
end;
$$;

create trigger audit_log_no_update before update on public.audit_log
  for each statement execute function private.audit_is_append_only();
create trigger audit_log_no_delete before delete on public.audit_log
  for each statement execute function private.audit_is_append_only();

-- Ninguém escreve direto: apenas os gatilhos (security definer) e a função de evento.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Registro automático das tabelas auditadas
-- ---------------------------------------------------------------------------

-- Descobre a empresa e o mercado a partir da linha alterada.
create function private.audit_scope(entity text, row_data jsonb)
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create function private.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_row jsonb := coalesce(v_after, v_before);
  v_company uuid;
  v_market uuid;
  v_changed text[];
  v_entity_id text := v_row ->> coalesce(tg_argv[0], 'id');
  v_tz text;
begin
  -- Não registra alterações que não mudaram nada.
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into v_changed
    from jsonb_each(v_after) a
    where a.value is distinct from v_before -> a.key;
    if v_changed is null or v_changed = array['updated_at'] then
      return new;
    end if;
  end if;

  select s.company_id, s.market_id into v_company, v_market from private.audit_scope(tg_table_name, v_row) s;
  if v_market is not null then
    select m.timezone into v_tz from public.markets m where m.id = v_market;
  end if;

  insert into public.audit_log (
    actor_id, actor_role, company_id, market_id, action, entity, entity_id,
    before, after, changed_fields, context, market_timezone
  ) values (
    (select auth.uid()),
    (select cm.role::text from public.company_members cm
      where cm.user_id = (select auth.uid()) and (v_company is null or cm.company_id = v_company)
      order by case cm.role when 'owner' then 0 when 'manager' then 1 else 2 end limit 1),
    v_company, v_market, lower(tg_op)::public.audit_action, tg_table_name, v_entity_id,
    v_before, v_after, v_changed, private.request_context(), v_tz
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function private.audit_trigger();
create trigger audit_markets after insert or update or delete on public.markets
  for each row execute function private.audit_trigger();
create trigger audit_company_members after insert or update or delete on public.company_members
  for each row execute function private.audit_trigger();
create trigger audit_member_markets after insert or update or delete on public.member_markets
  for each row execute function private.audit_trigger('member_id');
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_trigger();
create trigger audit_platform_admins after insert or update or delete on public.platform_admins
  for each row execute function private.audit_trigger('user_id');

-- ---------------------------------------------------------------------------
-- 5. Eventos que não são mudanças de linha (login, exportação, acesso de suporte)
-- ---------------------------------------------------------------------------

-- Evento exige vínculo ativo na empresa/mercado informados (não basta estar logado).
create function public.log_audit_event(
  p_entity text,
  p_entity_id text default null,
  p_company_id uuid default null,
  p_market_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id bigint;
  v_role text;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um evento';
  end if;

  if p_company_id is not null then
    select cm.role::text into v_role
    from public.company_members cm
    where cm.company_id = p_company_id and cm.user_id = v_user and cm.status = 'active'
    order by case cm.role when 'owner' then 0 when 'manager' then 1 else 2 end
    limit 1;
    if v_role is null then
      raise exception 'Sem acesso a esta empresa';
    end if;
  end if;

  if p_market_id is not null and not private.can_access_market(p_market_id) then
    raise exception 'Sem acesso a este mercado';
  end if;

  insert into public.audit_log (
    actor_id, actor_role, company_id, market_id, action, entity, entity_id, after, context, market_timezone
  ) values (
    v_user, v_role, p_company_id, p_market_id, 'event', p_entity, p_entity_id,
    coalesce(p_details, '{}'::jsonb), private.request_context(),
    (select m.timezone from public.markets m where m.id = p_market_id)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.log_audit_event(text, text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.log_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Quem pode consultar a auditoria (matriz 2.2)
-- ---------------------------------------------------------------------------
-- Dono: auditoria da empresa. Gerente: dos mercados vinculados. Demais: as próprias ações.
-- Administrador da plataforma: somente registros sem empresa (ações da própria plataforma).

alter table public.audit_log enable row level security;

create policy "audit_select" on public.audit_log for select to authenticated
  using (
    actor_id = (select auth.uid())
    or (company_id is not null and private.has_company_role(company_id, array['owner']::public.member_role[]))
    or (market_id is not null and private.has_company_role(company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
    or (company_id is null and private.is_platform_admin())
  );

