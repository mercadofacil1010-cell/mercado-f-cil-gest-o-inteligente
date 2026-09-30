-- Testes do painel administrativo real (B9.4) — preço travado na
-- contratação (RN-ADM-03), migração manual e auditada de plano
-- (RF-ADM-02/06), auditoria de empresa pelo administrador (RF-ADM-07) e
-- indicadores da plataforma (IND-ADM-01..09).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('ff000000-0000-0000-0000-00000000002a','dono-b94@x.com','{"full_name":"Dono B94"}'),
 ('ff000000-0000-0000-0000-0000000000ad','admin-b94@x.com','{"full_name":"Admin B94"}')
on conflict (id) do nothing;
insert into public.platform_admins values ('ff000000-0000-0000-0000-0000000000ad')
  on conflict do nothing;

------------------------------------------------------------
-- Caso 1: preço trava na contratação — editar o plano depois não muda o
-- valor de quem já contratou (RN-ADM-03).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_plan('Plano B94', 'Plano para testes de preço travado', 0, false, 300, 100, null, array['dashboard']);
reset role;
select id as plano_b94_id from public.plans where name = 'Plano B94' \gset

select test.as_user('ff000000-0000-0000-0000-00000000002a');
select public.create_company('Rede B94 Ltda','Rede B94','99001100064092', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false, :'plano_b94_id'::uuid);
reset role;
select id as empresa_b94_id from public.companies where cnpj = '99001100064092' \gset

select test.ok((select locked_base_price from public.companies where id = :'empresa_b94_id'::uuid) = 300,
  'Preço base do plano fica travado na empresa no momento da contratação');
select test.ok((select locked_price_per_market from public.companies where id = :'empresa_b94_id'::uuid) = 100,
  'Preço por mercado também trava na contratação');

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.update_plan(:'plano_b94_id'::uuid, 'Plano B94', 'Plano para testes de preço travado', 0, false, 500, 200, null, array['dashboard']);
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000002a');
select (public.calculate_subscription_amount(:'empresa_b94_id'::uuid) ->> 'total')::numeric as total_apos_editar_plano \gset
reset role;
select test.ok(:total_apos_editar_plano = 300,
  'Editar o preço do plano não muda a mensalidade de quem já contratou (preço travado)');

------------------------------------------------------------
-- Caso 2: migrar o cliente para o preço novo é ação manual do
-- administrador, sempre com motivo (RF-ADM-02/06/RN-ADM-04).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000002a');
select test.throws(format($$select public.admin_update_company_plan('%s'::uuid, '%s'::uuid, 'tentando sem ser admin')$$, :'empresa_b94_id', :'plano_b94_id'),
  'Dono comum não pode migrar o próprio plano/preço');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.throws(format($$select public.admin_update_company_plan('%s'::uuid, '%s'::uuid, '')$$, :'empresa_b94_id', :'plano_b94_id'),
  'Migração de plano sem motivo é bloqueada');
select public.admin_update_company_plan(:'empresa_b94_id'::uuid, :'plano_b94_id'::uuid, 'Cliente pediu para migrar para o preço atual do plano.');
reset role;

select test.ok((select locked_base_price from public.companies where id = :'empresa_b94_id'::uuid) = 500,
  'Depois da migração manual, o preço travado acompanha o novo valor do plano');

select test.as_user('ff000000-0000-0000-0000-00000000002a');
select (public.calculate_subscription_amount(:'empresa_b94_id'::uuid) ->> 'total')::numeric as total_apos_migrar \gset
reset role;
select test.ok(:total_apos_migrar = 500, 'Mensalidade reflete o novo preço só depois da migração manual');

------------------------------------------------------------
-- Caso 3: auditoria da empresa pelo administrador (RF-ADM-07) — a
-- migração de plano fica registrada com o motivo.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000002a');
select test.throws(format($$select public.admin_list_company_audit('%s'::uuid)$$, :'empresa_b94_id'),
  'Dono comum não usa a consulta de auditoria do administrador (já tem a própria tela)');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select test.ok(
  exists(
    select 1 from public.admin_list_company_audit(:'empresa_b94_id'::uuid)
    where entity = 'companies' and (context ->> 'justification') = 'Cliente pediu para migrar para o preço atual do plano.'
  ),
  'Auditoria mostra a migração de plano com o motivo informado'
);
reset role;

------------------------------------------------------------
-- Caso 4: indicadores da plataforma — só o administrador vê; contagens
-- batem em variação (delta), já que o banco de teste acumula empresas de
-- todos os blocos anteriores.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000002a');
select test.throws($$select public.get_platform_indicators()$$,
  'Dono comum não vê os indicadores da plataforma');
reset role;

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select (public.get_platform_indicators() ->> 'companiesCount')::int as empresas_antes \gset
select (public.get_platform_indicators() ->> 'mrr')::numeric as mrr_antes \gset
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000002a');
select public.create_company('Rede B94-2 Ltda','Rede B94-2','99001100072001', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false, :'plano_b94_id'::uuid);
reset role;
select id as empresa_b94_2_id from public.companies where cnpj = '99001100072001' \gset

select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select (public.get_platform_indicators() ->> 'companiesCount')::int as empresas_depois \gset
select (public.get_platform_indicators() ->> 'mrr')::numeric as mrr_depois \gset
reset role;
select test.ok(:empresas_depois = :empresas_antes + 1, 'Empresas cadastradas sobe em 1 após criar uma nova empresa (IND-ADM-01)');
select test.ok(:mrr_depois = :mrr_antes + 500, 'MRR sobe no valor do preço travado da nova empresa ativa (IND-ADM-05)');
