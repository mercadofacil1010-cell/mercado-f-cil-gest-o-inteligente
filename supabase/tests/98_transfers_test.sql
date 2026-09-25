-- Testes de transferência entre endereços de depósito do mesmo mercado (B3.5).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('b0000000-0000-0000-0000-00000000000a','dono-transf@x.com','{"full_name":"Dono Transferencia"}'),
 ('b0000000-0000-0000-0000-00000000000b','gerente-transf@x.com','{"full_name":"Gerente Transferencia"}'),
 ('b0000000-0000-0000-0000-00000000000c','repositor-transf@x.com','{"full_name":"Repositor Transferencia"}'),
 ('b0000000-0000-0000-0000-00000000000d','dono-outra-transf@x.com','{"full_name":"Dono Outra Empresa Transferencia"}');

select test.as_user('b0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Transferencia Ltda','Rede Transferencia','15339731000133');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('b0000000-0000-0000-0000-00000000000b','manager'),('b0000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '15339731000133';

select test.as_user('b0000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Transferencia Ltda','Outra Transferencia','67059057000137');

reset role;
select id as rede_id from public.companies where cnpj = '15339731000133' \gset

select test.as_user('b0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Transferencia', 'TRF-CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Transferencia Bairro', 'TRF-BAI-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Feijao Transferencia 1kg', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Iogurte Transferencia', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'TRF-CTR-1' \gset
select id as loja_bairro_id from public.markets where internal_code = 'TRF-BAI-1' \gset
select id as feijao_id from public.products where name = 'Feijao Transferencia 1kg' \gset
select id as iogurte_id from public.products where name = 'Iogurte Transferencia' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('b0000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'TRF-END-A', 1000);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 2', 'Mercearia', 'B', '01', '01', '01', '01', 'TRF-END-B', 1000);

select test.as_user('b0000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values ((select id from public.companies where cnpj = '67059057000137'), 'Loja Estranha Transferencia', 'TRF-EST-1');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values ((select id from public.markets where internal_code = 'TRF-EST-1'), 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'TRF-END-X', 10);

reset role;
select id as endereco_a_id from public.warehouse_addresses where code = 'TRF-END-A' \gset
select id as endereco_b_id from public.warehouse_addresses where code = 'TRF-END-B' \gset
select id as endereco_estranho_id from public.warehouse_addresses where code = 'TRF-END-X' \gset

-- Endereço de outro mercado da MESMA empresa (Loja Bairro), sem endereço cadastrado ainda.
select test.as_user('b0000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_bairro_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'TRF-END-C', 1000);

reset role;
select id as endereco_c_id from public.warehouse_addresses where code = 'TRF-END-C' \gset

-- Entrada inicial no endereço A.
select test.as_user('b0000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_a_id'::uuid, :'feijao_id'::uuid, 'entrada', 100, 'Recebimento inicial');

-- Transferência simples (sem lote), origem A -> destino B, mesmo mercado.
select public.register_stock_transfer(:'endereco_a_id'::uuid, :'endereco_b_id'::uuid, :'feijao_id'::uuid, 30, 'Reorganização');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_a_id'::uuid and product_id = :'feijao_id'::uuid) = 70,
  'Transferência abate 30 do endereço de origem');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_b_id'::uuid and product_id = :'feijao_id'::uuid) = 30,
  'Transferência credita 30 no endereço de destino');
select test.ok((select count(*) from public.stock_movements where type = 'transferencia' and warehouse_address_id = :'endereco_a_id'::uuid and quantity = -30) = 1,
  'Perna de saída registrada como tipo transferência, quantidade negativa');
select test.ok((select count(*) from public.stock_movements where type = 'transferencia' and warehouse_address_id = :'endereco_b_id'::uuid and quantity = 30) = 1,
  'Perna de entrada registrada como tipo transferência, quantidade positiva');
select test.ok((select count(distinct transfer_id) from public.stock_movements where transfer_id is not null and product_id = :'feijao_id'::uuid) = 1,
  'As duas pernas compartilham o mesmo transfer_id');

-- Origem e destino iguais é recusado.
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 10, null, null, null)$$, :'endereco_a_id', :'endereco_a_id', :'feijao_id'),
  'Transferência com origem igual ao destino é recusada');

-- Quantidade zero/negativa é recusada.
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, -5, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'feijao_id'),
  'Transferência com quantidade negativa é recusada');
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 0, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'feijao_id'),
  'Transferência com quantidade zero é recusada');

-- Transferência entre mercados diferentes (mesma empresa) é recusada nesta etapa (PA-22).
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 5, null, null, null)$$, :'endereco_a_id', :'endereco_c_id', :'feijao_id'),
  'Transferência entre mercados diferentes é recusada nesta etapa');

-- Transferência que deixaria o saldo negativo exige justificativa.
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 1000, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'feijao_id'),
  'Transferência que deixaria saldo negativo sem justificativa é recusada');
select public.register_stock_transfer(:'endereco_a_id'::uuid, :'endereco_b_id'::uuid, :'feijao_id'::uuid, 1000, 'Consolidação forçada', 'Fechando o depósito A, movendo tudo para o B');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_a_id'::uuid and product_id = :'feijao_id'::uuid) = -930,
  'Com justificativa, a transferência que deixa saldo negativo é aceita (70 - 1000 = -930)');

-- Corrige de volta para não atrapalhar os testes de lote a seguir.
select public.register_stock_movement(:'endereco_a_id'::uuid, :'feijao_id'::uuid, 'entrada', 1000, 'Correção pós-teste');

-- Transferência com lote: mantém o mesmo número/validade no destino (DEC-B3-02).
select public.register_stock_movement(:'endereco_a_id'::uuid, :'iogurte_id'::uuid, 'entrada', 50, 'Recebimento', null,
  (select id from public.get_or_create_lot(:'endereco_a_id'::uuid, :'iogurte_id'::uuid, 'L-TRANSF-01', current_date + 15)));
reset role;
select id as lote_origem_id from public.lots where batch_number = 'L-TRANSF-01' \gset

select test.as_user('b0000000-0000-0000-0000-00000000000a');
select public.register_stock_transfer(:'endereco_a_id'::uuid, :'endereco_b_id'::uuid, :'iogurte_id'::uuid, 20, 'Redistribuição', null, :'lote_origem_id'::uuid);
select test.ok((select count(*) from public.lots where warehouse_address_id = :'endereco_b_id'::uuid and batch_number = 'L-TRANSF-01') = 1,
  'Lote com mesmo número é criado no endereço de destino');
select test.ok((select expires_at from public.lots where warehouse_address_id = :'endereco_b_id'::uuid and batch_number = 'L-TRANSF-01') = current_date + 15,
  'Lote no destino mantém a mesma validade do lote de origem');
select test.ok((select balance from public.lot_balances where lot_id = :'lote_origem_id'::uuid) = 30,
  'Saldo do lote de origem abatido em 20 (50 - 20)');
reset role;
select id as lote_destino_id from public.lots where warehouse_address_id = :'endereco_b_id'::uuid and batch_number = 'L-TRANSF-01' \gset
select test.as_user('b0000000-0000-0000-0000-00000000000a');
select test.ok((select balance from public.lot_balances where lot_id = :'lote_destino_id'::uuid) = 20,
  'Saldo do lote no destino é 20');

-- Produto que controla lote exige lote de origem na transferência.
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 5, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'iogurte_id'),
  'Transferência de produto com lote exige o lote de origem');

-- Lote bloqueado não pode ser transferido (mesma regra da saída, PA-19).
update public.lots set status = 'blocked' where id = :'lote_origem_id'::uuid;
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 5, null, null, '%s'::uuid)$$, :'endereco_a_id', :'endereco_b_id', :'iogurte_id', :'lote_origem_id'),
  'Transferência de lote bloqueado é recusada');
update public.lots set status = 'available' where id = :'lote_origem_id'::uuid;

-- Permissões e isolamento entre empresas.
reset role;
select test.as_user('b0000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'feijao_id'),
  'Repositor não pode registrar transferência');

reset role;
select test.as_user('b0000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.register_stock_transfer('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, null, null, null)$$, :'endereco_a_id', :'endereco_b_id', :'feijao_id'),
  'Dono de outra empresa não pode transferir estoque alheio');

reset role;
select test.as_user('b0000000-0000-0000-0000-00000000000b');
select public.register_stock_transfer(:'endereco_a_id'::uuid, :'endereco_b_id'::uuid, :'feijao_id'::uuid, 5, 'Ajuste de gerente');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_b_id'::uuid and product_id = :'feijao_id'::uuid) = 1035,
  'Gerente com acesso ao mercado registra transferência normalmente (30 + 1000 + 5)');
