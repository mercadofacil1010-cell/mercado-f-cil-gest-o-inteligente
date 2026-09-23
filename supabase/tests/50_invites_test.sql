-- Testes de convites e vínculos da equipe (B1.5).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('20000000-0000-0000-0000-00000000000a','dono-inv@x.com','{"full_name":"Dono Convites"}'),
 ('20000000-0000-0000-0000-00000000000b','gerente-inv@x.com','{"full_name":"Gerente Convites"}'),
 ('20000000-0000-0000-0000-00000000000c','novo-repositor@x.com','{"full_name":"Novo Repositor"}'),
 ('20000000-0000-0000-0000-00000000000d','sem-vinculo@x.com','{"full_name":"Sem Vinculo"}');

select test.as_user('20000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Convites Ltda','Rede Convites','42345678000156');
insert into public.markets (company_id, name, internal_code) select id, 'Convites Centro', 'CV-1' from public.companies where cnpj = '42345678000156';
insert into public.markets (company_id, name, internal_code) select id, 'Convites Norte', 'CV-2' from public.companies where cnpj = '42345678000156';

-- Dono convida um gerente (sem mercado obrigatório) e o vincula depois.
select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'),
  'gerente-inv@x.com', 'manager', null
);
select test.ok((select count(*) from public.invites where email = 'gerente-inv@x.com') = 1,
  'Dono convida gerente sem exigir mercado');
select test.throws($$select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'), 'x@x.com', 'owner', null)$$,
  'Ninguém convida outra pessoa como dono');

-- Gerente C aceita o convite (usa o token direto, já que e-mail ainda não existe).
select token as token_gerente from public.invites where email = 'gerente-inv@x.com' \gset
reset role;
select test.as_user('20000000-0000-0000-0000-00000000000b');
select public.accept_invite(:'token_gerente');
select test.ok((select role = 'manager' and status = 'active' from public.company_members
  where user_id = '20000000-0000-0000-0000-00000000000b'), 'Convite aceito vira company_members ativo com o papel certo');
select test.throws(format($$select public.accept_invite('%s')$$, :'token_gerente'),
  'Convite já aceito não pode ser aceito de novo');
-- O gerente não enxerga este convite via RLS (quem convidou foi o dono, não ele),
-- então checa o status com a role de dono do banco (bypassa RLS só para conferência).
reset role;
select test.ok((select status from public.invites where email = 'gerente-inv@x.com') = 'accepted',
  'Convite aceito muda de status');
select test.as_user('20000000-0000-0000-0000-00000000000b');

-- Dono vincula o gerente aos 2 mercados (fora do escopo do convite, feito manualmente).
reset role;
select test.as_user('20000000-0000-0000-0000-00000000000a');
insert into public.member_markets (member_id, market_id)
select cm.id, m.id from public.company_members cm, public.markets m
where cm.user_id = '20000000-0000-0000-0000-00000000000b'
  and m.internal_code in ('CV-1', 'CV-2');

-- Gerente convida repositor só para um mercado que ele tem.
reset role;
select test.as_user('20000000-0000-0000-0000-00000000000b');
select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'),
  'novo-repositor@x.com', 'stocker',
  array(select id from public.markets where internal_code = 'CV-1')
);
select test.ok((select count(*) from public.invites where email = 'novo-repositor@x.com') = 1,
  'Gerente convida repositor para mercado que ele tem acesso');
select test.throws($$select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'), 'x2@x.com', 'manager',
  array(select id from public.markets where internal_code = 'CV-1'))$$,
  'Gerente não pode convidar outro gerente');
select test.throws($$select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'), 'x3@x.com', 'stocker', null)$$,
  'Gerente precisa informar ao menos um mercado ao convidar');

-- Isolamento: dono de outra empresa não pode convidar usando o company_id de Rede Convites.
reset role;
select test.as_user('00000000-0000-0000-0000-00000000000b');
select test.throws($$select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'), 'x4@x.com', 'stocker', null)$$,
  'Dono de outra empresa não convida para uma empresa que não é sua');

-- Repositor novo aceita: e-mail tem que bater com o do convite.
-- (busca o token como dono do teste, não como o usuário de fora usado acima)
reset role;
select token as token_repositor from public.invites where email = 'novo-repositor@x.com' \gset
reset role;
select test.as_user('20000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.accept_invite('%s')$$, :'token_repositor'),
  'Convite recusado quando o e-mail logado não é o do convite');

reset role;
select test.as_user('20000000-0000-0000-0000-00000000000c');
select public.accept_invite(:'token_repositor');
select test.ok((select count(*) from public.member_markets mm join public.company_members cm on cm.id = mm.member_id
  where cm.user_id = '20000000-0000-0000-0000-00000000000c') = 1,
  'Repositor aceito já entra vinculado ao mercado do convite');

-- Revogar e reenviar.
reset role;
select test.as_user('20000000-0000-0000-0000-00000000000a');
select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'),
  'sera-revogado@x.com', 'stocker', array(select id from public.markets where internal_code = 'CV-2'));
select id as invite_a_revogar from public.invites where email = 'sera-revogado@x.com' \gset
select public.revoke_invite(:'invite_a_revogar'::uuid);
select test.ok((select status from public.invites where id = :'invite_a_revogar'::uuid) = 'revoked',
  'Dono revoga convite pendente');
select test.throws(format($$select public.revoke_invite('%s'::uuid)$$, :'invite_a_revogar'),
  'Convite já revogado não pode ser revogado de novo');

select public.create_invite(
  (select id from public.companies where cnpj = '42345678000156'),
  'sera-reenviado@x.com', 'stocker', array(select id from public.markets where internal_code = 'CV-2'));
select id as invite_a_reenviar from public.invites where email = 'sera-reenviado@x.com' \gset
-- Backdatar o prazo é acesso direto à tabela, então usa a role de dono do banco por um instante.
reset role;
update public.invites set expires_at = now() - interval '1 day' where id = :'invite_a_reenviar'::uuid;
select test.as_user('20000000-0000-0000-0000-00000000000a');
select public.resend_invite(:'invite_a_reenviar'::uuid);
select test.ok((select expires_at > now() from public.invites where id = :'invite_a_reenviar'::uuid),
  'Reenviar convite renova o prazo (DEC-B1-06)');

-- Convite vencido não pode ser aceito.
reset role;
update public.invites set expires_at = now() - interval '1 minute' where id = :'invite_a_reenviar'::uuid;
select token as token_vencido from public.invites where id = :'invite_a_reenviar'::uuid \gset
insert into auth.users (id, email, raw_user_meta_data) values
 ('20000000-0000-0000-0000-00000000000e','sera-reenviado@x.com','{"full_name":"Vencido"}');
select test.as_user('20000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.accept_invite('%s')$$, :'token_vencido'),
  'Convite vencido não pode ser aceito');

-- Prévia do convite: qualquer um vê (token imprevisível), inclusive sem estar logado.
reset role;
select test.as_user(null);
select test.ok((select company_name from public.get_invite_preview(:'token_repositor'::uuid)) = 'Rede Convites',
  'Prévia do convite funciona sem estar logado');

-- Ninguém grava direto nas tabelas de convite.
select test.throws('insert into public.invites (company_id, email, role, invited_by) values (gen_random_uuid(), ''x@x.com'', ''stocker'', gen_random_uuid())',
  'Ninguém insere convite direto na tabela (só create_invite)');

reset role;
