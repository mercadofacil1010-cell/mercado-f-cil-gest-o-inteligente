-- Testes do livro de movimentos e saldos de estoque (B3.2).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('80000000-0000-0000-0000-00000000000a','dono-mov@x.com','{"full_name":"Dono Movimentos"}'),
 ('80000000-0000-0000-0000-00000000000b','gerente-mov@x.com','{"full_name":"Gerente Movimentos"}'),
 ('80000000-0000-0000-0000-00000000000c','repositor-mov@x.com','{"full_name":"Repositor Movimentos"}'),
 ('80000000-0000-0000-0000-00000000000d','dono-outra-mov@x.com','{"full_name":"Dono Outra Empresa Movimentos"}');

select test.as_user('80000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Movimentos Ltda','Rede Movimentos','66778899000186');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('80000000-0000-0000-0000-00000000000b','manager'),('80000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '66778899000186';

select test.as_user('80000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Movimentos Ltda','Outra Movimentos','77889911000146');

reset role;
select id as rede_id from public.companies where cnpj = '66778899000186' \gset
select id as outra_rede_id from public.companies where cnpj = '77889911000146' \gset

select test.as_user('80000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Centro', 'MOV-CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Bairro', 'MOV-BRR-1');
insert into public.products (company_id, name, base_unit) values (:'rede_id'::uuid, 'Feijão Movimentos 1kg', 'unidade');

reset role;
select id as loja_centro_id from public.markets where internal_code = 'MOV-CTR-1' \gset
select id as loja_bairro_id from public.markets where internal_code = 'MOV-BRR-1' \gset
select id as feijao_mov_id from public.products where name = 'Feijão Movimentos 1kg' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_centro_id'::uuid from public.company_members cm
where cm.user_id = '80000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('80000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_centro_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'MOV-END-1', 100);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_bairro_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'MOV-END-2', 100);

select test.as_user('80000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values (:'outra_rede_id'::uuid, 'Loja Estranha', 'MOV-EST-1');
insert into public.products (company_id, name, base_unit) values (:'outra_rede_id'::uuid, 'Produto Estranho Movimentos', 'unidade');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values ((select id from public.markets where internal_code = 'MOV-EST-1'), 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'MOV-END-3', 10);

reset role;
select id as endereco_centro_id from public.warehouse_addresses where code = 'MOV-END-1' \gset
select id as endereco_bairro_id from public.warehouse_addresses where code = 'MOV-END-2' \gset
select id as endereco_estranho_id from public.warehouse_addresses where code = 'MOV-END-3' \gset
select id as produto_estranho_mov_id from public.products where name = 'Produto Estranho Movimentos' \gset

-- Dono registra entrada, saldo aumenta.
select test.as_user('80000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'entrada', 100, 'Recebimento inicial');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 100,
  'Entrada de 100 gera saldo 100');

-- Saída reduz o saldo.
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'saida', -30, 'Venda balcão');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 70,
  'Saída de 30 deixa saldo 70');

-- Ajuste aceita os dois sinais.
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'ajuste', 5, 'Contagem encontrou a mais');
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'ajuste', -2, 'Contagem encontrou a menos');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 73,
  'Ajustes positivo e negativo resultam em saldo 73 (exemplo 100+24-30-2+1=93 adaptado)');

-- Validação de sinal por tipo.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', -5, null, null)$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Entrada com quantidade negativa é recusada');
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'saida', 5, null, null)$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Saída com quantidade positiva é recusada');
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 0, null, null)$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Quantidade zero é recusada');

-- Estoque negativo é bloqueado por padrão (PA-15).
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'saida', -1000, null, null)$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Movimento que deixaria o saldo negativo é recusado sem justificativa');
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'saida', -1000, 'Venda emergencial', 'Cliente não pode esperar, ajustar depois');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = -927,
  'Com justificativa, o movimento negativo é aceito (saldo -927)');
select test.ok((select count(*) from public.audit_log
  where entity = 'stock_movements' and context ->> 'justification' = 'Cliente não pode esperar, ajustar depois') >= 1,
  'A justificativa do estoque negativo fica na auditoria (ocorrência)');

-- Produto de outra empresa é recusado.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null)$$, :'endereco_centro_id', :'produto_estranho_mov_id'),
  'Produto de outra empresa é recusado no movimento');

-- Estorno cria uma linha compensatória, sem apagar a original.
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'entrada', 1000, 'Recebimento de ajuste');
select id as movimento_1000_id from public.stock_movements where reference = 'Recebimento de ajuste' \gset
select public.reverse_stock_movement(:'movimento_1000_id'::uuid, 'Lançamento duplicado por engano');
select test.ok((select count(*) from public.stock_movements where reversal_of = :'movimento_1000_id'::uuid) = 1,
  'Estorno cria uma linha compensatória');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = -927,
  'Depois do estorno, o saldo volta ao valor de antes do movimento estornado (-927)');
select test.throws(format($$select public.reverse_stock_movement('%s'::uuid, 'De novo')$$, :'movimento_1000_id'),
  'Não é possível estornar o mesmo movimento duas vezes');
select id as estorno_id from public.stock_movements where reversal_of = :'movimento_1000_id'::uuid \gset
select test.throws(format($$select public.reverse_stock_movement('%s'::uuid, 'Estorno do estorno')$$, :'estorno_id'),
  'Não é possível estornar um estorno');
select test.throws(format($$select public.reverse_stock_movement('%s'::uuid, '')$$, :'movimento_1000_id'),
  'Estornar sem justificativa é recusado');

-- Traz o saldo de volta a um valor positivo simples para continuar os testes
-- (o resultado final não fica negativo, então não exige justificativa).
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'entrada', 1000, 'Correção de saldo para os próximos testes');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 73,
  'Correção traz o saldo de volta a 73');

-- Saldo do mercado agrega os endereços daquele mercado (RN-CRT-EST-02).
select test.ok((select balance from public.market_product_balances where market_id = :'loja_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 73,
  'Saldo do mercado reflete os movimentos dos seus endereços');

-- Gerente com acesso à Loja Centro também registra movimento.
reset role;
select test.as_user('80000000-0000-0000-0000-00000000000b');
select public.register_stock_movement(:'endereco_centro_id'::uuid, :'feijao_mov_id'::uuid, 'entrada', 10, 'Gerente registrou');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_centro_id'::uuid and product_id = :'feijao_mov_id'::uuid) = 83,
  'Gerente com acesso registra movimento na Loja Centro');

-- Gerente sem acesso à Loja Bairro não registra movimento lá.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null)$$, :'endereco_bairro_id', :'feijao_mov_id'),
  'Gerente sem acesso à Loja Bairro não registra movimento lá');

-- Repositor não registra movimento nem estorna.
reset role;
select test.as_user('80000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null)$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Repositor não pode registrar movimento de estoque');
select test.ok((select count(*) from public.stock_movements) = 0, 'Repositor não enxerga movimentos de estoque');

-- Isolamento entre empresas.
reset role;
select test.as_user('80000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.stock_movements where warehouse_address_id = :'endereco_centro_id'::uuid) = 0,
  'Dono de outra empresa não vê movimentos de mercado alheio (RLS)');
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null)$$, :'endereco_centro_id', :'produto_estranho_mov_id'),
  'Dono de outra empresa não registra movimento em endereço alheio');

-- Ninguém insere/atualiza/apaga direto na tabela (ledger imutável, RF-EST-07).
reset role;
select test.as_user('80000000-0000-0000-0000-00000000000a');
select test.throws(format($$insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, created_by)
  values ('%s'::uuid, '%s'::uuid, 'entrada', 1, '80000000-0000-0000-0000-00000000000a')$$, :'endereco_centro_id', :'feijao_mov_id'),
  'Ninguém insere movimento direto na tabela — só register_stock_movement — permission denied for table stock_movements');
select test.throws(format($$update public.stock_movements set quantity = 999 where warehouse_address_id = '%s'::uuid$$, :'endereco_centro_id'),
  'Ninguém altera um movimento — permission denied for table stock_movements');
select test.throws(format($$delete from public.stock_movements where warehouse_address_id = '%s'::uuid$$, :'endereco_centro_id'),
  'Ninguém apaga um movimento — permission denied for table stock_movements');
