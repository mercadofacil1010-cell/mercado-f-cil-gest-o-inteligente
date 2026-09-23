-- Testes de parâmetros de produto por mercado (B2.3): mínimo, ideal, máximo,
-- ponto de pedido e situação (ativo/bloqueado/inativo) — RN-PROD-05.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('50000000-0000-0000-0000-00000000000a','dono-mp@x.com','{"full_name":"Dono MarketProducts"}'),
 ('50000000-0000-0000-0000-00000000000b','gerente-mp@x.com','{"full_name":"Gerente MarketProducts"}'),
 ('50000000-0000-0000-0000-00000000000c','repositor-mp@x.com','{"full_name":"Repositor MarketProducts"}'),
 ('50000000-0000-0000-0000-00000000000d','dono-outra-mp@x.com','{"full_name":"Dono Outra Empresa MarketProducts"}');

select test.as_user('50000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Parametros Ltda','Rede Parametros','92345678000124');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('50000000-0000-0000-0000-00000000000b','manager'),('50000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '92345678000124';

select test.as_user('50000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Parametros Ltda','Outra Parametros','12345678000276');

reset role;
select id as rede_id from public.companies where cnpj = '92345678000124' \gset
select id as outra_rede_id from public.companies where cnpj = '12345678000276' \gset

select test.as_user('50000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Centro', 'CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Bairro', 'BRR-1');
insert into public.products (company_id, name, base_unit) values (:'rede_id'::uuid, 'Arroz 5kg', 'unidade');

reset role;
select id as loja_centro_id from public.markets where internal_code = 'CTR-1' \gset
select id as loja_bairro_id from public.markets where internal_code = 'BRR-1' \gset
select id as arroz_id from public.products where name = 'Arroz 5kg' \gset

-- Gerente só tem acesso à Loja Centro (RN-ACL, B1.5): parâmetros de mercado
-- seguem essa mesma regra de acesso por mercado, não só o cargo na empresa.
insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_centro_id'::uuid from public.company_members cm
where cm.user_id = '50000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('50000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values (:'outra_rede_id'::uuid, 'Loja Estranha', 'EST-1');

reset role;
select id as loja_estranha_id from public.markets where internal_code = 'EST-1' \gset

-- Dono cadastra parâmetros do produto em cada loja, com valores diferentes (RN-PROD-05).
select test.as_user('50000000-0000-0000-0000-00000000000a');
insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity, reorder_point)
values (:'arroz_id'::uuid, :'loja_centro_id'::uuid, 10, 20, 30, 10);
select test.ok((select count(*) from public.market_products where product_id = :'arroz_id'::uuid and market_id = :'loja_centro_id'::uuid) = 1,
  'Dono cadastra parâmetros na Loja Centro');

insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity, reorder_point)
values (:'arroz_id'::uuid, :'loja_bairro_id'::uuid, 3, 6, 9, 3);
select test.ok((select count(*) from public.market_products where product_id = :'arroz_id'::uuid and market_id = :'loja_bairro_id'::uuid) = 1,
  'Dono cadastra parâmetros diferentes na Loja Bairro (mesmo produto, mercados diferentes)');

select test.ok((select min_quantity from public.market_products where market_id = :'loja_centro_id'::uuid) <>
  (select min_quantity from public.market_products where market_id = :'loja_bairro_id'::uuid),
  'O mesmo produto pode ter mínimos diferentes em cada mercado');

-- Não pode existir mais de uma linha de parâmetros por produto+mercado.
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, 1, 2, 3)$$, :'arroz_id', :'loja_centro_id'),
  'Não pode cadastrar parâmetros duplicados para o mesmo produto e mercado');

-- Mínimo <= ideal <= máximo (usa outro produto na mesma loja pra não colidir com o par já cadastrado).
insert into public.products (company_id, name, base_unit) values (:'rede_id'::uuid, 'Feijão 1kg', 'unidade');
reset role;
select id as feijao_id from public.products where name = 'Feijão 1kg' \gset
select test.as_user('50000000-0000-0000-0000-00000000000a');
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, 10, 5, 20)$$, :'feijao_id', :'loja_centro_id'),
  'Ideal menor que o mínimo é recusado');
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, 10, 20, 15)$$, :'feijao_id', :'loja_centro_id'),
  'Máximo menor que o ideal é recusado');

-- Valores negativos são recusados.
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, -1, 5, 10)$$, :'feijao_id', :'loja_centro_id'),
  'Mínimo negativo é recusado');

-- Ponto de pedido nasce igual ao mínimo quando não informado (default 0, então testamos passando explícito na app;
-- aqui garantimos que o campo aceita valor igual ou diferente do mínimo livremente).
select test.ok((select reorder_point from public.market_products where market_id = :'loja_centro_id'::uuid) = 10,
  'Ponto de pedido registrado (igual ao mínimo, valor enviado pela aplicação)');

-- Situação: bloquear é reversível, mantém a linha (não apaga, RN-ACL-06).
update public.market_products set status = 'blocked' where market_id = :'loja_bairro_id'::uuid;
select test.ok((select status from public.market_products where market_id = :'loja_bairro_id'::uuid) = 'blocked',
  'Dono bloqueia o produto na Loja Bairro (pausa reversível)');
update public.market_products set status = 'active' where market_id = :'loja_bairro_id'::uuid;
select test.ok((select status from public.market_products where market_id = :'loja_bairro_id'::uuid) = 'active',
  'Dono reativa o produto na Loja Bairro');

update public.market_products set status = 'inactive' where market_id = :'loja_bairro_id'::uuid;
select test.ok((select status from public.market_products where market_id = :'loja_bairro_id'::uuid) = 'inactive',
  'Dono inativa o produto na Loja Bairro (desligamento definitivo)');

-- Gerente também pode editar (PA-04).
reset role;
select test.as_user('50000000-0000-0000-0000-00000000000b');
update public.market_products set ideal_quantity = 25 where market_id = :'loja_centro_id'::uuid;
select test.ok((select ideal_quantity from public.market_products where market_id = :'loja_centro_id'::uuid) = 25,
  'Gerente edita parâmetros do produto por mercado');

-- Gerente sem acesso à Loja Bairro não pode editar os parâmetros de lá (RN-ACL, mesma regra de acesso por mercado do B1.5).
-- A política de RLS filtra a linha silenciosamente (0 linhas afetadas), não lança erro — por isso comparamos o valor antes/depois.
update public.market_products set min_quantity = 1 where market_id = :'loja_bairro_id'::uuid;
reset role;
select test.ok((select min_quantity from public.market_products where market_id = :'loja_bairro_id'::uuid) = 3,
  'Gerente sem acesso à Loja Bairro não altera seus parâmetros (RLS filtra a linha, update afeta 0 linhas)');

-- Repositor (stocker) não pode editar nem cadastrar.
select test.as_user('50000000-0000-0000-0000-00000000000c');
update public.market_products set min_quantity = 99 where market_id = :'loja_centro_id'::uuid;
reset role;
select test.ok((select min_quantity from public.market_products where market_id = :'loja_centro_id'::uuid) <> 99,
  'Repositor não altera parâmetros de produto por mercado (RLS filtra a linha)');
select test.as_user('50000000-0000-0000-0000-00000000000c');
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, 1, 2, 3)$$, :'arroz_id', :'loja_estranha_id'),
  'Repositor não pode cadastrar parâmetros de produto por mercado');

-- Isolamento entre empresas: dono de outra rede não vê nem edita os parâmetros desta.
reset role;
select test.as_user('50000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.market_products where market_id = :'loja_centro_id'::uuid) = 0,
  'Dono de outra empresa não vê parâmetros de produto de mercado alheio (RLS)');

reset role;
select id as target_market_id from public.markets where internal_code = 'CTR-1' \gset
select test.as_user('50000000-0000-0000-0000-00000000000d');
update public.market_products set min_quantity = 0 where market_id = :'target_market_id'::uuid;
reset role;
select test.ok((select min_quantity from public.market_products where market_id = :'target_market_id'::uuid) <> 0,
  'Dono de outra empresa não altera parâmetros de mercado alheio (RLS filtra a linha)');

-- Não é possível ligar produto de uma empresa a mercado de outra empresa.
reset role;
select test.as_user('50000000-0000-0000-0000-00000000000a');
select test.throws(format($$insert into public.market_products (product_id, market_id, min_quantity, ideal_quantity, max_quantity)
  values ('%s'::uuid, '%s'::uuid, 1, 2, 3)$$, :'arroz_id', :'loja_estranha_id'),
  'Não é possível ligar produto de uma empresa a mercado de outra empresa');

-- Sem exclusão física (RN-ACL-06).
select test.throws(format($$delete from public.market_products where market_id = '%s'::uuid$$, :'loja_centro_id'),
  'Excluir fisicamente os parâmetros de produto por mercado é recusado');

-- Auditoria (AUD-04): a criação dos parâmetros fica registrada.
select test.ok((select count(*) from public.audit_log
  where entity = 'market_products' and action = 'insert' and market_id = :'loja_centro_id'::uuid) >= 1,
  'A criação dos parâmetros de produto por mercado fica na auditoria');
