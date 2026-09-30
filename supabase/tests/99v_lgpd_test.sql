-- Testes de LGPD (B10.1) — retenção de 90 dias após cancelamento,
-- eliminação sob demanda, e exportação de dados pessoais/da empresa.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('ff000000-0000-0000-0000-00000000004a','dono-b101@x.com','{"full_name":"Dono B101"}'),
 ('ff000000-0000-0000-0000-00000000004b','dono2-b101@x.com','{"full_name":"Dono2 B101"}'),
 ('ff000000-0000-0000-0000-0000000000ad','admin-b101@x.com','{"full_name":"Admin B101"}')
on conflict (id) do nothing;
insert into public.platform_admins values ('ff000000-0000-0000-0000-0000000000ad')
  on conflict do nothing;

select test.as_user('ff000000-0000-0000-0000-00000000004a');
select public.create_company('Rede B101 Ltda','Rede B101','99001100134058', null, '11987654321', 'contato@redeb101.com.br', null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_b101_id from public.companies where cnpj = '99001100134058' \gset

------------------------------------------------------------
-- Caso 1: cancelamento marca cancelled_at (base da contagem dos 90 dias).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.admin_cancel_subscription(:'empresa_b101_id'::uuid, 'Cliente pediu cancelamento.', '99001100134058');
reset role;
select test.ok((select cancelled_at from public.companies where id = :'empresa_b101_id'::uuid) is not null,
  'Cancelamento marca cancelled_at, base da contagem dos 90 dias (PA-36)');
select test.ok((select email from public.companies where id = :'empresa_b101_id'::uuid) = 'contato@redeb101.com.br',
  'Logo após cancelar, o contato ainda não foi eliminado (só começa a contar os 90 dias)');

------------------------------------------------------------
-- Caso 2: dentro dos 90 dias, o processamento de retenção não elimina nada.
------------------------------------------------------------
update public.companies set cancelled_at = now() - interval '10 days' where id = :'empresa_b101_id'::uuid;

select test.as_user('ff000000-0000-0000-0000-00000000004a');
select test.throws($$select public.process_data_retention()$$,
  'Dono comum não processa a retenção de dados da plataforma');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.process_data_retention();
reset role;
select test.ok((select email from public.companies where id = :'empresa_b101_id'::uuid) = 'contato@redeb101.com.br',
  'Dentro dos 90 dias, o contato ainda não é eliminado');
select test.ok((select data_anonymized_at from public.companies where id = :'empresa_b101_id'::uuid) is null,
  'Sem 90 dias corridos, data_anonymized_at continua nula');

------------------------------------------------------------
-- Caso 3: passados os 90 dias, o processamento elimina o contato (mas não
-- o cadastro inteiro — RN-ACL-06, sem exclusão física).
------------------------------------------------------------
update public.companies set cancelled_at = now() - interval '91 days' where id = :'empresa_b101_id'::uuid;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.process_data_retention();
reset role;
select test.ok((select email from public.companies where id = :'empresa_b101_id'::uuid) is null,
  '90 dias corridos após o cancelamento: e-mail de contato é eliminado');
select test.ok((select phone from public.companies where id = :'empresa_b101_id'::uuid) is null,
  '90 dias corridos após o cancelamento: telefone de contato é eliminado');
select test.ok((select data_anonymized_at from public.companies where id = :'empresa_b101_id'::uuid) is not null,
  'Data da eliminação é registrada');
select test.ok((select legal_name from public.companies where id = :'empresa_b101_id'::uuid) = 'Rede B101 Ltda',
  'Cadastro da empresa (razão social) continua existindo — não é exclusão física, só do contato pessoal');

------------------------------------------------------------
-- Caso 4: solicitação de eliminação sob demanda (sem esperar os 90 dias),
-- só depois que a assinatura já foi cancelada.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000004b');
select public.create_company('Rede B101-2 Ltda','Rede B101-2','99001100142077', null, '11912345678', 'contato@redeb101-2.com.br', null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_b101_2_id from public.companies where cnpj = '99001100142077' \gset

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_process_erasure_request('%s'::uuid, 'pedido do cliente', '99001100142077')$$, :'empresa_b101_2_id'),
  'Não é possível eliminar contato de uma assinatura ainda ativa');
select public.admin_cancel_subscription(:'empresa_b101_2_id'::uuid, 'Cliente pediu cancelamento.', '99001100142077');
select test.throws(format($$select public.admin_process_erasure_request('%s'::uuid, '', '99001100142077')$$, :'empresa_b101_2_id'),
  'Solicitação de eliminação sem motivo é bloqueada');
select test.throws(format($$select public.admin_process_erasure_request('%s'::uuid, 'motivo', '00000000000000')$$, :'empresa_b101_2_id'),
  'Eliminação com CNPJ de confirmação errado é bloqueada (RNF-SEC-03)');
select public.admin_process_erasure_request(:'empresa_b101_2_id'::uuid, 'Cliente exerceu o direito de eliminação (LGPD) por e-mail.', '99001100142077');
reset role;
select test.ok((select email from public.companies where id = :'empresa_b101_2_id'::uuid) is null,
  'Solicitação de eliminação sob demanda funciona sem esperar os 90 dias');

------------------------------------------------------------
-- Caso 5: exportação dos próprios dados (direito de acesso/portabilidade).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000004a');
select test.ok((public.export_my_data() -> 'profile' ->> 'id') = 'ff000000-0000-0000-0000-00000000004a',
  'Exportação dos próprios dados traz o próprio perfil');
select test.ok(jsonb_array_length(public.export_my_data() -> 'companyMemberships') >= 1,
  'Exportação dos próprios dados traz os vínculos com empresas');
reset role;

------------------------------------------------------------
-- Caso 6: exportação dos dados da empresa — só o dono (ou administrador).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000004b');
select test.throws(format($$select public.export_company_data('%s'::uuid)$$, :'empresa_b101_id'),
  'Dono de outra empresa não exporta dados alheios');
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000004a');
select test.ok((public.export_company_data(:'empresa_b101_id'::uuid) -> 'company' ->> 'legal_name') = 'Rede B101 Ltda',
  'Exportação da empresa traz o cadastro completo');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.ok((public.export_company_data(:'empresa_b101_id'::uuid) -> 'company' ->> 'legal_name') = 'Rede B101 Ltda',
  'Administrador também pode exportar os dados de qualquer empresa');
reset role;
