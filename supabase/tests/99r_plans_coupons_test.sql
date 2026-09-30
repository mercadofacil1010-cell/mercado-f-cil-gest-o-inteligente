-- Testes de planos e cupons (B9.1) — cadastro/edição de plano (só admin da
-- plataforma), plano padrão aplicado quando ninguém escolhe, cupom
-- (percentual/valor fixo, validade, limite de uso, nunca cumulativo) e
-- ajuste manual de teste grátis com justificativa obrigatória.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('ff000000-0000-0000-0000-00000000000a','dono-b91@x.com','{"full_name":"Dono B91"}'),
 ('ff000000-0000-0000-0000-00000000000b','dono2-b91@x.com','{"full_name":"Dono2 B91"}'),
 ('ff000000-0000-0000-0000-0000000000ad','admin-b91@x.com','{"full_name":"Admin B91"}');
insert into public.platform_admins values ('ff000000-0000-0000-0000-0000000000ad');

------------------------------------------------------------
-- Caso 1: acesso — só o administrador da plataforma cadastra/edita plano
-- e cupom; dono comum é bloqueado.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000000a');
select test.throws($$select public.create_plan('Plano Dono', null, 30)$$,
  'Dono comum não pode cadastrar plano');
select test.throws($$select public.create_coupon('DONO10', 'percentual', 10)$$,
  'Dono comum não pode cadastrar cupom');
select test.throws($$select public.list_coupons()$$,
  'Dono comum não pode listar cupons');

------------------------------------------------------------
-- Caso 2: administrador cadastra um plano com teste de 7 dias e o usa
-- explicitamente na criação de uma empresa.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_plan('Essencial', 'Plano de entrada', 7, false, null, null, 3, array['reposicao','pdv']);
reset role;
select id as plano_essencial_id from public.plans where name = 'Essencial' \gset

select test.as_user('ff000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B91 Ltda','Rede B91','99001100014079', null, null, null, null, null, null, null, null, null, null, null, null, false, null, true, :'plano_essencial_id'::uuid);
reset role;
select test.ok((select plan_id from public.companies where cnpj = '99001100014079') = :'plano_essencial_id'::uuid,
  'Empresa nasce com o plano escolhido explicitamente');
select test.ok((select trial_ends_at::date - now()::date from public.companies where cnpj = '99001100014079') = 7,
  'Teste grátis segue a duração configurada no plano (7 dias), não mais um valor fixo do sistema');

------------------------------------------------------------
-- Caso 3: empresa criada sem escolher plano cai no plano padrão (15 dias,
-- comportamento preservado desde antes do B9.1).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000000b');
select public.create_company('Rede B91-2 Ltda','Rede B91-2','99001100014150');
reset role;
select test.ok((select p.is_default from public.companies c join public.plans p on p.id = c.plan_id where c.cnpj = '99001100014150'),
  'Empresa sem plano escolhido cai no plano padrão');
select test.ok((select trial_ends_at::date - now()::date from public.companies where cnpj = '99001100014150') = 15,
  'Plano padrão preserva os 15 dias de teste de sempre');

------------------------------------------------------------
-- Caso 4: cupom percentual com limite de uso — aplica na primeira empresa,
-- esgota e bloqueia a segunda.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_coupon('BEMVINDO10', 'percentual', 10, now() - interval '1 day', now() + interval '30 days', 1, 'Primeira empresa da campanha');
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B91-3 Ltda','Rede B91-3','99001100014230', null, null, null, null, null, null, null, null, null, null, null, null, false, null, true, null, 'BEMVINDO10');
reset role;
select test.ok((select c.id from public.companies co join public.coupons c on c.id = co.coupon_id where co.cnpj = '99001100014230') is not null,
  'Cupom válido fica vinculado à empresa (RN-BILL-06: um só)');
select test.ok((select times_used from public.coupons where code = 'BEMVINDO10') = 1,
  'Usar o cupom incrementa o contador de uso');

select test.as_user('ff000000-0000-0000-0000-00000000000b');
select test.throws($$select public.create_company('Rede B91-4 Ltda','Rede B91-4','99001100014311', null, null, null, null, null, null, null, null, null, null, null, null, false, null, true, null, 'BEMVINDO10')$$,
  'Cupom que já esgotou o limite de uso é recusado na segunda empresa');

------------------------------------------------------------
-- Caso 5: cupom inválido e cupom vencido são recusados.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_coupon('VENCIDO', 'valor_fixo', 50, now() - interval '60 days', now() - interval '30 days');
select test.throws($$select public.create_coupon('ALTO', 'percentual', 150)$$,
  'Cupom percentual acima de 100% é recusado (regra do banco)');
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000000b');
select test.throws($$select public.create_company('Rede B91-5 Ltda','Rede B91-5','99001100014400', null, null, null, null, null, null, null, null, null, null, null, null, false, null, true, null, 'NAOEXISTE')$$,
  'Cupom inexistente é recusado');
select test.throws($$select public.create_company('Rede B91-5 Ltda','Rede B91-5','99001100014400', null, null, null, null, null, null, null, null, null, null, null, null, false, null, true, null, 'VENCIDO')$$,
  'Cupom fora da validade é recusado');

------------------------------------------------------------
-- Caso 6: plano padrão — não é possível inativar sem definir outro antes;
-- trocar o padrão nunca deixa dois marcados ao mesmo tempo.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select id as plano_padrao_id from public.plans where is_default \gset
select test.throws(format($$select public.inactivate_plan('%s'::uuid)$$, :'plano_padrao_id'),
  'Não é possível inativar o plano padrão sem trocar antes');

select public.set_default_plan(:'plano_essencial_id'::uuid);
reset role;
select test.ok((select count(*) from public.plans where is_default) = 1,
  'Trocar o plano padrão nunca deixa dois marcados ao mesmo tempo');
select test.ok((select is_default from public.plans where id = :'plano_essencial_id'::uuid),
  'O novo plano padrão é o que foi escolhido');

------------------------------------------------------------
-- Caso 7: ajuste manual do teste grátis exige justificativa e é só do
-- administrador (PA-32/RN-BILL-04: exceção manual auditada).
------------------------------------------------------------
select id as empresa_b91_id from public.companies where cnpj = '99001100014079' \gset

select test.as_user('ff000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.admin_adjust_trial('%s'::uuid, now() + interval '60 days', 'tentando sem ser admin')$$, :'empresa_b91_id'),
  'Dono comum não pode ajustar teste grátis manualmente');

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_adjust_trial('%s'::uuid, now() + interval '60 days', '')$$, :'empresa_b91_id'),
  'Ajuste manual sem motivo é bloqueado');
select public.admin_adjust_trial(:'empresa_b91_id'::uuid, now() + interval '60 days', 'Cliente pediu mais tempo por atraso na implantação.');
reset role;
select test.ok((select trial_ends_at::date - now()::date from public.companies where id = :'empresa_b91_id'::uuid) = 60,
  'Ajuste manual do teste grátis aplicado');
select test.ok((select count(*) from public.audit_log where entity = 'trial_adjusted_manually' and entity_id = :'empresa_b91_id') = 1,
  'Ajuste manual fica registrado na trilha de auditoria');
