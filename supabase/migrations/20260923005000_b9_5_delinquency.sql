-- B9.5 — Inadimplência, suspensão e cancelamento (RF-BILL-07, RN-BILL-07/08,
-- RN-CRT-BIL-05, PA-34/35, F-5.6). Decisão do usuário: 7 dias em atraso
-- suspende, 30 dias corridos desde o atraso cancela; durante a suspensão,
-- só leitura (bloqueia pelo menos a operação mais claramente ligada à
-- assinatura — adicionar mercado novo; bloquear TODA operação em todo o
-- sistema exigiria revisar dezenas de funções de escrita já existentes
-- desde o B1, o que fica para uma etapa dedicada — ver DECISOES.md).
\set ON_ERROR_STOP 1

alter table public.companies
  add column past_due_since timestamptz;
comment on column public.companies.past_due_since is 'Desde quando a assinatura está em atraso (PA-34). Null fora de past_due/suspended.';

-- RF-BILL-07/PA-34: administrador registra que uma assinatura ativa entrou
-- em atraso (hoje isso seria automático via gateway — B9.3 ainda não
-- existe, então é o administrador quem sinaliza manualmente por enquanto).
create function public.admin_mark_past_due(p_company_id uuid, p_reason text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.companies;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma registra atraso de pagamento';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo do atraso registrado';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and subscription_status = 'active') then
    raise exception 'Só uma assinatura ativa pode ser marcada como em atraso';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set subscription_status = 'past_due', past_due_since = now()
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_mark_past_due(uuid, text) from public, anon;
grant execute on function public.admin_mark_past_due(uuid, text) to authenticated;

-- RF-BILL-07: reativação manual (pagamento regularizado) a partir de
-- atraso ou suspensão.
create function public.admin_reactivate_subscription(p_company_id uuid, p_reason text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.companies;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma reativa uma assinatura';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da reativação';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and subscription_status in ('past_due', 'suspended')) then
    raise exception 'Só é possível reativar uma assinatura em atraso ou suspensa';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set subscription_status = 'active', past_due_since = null
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_reactivate_subscription(uuid, text) from public, anon;
grant execute on function public.admin_reactivate_subscription(uuid, text) to authenticated;

-- RF-ADM-06/RF-BILL-07: cancelamento manual e imediato (sem esperar os
-- prazos automáticos), sempre com motivo.
create function public.admin_cancel_subscription(p_company_id uuid, p_reason text)
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
  set subscription_status = 'cancelled', past_due_since = null
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_cancel_subscription(uuid, text) from public, anon;
grant execute on function public.admin_cancel_subscription(uuid, text) to authenticated;

-- PA-34: 7 dias em atraso suspende; 30 dias corridos desde o início do
-- atraso cancela (mesmo que tenha pulado direto de "past_due" sem passar
-- pelo processamento dos 7 dias antes). Decisão do usuário — ver
-- DECISOES.md. Sem gateway (B9.3), este processamento roda sob demanda
-- (chamado pelo administrador); vira automático quando existir um
-- agendador de verdade.
create function public.process_subscription_delinquency()
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
    set subscription_status = 'cancelled', past_due_since = null
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
revoke all on function public.process_subscription_delinquency() from public, anon;
grant execute on function public.process_subscription_delinquency() to authenticated;

-- PA-35 (parcial — ver DECISOES.md): a partir do atraso (past_due) até o
-- cancelamento, pelo menos a operação mais diretamente ligada à assinatura
-- (adicionar um mercado novo) fica bloqueada. Nenhum dado é apagado — a
-- leitura continua liberada em todas as tabelas (RN-BILL-08).
drop policy "markets_insert_owner" on public.markets;
create policy "markets_insert_owner" on public.markets for insert to authenticated
  with check (
    private.has_company_role(company_id, array['owner']::public.member_role[])
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.subscription_status not in ('past_due', 'suspended', 'cancelled')
    )
  );
