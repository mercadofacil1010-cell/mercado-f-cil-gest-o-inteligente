-- B1.1 — Eventos de auditoria do login (AUD-01: login, logout, recuperação de
-- senha, bloqueio e falha de acesso). São eventos sem linha de tabela alterada
-- e, no caso de falha/bloqueio, sem usuário autenticado — por isso não usam
-- log_audit_event (que exige vínculo ativo numa empresa) nem uma empresa/mercado.
-- A lista de eventos é fechada para não virar uma porta para gravar qualquer
-- coisa na auditoria.

create function public.log_security_event(p_entity text, p_details jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_entity not in (
    'auth_login_success', 'auth_login_failed', 'auth_login_locked',
    'auth_logout', 'auth_password_reset_requested', 'auth_password_updated'
  ) then
    raise exception 'Evento de segurança não reconhecido: %', p_entity;
  end if;

  insert into public.audit_log (actor_id, action, entity, after, context)
  values ((select auth.uid()), 'event', p_entity, coalesce(p_details, '{}'::jsonb), private.request_context())
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.log_security_event(text, jsonb) is 'Registra eventos de login/sessão na auditoria (AUD-01). Lista de eventos fechada; chamável antes e depois do login.';

revoke execute on function public.log_security_event(text, jsonb) from public;
grant execute on function public.log_security_event(text, jsonb) to anon, authenticated;
