-- B10.1 — LGPD (RNF-LGPD-01/02/04, PA-36). Decisão do usuário: 90 dias após
-- o cancelamento para eliminar (anonimizar) os dados de contato da
-- empresa, com exportação disponível antes disso. RNF-LGPD-04
-- (controlador/operador/encarregado) fica registrada como estrutura, sem
-- nomes/contatos reais ainda — ver DECISOES.md.
\set ON_ERROR_STOP 1

alter table public.companies
  add column cancelled_at timestamptz,
  add column data_anonymized_at timestamptz;
comment on column public.companies.cancelled_at is 'Quando a assinatura foi cancelada (manual ou automaticamente). Base da contagem dos 90 dias de retenção (PA-36).';
comment on column public.companies.data_anonymized_at is 'Quando os dados de contato da empresa foram anonimizados (RNF-LGPD-02). Null enquanto não elimidados.';

-- admin_cancel_subscription (B9.5) passa a marcar quando o cancelamento
-- aconteceu, base para os 90 dias de retenção. Mesma assinatura — `create
-- or replace` basta.
create or replace function public.admin_cancel_subscription(p_company_id uuid, p_reason text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.companies;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma cancela uma assinatura';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo do cancelamento';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and subscription_status <> 'cancelled') then
    raise exception 'Empresa não encontrada ou já cancelada';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set subscription_status = 'cancelled', past_due_since = null, cancelled_at = now()
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;

-- process_subscription_delinquency (B9.5) idem no cancelamento automático
-- por 30 dias de atraso.
create or replace function public.process_subscription_delinquency()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancelled integer;
  v_suspended integer;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma processa a inadimplência';
  end if;

  perform set_config('app.justification', 'Processamento automático de inadimplência (30 dias em atraso).', true);
  with done as (
    update public.companies
    set subscription_status = 'cancelled', past_due_since = null, cancelled_at = now()
    where subscription_status in ('past_due', 'suspended') and past_due_since <= now() - interval '30 days'
    returning 1
  )
  select count(*) into v_cancelled from done;

  perform set_config('app.justification', 'Processamento automático de inadimplência (7 dias em atraso).', true);
  with done as (
    update public.companies
    set subscription_status = 'suspended'
    where subscription_status = 'past_due' and past_due_since <= now() - interval '7 days'
    returning 1
  )
  select count(*) into v_suspended from done;

  return jsonb_build_object('suspended', v_suspended, 'cancelled', v_cancelled);
end;
$$;

-- PA-36: 90 dias corridos desde o cancelamento, elimina (anonimiza) os
-- dados de contato da empresa. O cadastro em si (razão social, CNPJ,
-- histórico operacional) não é apagado — seguem o mesmo "sem exclusão
-- física" de sempre (RN-ACL-06); só o contato pessoal (e-mail/telefone)
-- é removido. A trilha de auditoria (audit_log) mantém os registros
-- históricos por 5 anos (PA-43, já decidido) — é uma exceção de interesse
-- legítimo/obrigação legal já prevista na LGPD, não um conflito com isto.
create function public.process_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anonymized integer;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma processa a retenção de dados';
  end if;

  perform set_config('app.justification', 'Eliminação automática de dados de contato após 90 dias de cancelamento (PA-36, LGPD).', true);
  with done as (
    update public.companies
    set email = null, phone = null, data_anonymized_at = now()
    where subscription_status = 'cancelled'
      and cancelled_at <= now() - interval '90 days'
      and data_anonymized_at is null
    returning 1
  )
  select count(*) into v_anonymized from done;

  return jsonb_build_object('anonymized', v_anonymized);
end;
$$;
revoke all on function public.process_data_retention() from public, anon;
grant execute on function public.process_data_retention() to authenticated;

-- RNF-LGPD-02: atendimento a uma solicitação de eliminação sob demanda,
-- sem esperar os 90 dias — só depois que a empresa já cancelou (uma
-- assinatura ativa não pode ter o contato apagado).
create function public.admin_process_erasure_request(p_company_id uuid, p_reason text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.companies;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma atende solicitação de eliminação de dados';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da solicitação de eliminação';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and subscription_status = 'cancelled') then
    raise exception 'Só é possível eliminar dados de contato de uma assinatura já cancelada';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set email = null, phone = null, data_anonymized_at = now()
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_process_erasure_request(uuid, text) from public, anon;
grant execute on function public.admin_process_erasure_request(uuid, text) to authenticated;

-- RNF-LGPD-02: direito de acesso/portabilidade — qualquer usuário pode
-- exportar os próprios dados pessoais (perfil e vínculos com empresas).
create function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile jsonb;
  v_memberships jsonb;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para exportar os próprios dados';
  end if;

  select to_jsonb(p) into v_profile from public.profiles p where p.id = v_user;

  select coalesce(jsonb_agg(jsonb_build_object(
    'companyId', cm.company_id,
    'companyName', c.trade_name,
    'role', cm.role,
    'status', cm.status,
    'memberSince', cm.created_at
  )), '[]'::jsonb)
  into v_memberships
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  where cm.user_id = v_user;

  return jsonb_build_object(
    'exportedAt', now(),
    'profile', v_profile,
    'companyMemberships', v_memberships
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- RNF-LGPD-02: portabilidade dos dados de cadastro da empresa (dono ou
-- administrador) — dados operacionais (vendas, estoque, recebimentos etc.)
-- já são exportáveis em CSV pela tela de Relatórios desde o B8.2.
create function public.export_company_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company jsonb;
  v_markets jsonb;
  v_members jsonb;
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso aos dados desta empresa';
  end if;

  select to_jsonb(c) into v_company from public.companies c where c.id = p_company_id;
  if v_company is null then
    raise exception 'Empresa não encontrada';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_markets
  from public.markets m where m.company_id = p_company_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role', cm.role,
    'status', cm.status,
    'memberSince', cm.created_at,
    'fullName', p.full_name
  )), '[]'::jsonb)
  into v_members
  from public.company_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.company_id = p_company_id;

  return jsonb_build_object(
    'exportedAt', now(),
    'company', v_company,
    'markets', v_markets,
    'members', v_members
  );
end;
$$;
revoke all on function public.export_company_data(uuid) from public, anon;
grant execute on function public.export_company_data(uuid) to authenticated;
