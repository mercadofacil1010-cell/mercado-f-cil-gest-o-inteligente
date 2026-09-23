-- Testes de endereçamento de depósito e gôndola (B3.1).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('70000000-0000-0000-0000-00000000000a','dono-loc@x.com','{"full_name":"Dono Localizacao"}'),
 ('70000000-0000-0000-0000-00000000000b','gerente-loc@x.com','{"full_name":"Gerente Localizacao"}'),
 ('70000000-0000-0000-0000-00000000000c','repositor-loc@x.com','{"full_name":"Repositor Localizacao"}'),
 ('70000000-0000-0000-0000-00000000000d','dono-outra-loc@x.com','{"full_name":"Dono Outra Empresa Localizacao"}');

select test.as_user('70000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Localizacao Ltda','Rede Localizacao','44556677000186');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('70000000-0000-0000-0000-00000000000b','manager'),('70000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '44556677000186';

select test.as_user('70000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Localizacao Ltda','Outra Localizacao','55667788000186');

reset role;
select id as rede_id from public.companies where cnpj = '44556677000186' \gset
select id as outra_rede_id from public.companies where cnpj = '55667788000186' \gset

select test.as_user('70000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Centro', 'LOC-CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Bairro', 'LOC-BRR-1');
insert into public.products (company_id, name, base_unit) values (:'rede_id'::uuid, 'Leite 1L', 'unidade');

reset role;
select id as loja_centro_id from public.markets where internal_code = 'LOC-CTR-1' \gset
select id as loja_bairro_id from public.markets where internal_code = 'LOC-BRR-1' \gset
select id as leite_id from public.products where name = 'Leite 1L' \gset

-- Gerente só tem acesso à Loja Centro (mesma regra do B2.3/B1.5).
insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_centro_id'::uuid from public.company_members cm
where cm.user_id = '70000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('70000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values (:'outra_rede_id'::uuid, 'Loja Estranha', 'LOC-EST-1');
insert into public.products (company_id, name, base_unit) values (:'outra_rede_id'::uuid, 'Produto Estranho', 'unidade');

reset role;
select id as loja_estranha_id from public.markets where internal_code = 'LOC-EST-1' \gset
select id as produto_estranho_id from public.products where name = 'Produto Estranho' \gset

-- Dono cadastra endereço de depósito e posição de gôndola na Loja Centro.
select test.as_user('70000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_centro_id'::uuid, 'Depósito 1', 'Laticínios', 'A', '01', '01', '01', '01', 'DEP-A-01-01-01-01', 60);
select test.ok((select count(*) from public.warehouse_addresses where code = 'DEP-A-01-01-01-01') = 1,
  'Dono cadastra endereço de depósito');

insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_centro_id'::uuid, 'Laticínios', '02', '02', 'A', 1, 1, 1, 'GND-02-A-1-1-1', :'leite_id'::uuid, 10, 30, 40, 48);
select test.ok((select count(*) from public.gondola_positions where code = 'GND-02-A-1-1-1') = 1,
  'Dono cadastra posição de gôndola com produto-alvo');

-- Código único por mercado.
select test.throws(format($$insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
  values ('%s'::uuid, 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'dep-a-01-01-01-01', 10)$$, :'loja_centro_id'),
  'Código de endereço de depósito repetido no mesmo mercado é recusado (sem diferenciar maiúsculas)');
select test.throws(format($$insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, min_quantity, ideal_quantity, max_quantity, capacity)
  values ('%s'::uuid, 'X', 'X', 'X', 'A', 1, 1, 1, 'gnd-02-a-1-1-1', 0, 0, 0, 10)$$, :'loja_centro_id'),
  'Código de posição de gôndola repetido no mesmo mercado é recusado');

-- RN-LOC-01: mínimo <= ideal <= máximo.
select test.throws(format($$insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, min_quantity, ideal_quantity, max_quantity, capacity)
  values ('%s'::uuid, 'X', '02', '02', 'B', 1, 1, 1, 'GND-INVALIDA-1', 20, 10, 30, 40)$$, :'loja_centro_id'),
  'Ideal menor que o mínimo é recusado na posição de gôndola');
select test.throws(format($$insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, min_quantity, ideal_quantity, max_quantity, capacity)
  values ('%s'::uuid, 'X', '02', '02', 'B', 1, 1, 2, 'GND-INVALIDA-2', 10, 30, 20, 40)$$, :'loja_centro_id'),
  'Máximo menor que o ideal é recusado na posição de gôndola');

-- Não é possível ligar produto de outra empresa a uma posição de gôndola.
select test.throws(format($$insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
  values ('%s'::uuid, 'X', '02', '02', 'B', 1, 1, 3, 'GND-INVALIDA-3', '%s'::uuid, 0, 0, 0, 10)$$, :'loja_centro_id', :'produto_estranho_id'),
  'Não é possível atribuir produto de outra empresa a uma posição de gôndola');

-- RN-LOC-06: alterar limites exige justificativa.
select id as posicao_id from public.gondola_positions where code = 'GND-02-A-1-1-1' \gset
select id as endereco_id from public.warehouse_addresses where code = 'DEP-A-01-01-01-01' \gset

select test.throws(format($$select public.update_gondola_position_limits('%s'::uuid, 12, 32, 42, 50, '')$$, :'posicao_id'),
  'Alterar limites da gôndola sem justificativa é recusado');
select test.throws(format($$select public.update_warehouse_address_capacity('%s'::uuid, 80, null)$$, :'endereco_id'),
  'Alterar capacidade do endereço sem justificativa é recusado');

select public.update_gondola_position_limits(:'posicao_id'::uuid, 12, 32, 42, 50, 'Ajuste de planograma pós-inventário');
select test.ok((select min_quantity from public.gondola_positions where id = :'posicao_id'::uuid) = 12,
  'Dono altera limites da gôndola com justificativa');

select public.update_warehouse_address_capacity(:'endereco_id'::uuid, 80, 'Reorganização do depósito');
select test.ok((select capacity from public.warehouse_addresses where id = :'endereco_id'::uuid) = 80,
  'Dono altera capacidade do endereço com justificativa');

-- A justificativa fica registrada na auditoria (RN-LOC-06).
select test.ok((select count(*) from public.audit_log
  where entity = 'gondola_positions' and entity_id = :'posicao_id' and context ->> 'justification' = 'Ajuste de planograma pós-inventário') >= 1,
  'A justificativa da alteração de limites da gôndola fica na auditoria');
select test.ok((select count(*) from public.audit_log
  where entity = 'warehouse_addresses' and entity_id = :'endereco_id' and context ->> 'justification' = 'Reorganização do depósito') >= 1,
  'A justificativa da alteração de capacidade do depósito fica na auditoria');

-- Gerente também pode editar/cadastrar na Loja Centro (mercado a que tem acesso).
reset role;
select test.as_user('70000000-0000-0000-0000-00000000000b');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_centro_id'::uuid, 'Depósito 1', 'Bebidas', 'C', '03', '02', '01', '01', 'DEP-C-03-02-01-01', 80);
select test.ok((select count(*) from public.warehouse_addresses where code = 'DEP-C-03-02-01-01') = 1,
  'Gerente cadastra endereço de depósito na Loja Centro');

-- Gerente sem acesso à Loja Bairro não cadastra nem enxerga lá.
select test.throws(format($$insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
  values ('%s'::uuid, 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'DEP-BAIRRO-1', 10)$$, :'loja_bairro_id'),
  'Gerente sem acesso à Loja Bairro não cadastra endereço lá');

-- Repositor (stocker) não vê nem cadastra endereços.
reset role;
select test.as_user('70000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.warehouse_addresses) = 0, 'Repositor não enxerga endereços de depósito');
select test.ok((select count(*) from public.gondola_positions) = 0, 'Repositor não enxerga posições de gôndola');
select test.throws(format($$insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
  values ('%s'::uuid, 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'DEP-REPOSITOR-1', 10)$$, :'loja_centro_id'),
  'Repositor não pode cadastrar endereço de depósito');

-- Isolamento entre empresas.
reset role;
select test.as_user('70000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.warehouse_addresses where market_id = :'loja_centro_id'::uuid) = 0,
  'Dono de outra empresa não vê endereços de mercado alheio (RLS)');
select test.ok((select count(*) from public.gondola_positions where market_id = :'loja_centro_id'::uuid) = 0,
  'Dono de outra empresa não vê posições de gôndola de mercado alheio (RLS)');

-- Sem exclusão física (RN-ACL-06).
reset role;
select test.as_user('70000000-0000-0000-0000-00000000000a');
select test.throws(format($$delete from public.warehouse_addresses where id = '%s'::uuid$$, :'endereco_id'),
  'Excluir fisicamente um endereço de depósito é recusado');
select test.throws(format($$delete from public.gondola_positions where id = '%s'::uuid$$, :'posicao_id'),
  'Excluir fisicamente uma posição de gôndola é recusado');
update public.warehouse_addresses set status = 'inactive' where id = :'endereco_id'::uuid;
select test.ok((select status from public.warehouse_addresses where id = :'endereco_id'::uuid) = 'inactive',
  'Endereço de depósito é inativado em vez de excluído');
