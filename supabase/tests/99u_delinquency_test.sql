-- Testes de inadimplência, suspensão e cancelamento (B9.5) — 7 dias em
-- atraso suspende, 30 dias corridos desde o atraso cancela, reativação e
-- cancelamento manual, e bloqueio de novo mercado durante suspensão.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('ff000000-0000-0000-0000-00000000003a','dono-b95@x.com','{"full_name":"Dono B95"}'),
 ('ff000000-0000-0000-0000-0000000000ad','admin-b95@x.com','{"full_name":"Admin B95"}')
on conflict (id) do nothing;
insert into public.platform_admins values ('ff000000-0000-0000-0000-0000000000ad')
  on conflict do nothing;

select test.as_user('ff000000-0000-0000-0000-00000000003a');
select public.create_company('Rede B95 Ltda','Rede B95','99001100110035', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_b95_id from public.companies where cnpj = '99001100110035' \gset

------------------------------------------------------------
-- Caso 1: marcar atraso — só admin, só a partir de assinatura ativa, exige
-- motivo (RF-BILL-07/PA-34).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000003a');
select test.throws(format($$select public.admin_mark_past_due('%s'::uuid, 'tentando sem ser admin')$$, :'empresa_b95_id'),
  'Dono comum não pode marcar a própria assinatura como em atraso');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_mark_past_due('%s'::uuid, '')$$, :'empresa_b95_id'),
  'Marcar atraso sem motivo é bloqueado');
select public.admin_mark_past_due(:'empresa_b95_id'::uuid, 'Pagamento não identificado no vencimento.');
reset role;
select test.ok((select subscription_status from public.companies where id = :'empresa_b95_id'::uuid) = 'past_due',
  'Assinatura marcada como em atraso');
select test.ok((select past_due_since from public.companies where id = :'empresa_b95_id'::uuid) is not null,
  'Data do início do atraso é registrada');

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_mark_past_due('%s'::uuid, 'de novo')$$, :'empresa_b95_id'),
  'Só uma assinatura ativa pode ser marcada como em atraso (já está em atraso)');
reset role;

------------------------------------------------------------
-- Caso 2: bloqueio de novo mercado durante o atraso/suspensão (PA-35 —
-- pelo menos esta operação, ligada diretamente à assinatura).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000003a');
select test.throws(format($$insert into public.markets (company_id, name, internal_code) values ('%s'::uuid, 'Loja Nova', 'UND-1')$$, :'empresa_b95_id'),
  'Não é possível adicionar mercado novo com a assinatura em atraso');
reset role;

------------------------------------------------------------
-- Caso 3: 7 dias em atraso suspende (processamento sob demanda pelo
-- administrador — decisão do usuário, PA-34).
------------------------------------------------------------
update public.companies set past_due_since = now() - interval '8 days' where id = :'empresa_b95_id'::uuid;

select test.as_user('ff000000-0000-0000-0000-00000000003a');
select test.throws($$select public.process_subscription_delinquency()$$,
  'Dono comum não processa a inadimplência da plataforma');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.process_subscription_delinquency();
reset role;
select test.ok((select subscription_status from public.companies where id = :'empresa_b95_id'::uuid) = 'suspended',
  '7 dias em atraso suspende a assinatura');

------------------------------------------------------------
-- Caso 4: mercado continua bloqueado durante a suspensão.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000003a');
select test.throws(format($$insert into public.markets (company_id, name, internal_code) values ('%s'::uuid, 'Loja Nova', 'UND-1')$$, :'empresa_b95_id'),
  'Não é possível adicionar mercado novo com a assinatura suspensa');
reset role;

------------------------------------------------------------
-- Caso 5: reativação manual regulariza a assinatura (pagamento recebido).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_reactivate_subscription('%s'::uuid, '')$$, :'empresa_b95_id'),
  'Reativação sem motivo é bloqueada');
select public.admin_reactivate_subscription(:'empresa_b95_id'::uuid, 'Cliente regularizou o pagamento por fora enquanto o gateway não existe.');
reset role;
select test.ok((select subscription_status from public.companies where id = :'empresa_b95_id'::uuid) = 'active',
  'Reativação manual volta a assinatura para ativa');
select test.ok((select past_due_since from public.companies where id = :'empresa_b95_id'::uuid) is null,
  'Data de atraso é limpa após reativar');

select test.as_user('ff000000-0000-0000-0000-00000000003a');
insert into public.markets (company_id, name, internal_code) values (:'empresa_b95_id'::uuid, 'Loja Reativada', 'UND-2');
reset role;
select test.ok(exists(select 1 from public.markets where company_id = :'empresa_b95_id'::uuid and name = 'Loja Reativada'),
  'Assinatura reativada volta a permitir adicionar mercado');

------------------------------------------------------------
-- Caso 6: 30 dias corridos desde o atraso cancela, mesmo pulando direto de
-- "past_due" (sem passar pela suspensão intermediária no mesmo processamento).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000003a');
select public.create_company('Rede B95-2 Ltda','Rede B95-2','99001100118010', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_b95_2_id from public.companies where cnpj = '99001100118010' \gset

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.admin_mark_past_due(:'empresa_b95_2_id'::uuid, 'Pagamento não identificado no vencimento.');
reset role;
update public.companies set past_due_since = now() - interval '31 days' where id = :'empresa_b95_2_id'::uuid;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.process_subscription_delinquency();
reset role;
select test.ok((select subscription_status from public.companies where id = :'empresa_b95_2_id'::uuid) = 'cancelled',
  '30 dias corridos desde o atraso cancelam a assinatura, mesmo sem ter passado pela suspensão antes');

------------------------------------------------------------
-- Caso 7: cancelamento manual, imediato, sempre com motivo (RF-ADM-06).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000003a');
select public.create_company('Rede B95-3 Ltda','Rede B95-3','99001100126039', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_b95_3_id from public.companies where cnpj = '99001100126039' \gset

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_cancel_subscription('%s'::uuid, '', '99001100126039')$$, :'empresa_b95_3_id'),
  'Cancelamento sem motivo é bloqueado');
select test.throws(format($$select public.admin_cancel_subscription('%s'::uuid, 'motivo', '00000000000000')$$, :'empresa_b95_3_id'),
  'Cancelamento com CNPJ de confirmação errado é bloqueado (RNF-SEC-03)');
select public.admin_cancel_subscription(:'empresa_b95_3_id'::uuid, 'Cliente pediu cancelamento por telefone.', '99001100126039');
reset role;
select test.ok((select subscription_status from public.companies where id = :'empresa_b95_3_id'::uuid) = 'cancelled',
  'Cancelamento manual é imediato');

------------------------------------------------------------
-- Caso 8: nada é apagado (RN-BILL-08) — a empresa cancelada continua com
-- todos os dados; só a situação da assinatura muda.
------------------------------------------------------------
select test.ok((select legal_name from public.companies where id = :'empresa_b95_3_id'::uuid) = 'Rede B95-3 Ltda',
  'Empresa cancelada preserva todos os dados cadastrais — nenhuma exclusão física');

------------------------------------------------------------
-- Caso 9: a migração de plano/motivo fica auditada (mesma trilha genérica
-- de companies, AUD-08/RF-BILL-08).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.ok(
  exists(
    select 1 from public.admin_list_company_audit(:'empresa_b95_id'::uuid)
    where entity = 'companies' and (context ->> 'justification') = 'Cliente regularizou o pagamento por fora enquanto o gateway não existe.'
  ),
  'Reativação manual fica registrada na auditoria com o motivo informado'
);
reset role;
