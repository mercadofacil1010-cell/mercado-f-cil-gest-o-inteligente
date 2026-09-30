-- Testes do relatório de auditoria (B8.3, RF-RPT-04/07) — reaproveita o
-- mesmo `get_report` do B8.2 como 13º tipo, sobre a trilha já existente
-- desde o B0.2. Exportar este relatório também fica auditado (RF-RPT-07),
-- mesma evidência do AUD-10 já testado no B8.2.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fe000000-0000-0000-0000-00000000000a','dono-b83@x.com','{"full_name":"Dono B83"}'),
 ('fe000000-0000-0000-0000-00000000000b','gerente-b83@x.com','{"full_name":"Gerente B83"}'),
 ('fe000000-0000-0000-0000-00000000000c','repositor-b83@x.com','{"full_name":"Repositor B83"}');

select test.as_user('fe000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B83 Ltda','Rede B83','88009900014010');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('fe000000-0000-0000-0000-00000000000b','manager'),
         ('fe000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '88009900014010';

reset role;
select id as rede_id from public.companies where cnpj = '88009900014010' \gset

select test.as_user('fe000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B83', 'B83-CTR-1');

reset role;
select id as loja_id from public.markets where internal_code = 'B83-CTR-1' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('fe000000-0000-0000-0000-00000000000b'::uuid, 'fe000000-0000-0000-0000-00000000000c'::uuid);

------------------------------------------------------------
-- Caso 1: a própria criação do mercado já fica na trilha — o relatório de
-- auditoria enxerga sem precisar de nenhuma ação nova.
------------------------------------------------------------
select test.as_user('fe000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'auditoria', now() - interval '1 day', now() + interval '1 day', null) as r_aud \gset
reset role;
select test.ok(jsonb_array_length(:'r_aud'::jsonb) >= 1, 'Relatório de auditoria traz o registro da criação do mercado');
select test.ok((select count(*) from jsonb_array_elements(:'r_aud'::jsonb) x where x ->> 'entidade' = 'markets') >= 1,
  'Registro de auditoria mostra a entidade certa (markets)');

------------------------------------------------------------
-- Caso 2: acesso — repositor não pode ver o relatório de auditoria.
------------------------------------------------------------
select test.as_user('fe000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.get_report('%s'::uuid, 'auditoria', null, null, null)$$, :'loja_id'),
  'Repositor não pode ver o relatório de auditoria');
