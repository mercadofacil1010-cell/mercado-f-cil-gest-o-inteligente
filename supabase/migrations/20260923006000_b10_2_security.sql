-- B10.2 — Segurança reforçada (RNF-SEC-02/03). RNF-SEC-02 já estava, em boa
-- parte, coberta desde o B1.1 (bloqueio de login, política de senha,
-- auditoria de eventos de segurança) — a parte de "tokens e integrações"
-- ainda não se aplica: o conector real do PDV (B7.4) depende do piloto
-- (B10.5, ainda não decidido) e não existe token/webhook para proteger
-- hoje. RNF-SEC-03: as duas ações mais irreversíveis do sistema
-- (cancelar assinatura, eliminar dados de contato) passam a exigir uma
-- confirmação adicional verificada no servidor — digitar o CNPJ exato da
-- empresa, não só marcar uma caixinha — antes de executar.
\set ON_ERROR_STOP 1

-- admin_cancel_subscription (B9.5) — assinatura muda de tamanho (novo
-- parâmetro obrigatório), então precisa de DROP explícito antes do
-- CREATE (mesmo motivo do create_company no B9.1: `create or replace`
-- com outra lista de parâmetros vira uma sobrecarga nova e ambígua).
drop function public.admin_cancel_subscription(uuid, text);

create function public.admin_cancel_subscription(p_company_id uuid, p_reason text, p_confirm_cnpj text)
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
  if not exists (
    select 1 from public.companies
    where id = p_company_id and cnpj = regexp_replace(coalesce(p_confirm_cnpj, ''), '\D', '', 'g')
  ) then
    raise exception 'CNPJ de confirmação não confere — cancelamento não realizado';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set subscription_status = 'cancelled', past_due_since = null, cancelled_at = now()
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_cancel_subscription(uuid, text, text) from public, anon;
grant execute on function public.admin_cancel_subscription(uuid, text, text) to authenticated;

-- admin_process_erasure_request (B10.1) — mesmo motivo do drop acima.
drop function public.admin_process_erasure_request(uuid, text);

create function public.admin_process_erasure_request(p_company_id uuid, p_reason text, p_confirm_cnpj text)
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
  if not exists (
    select 1 from public.companies
    where id = p_company_id and cnpj = regexp_replace(coalesce(p_confirm_cnpj, ''), '\D', '', 'g')
  ) then
    raise exception 'CNPJ de confirmação não confere — eliminação não realizada';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set email = null, phone = null, data_anonymized_at = now()
  where id = p_company_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_process_erasure_request(uuid, text, text) from public, anon;
grant execute on function public.admin_process_erasure_request(uuid, text, text) to authenticated;
