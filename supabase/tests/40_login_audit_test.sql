-- Testes dos eventos de auditoria do login (B1.1, AUD-01).
\set ON_ERROR_STOP 1

-- Anônimo (falha/bloqueio de login acontecem antes de autenticar) precisa poder registrar.
-- (a leitura de conferência usa a role de dono, já que anon não lê audit_log direto — RLS de B0.2)
select test.as_user(null);
select public.log_security_event('auth_login_failed', jsonb_build_object('email', 'alguem@teste.com'));
select public.log_security_event('auth_login_locked', jsonb_build_object('email', 'bloqueio@teste.com'));
select public.log_security_event('auth_password_reset_requested', jsonb_build_object('email', 'recupera@teste.com'));

-- Só a lista fechada de eventos é aceita.
select test.throws('select public.log_security_event(''qualquer_coisa'')',
  'Evento de segurança fora da lista fechada é rejeitado');

reset role;
select test.ok((select count(*) from public.audit_log where entity = 'auth_login_failed' and actor_id is null) >= 1,
  'Anônimo registra falha de login sem dono da ação');
select test.ok((select count(*) from public.audit_log where entity = 'auth_login_locked') >= 1,
  'Bloqueio de login vira evento de auditoria');
select test.ok((select count(*) from public.audit_log where entity = 'auth_password_reset_requested') >= 1,
  'Pedido de recuperação de senha vira evento de auditoria');

-- Usuário autenticado registra login/logout/troca de senha com o próprio ID.
select test.as_user('10000000-0000-0000-0000-00000000000a');
select public.log_security_event('auth_login_success');
select test.ok((select actor_id from public.audit_log where entity = 'auth_login_success' order by id desc limit 1) = '10000000-0000-0000-0000-00000000000a',
  'Login certo registra quem entrou');
select public.log_security_event('auth_logout');
select test.ok((select actor_id from public.audit_log where entity = 'auth_logout' order by id desc limit 1) = '10000000-0000-0000-0000-00000000000a',
  'Saída (logout) vira evento de auditoria');
select public.log_security_event('auth_password_updated');
select test.ok((select actor_id from public.audit_log where entity = 'auth_password_updated' order by id desc limit 1) = '10000000-0000-0000-0000-00000000000a',
  'Troca de senha vira evento de auditoria');

-- Quem vê os eventos sem empresa: só o próprio ator, ou o administrador da plataforma.
select test.ok((select count(*) from public.audit_log where entity = 'auth_login_success') = 1,
  'Dono vê seu próprio evento de login');
select test.as_user('10000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.audit_log where entity = 'auth_login_success') = 0,
  'Outro usuário não vê o login alheio sem empresa nem ser administrador');
