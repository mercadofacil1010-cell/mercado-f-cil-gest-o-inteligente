-- Testes do bloqueio temporário de login (B1.1, DEC-B1-01).
\set ON_ERROR_STOP 1

-- Anônimo (ainda não logado, é o momento do login) precisa poder chamar as duas funções.
select test.as_user(null);

select test.ok((public.check_login_lock('novo@teste.com') ->> 'locked')::boolean = false,
  'E-mail sem histórico não está bloqueado');

select public.register_login_attempt('bloqueio@teste.com', false);
select public.register_login_attempt('bloqueio@teste.com', false);
select public.register_login_attempt('bloqueio@teste.com', false);
select public.register_login_attempt('bloqueio@teste.com', false);
select test.ok((public.check_login_lock('bloqueio@teste.com') ->> 'locked')::boolean = false,
  '4 tentativas erradas ainda não bloqueiam');

select public.register_login_attempt('bloqueio@teste.com', false);
select test.ok((public.check_login_lock('bloqueio@teste.com') ->> 'locked')::boolean = true,
  '5 tentativas erradas seguidas bloqueiam o e-mail');
select test.ok((public.check_login_lock('bloqueio@teste.com') ->> 'retry_after_seconds')::int > 0,
  'Bloqueio informa quantos segundos faltam');

-- Não afeta outro e-mail.
select test.ok((public.check_login_lock('outro@teste.com') ->> 'locked')::boolean = false,
  'Bloqueio não vaza para outro e-mail');

-- Maiúsculas/minúsculas não driblam o bloqueio.
select test.ok((public.check_login_lock('BLOQUEIO@TESTE.COM') ->> 'locked')::boolean = true,
  'Bloqueio ignora maiúsculas e minúsculas do e-mail');

-- Um login certo depois zera a contagem de falhas.
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', true);
select test.ok((public.check_login_lock('recupera@teste.com') ->> 'locked')::boolean = false,
  'Um login certo zera as tentativas erradas anteriores');
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', false);
select public.register_login_attempt('recupera@teste.com', false);
select test.ok((public.check_login_lock('recupera@teste.com') ->> 'locked')::boolean = false,
  '4 falhas depois do login certo ainda não bloqueiam de novo');

-- O bloqueio expira sozinho depois de 15 minutos da última falha.
-- (backdatar a tentativa exige acesso direto à tabela, então volta à role de dono por um instante)
reset role;
update public.login_attempts set attempted_at = now() - interval '20 minutes'
  where lower(email) = lower('bloqueio@teste.com');
select test.as_user(null);
select test.ok((public.check_login_lock('bloqueio@teste.com') ->> 'locked')::boolean = false,
  'Bloqueio expira sozinho depois de 15 minutos');

-- Ninguém lê a tabela direto, nem logado.
select test.throws('select * from public.login_attempts', 'Ninguém lê a tabela de tentativas direto (anônimo)');
select test.as_user('10000000-0000-0000-0000-00000000000a');
select test.throws('select * from public.login_attempts', 'Ninguém lê a tabela de tentativas direto (logado)');
select test.throws('insert into public.login_attempts (email, success) values (''x@x.com'', true)',
  'Ninguém insere na tabela de tentativas direto');
