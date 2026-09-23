-- Testes de lotes, validade e FEFO/FIFO (B3.3).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('90000000-0000-0000-0000-00000000000a','dono-lote@x.com','{"full_name":"Dono Lote"}'),
 ('90000000-0000-0000-0000-00000000000b','gerente-lote@x.com','{"full_name":"Gerente Lote"}'),
 ('90000000-0000-0000-0000-00000000000c','repositor-lote@x.com','{"full_name":"Repositor Lote"}'),
 ('90000000-0000-0000-0000-00000000000d','dono-outra-lote@x.com','{"full_name":"Dono Outra Empresa Lote"}');

select test.as_user('90000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Lotes Ltda','Rede Lotes','88991122000138');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('90000000-0000-0000-0000-00000000000b','manager'),('90000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '88991122000138';

select test.as_user('90000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Lotes Ltda','Outra Lotes','99112233000143');

reset role;
select id as rede_id from public.companies where cnpj = '88991122000138' \gset
select id as outra_rede_id from public.companies where cnpj = '99112233000143' \gset

select test.as_user('90000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Centro', 'LOT-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Iogurte Lote', 'unidade', true);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Prego Sem Lote', 'unidade', false);

reset role;
select id as loja_centro_id from public.markets where internal_code = 'LOT-CTR-1' \gset
select id as iogurte_id from public.products where name = 'Iogurte Lote' \gset
select id as prego_id from public.products where name = 'Prego Sem Lote' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_centro_id'::uuid from public.company_members cm
where cm.user_id = '90000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('90000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_centro_id'::uuid, 'Depósito 1', 'Laticínios', 'A', '01', '01', '01', '01', 'LOT-END-1', 100);

select test.as_user('90000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values (:'outra_rede_id'::uuid, 'Loja Estranha', 'LOT-EST-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'outra_rede_id'::uuid, 'Produto Estranho Lote', 'unidade', true);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values ((select id from public.markets where internal_code = 'LOT-EST-1'), 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'LOT-END-2', 10);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'LOT-END-1' \gset
select id as endereco_estranho_id from public.warehouse_addresses where code = 'LOT-END-2' \gset
select id as produto_estranho_id from public.products where name = 'Produto Estranho Lote' \gset

-- Dono cria dois lotes do iogurte, com validades diferentes.
select test.as_user('90000000-0000-0000-0000-00000000000a');
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'L-VENCE-CEDO', current_date + 5);
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'L-VENCE-TARDE', current_date + 30);
select test.ok((select count(*) from public.lots where product_id = :'iogurte_id'::uuid) = 2, 'Dois lotes criados para o iogurte');

-- Buscar o mesmo lote de novo não duplica (find-or-create).
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'l-vence-cedo', null);
select test.ok((select count(*) from public.lots where product_id = :'iogurte_id'::uuid and lower(batch_number) = 'l-vence-cedo') = 1,
  'Buscar o mesmo lote pelo número não cria duplicado (case-insensitive)');

reset role;
select id as lote_cedo_id from public.lots where batch_number = 'L-VENCE-CEDO' \gset
select id as lote_tarde_id from public.lots where batch_number = 'L-VENCE-TARDE' \gset

-- Entradas nos dois lotes.
select test.as_user('90000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 50, 'Recebimento', null, :'lote_cedo_id'::uuid);
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 50, 'Recebimento', null, :'lote_tarde_id'::uuid);
select test.ok((select balance from public.lot_balances where lot_id = :'lote_cedo_id'::uuid) = 50, 'Entrada no lote que vence cedo');
select test.ok((select balance from public.lot_balances where lot_id = :'lote_tarde_id'::uuid) = 50, 'Entrada no lote que vence tarde');

-- Produto com controle de lote exige lote no movimento.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null, null)$$, :'endereco_id', :'iogurte_id'),
  'Produto que controla lote exige lote no movimento');

-- Produto sem controle de lote não aceita lote informado.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 10, null, null, '%s'::uuid)$$, :'endereco_id', :'prego_id', :'lote_cedo_id'),
  'Produto sem controle de lote não aceita lote informado');

-- FEFO: saída deve sair do lote que vence primeiro; pular a ordem exige justificativa.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'saida', -10, null, null, '%s'::uuid)$$, :'endereco_id', :'iogurte_id', :'lote_tarde_id'),
  'Saída do lote que vence depois é recusada sem justificativa (fura o FEFO)');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'saida', -10, 'Venda', 'Cliente pediu especificamente o lote que vence depois', :'lote_tarde_id'::uuid);
select test.ok((select balance from public.lot_balances where lot_id = :'lote_tarde_id'::uuid) = 40,
  'Com justificativa, a saída do lote fora de ordem é aceita');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'saida', -10, 'Venda', null, :'lote_cedo_id'::uuid);
select test.ok((select balance from public.lot_balances where lot_id = :'lote_cedo_id'::uuid) = 40,
  'Saída do lote que vence primeiro é aceita sem justificativa (segue o FEFO)');

-- Bloquear o lote impede saída dele.
update public.lots set status = 'blocked' where id = :'lote_cedo_id'::uuid;
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'saida', -1, null, null, '%s'::uuid)$$, :'endereco_id', :'iogurte_id', :'lote_cedo_id'),
  'Saída de lote bloqueado é recusada');
update public.lots set status = 'available' where id = :'lote_cedo_id'::uuid;

-- Lote vencido não pode ser usado em saída, só em perda (descarte).
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'L-VENCIDO', current_date - 1);
reset role;
select id as lote_vencido_id from public.lots where batch_number = 'L-VENCIDO' \gset
select test.as_user('90000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 5, 'Recebimento antigo', 'Lote recebido já perto do fim da validade', :'lote_vencido_id'::uuid);
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'saida', -1, null, null, '%s'::uuid)$$, :'endereco_id', :'iogurte_id', :'lote_vencido_id'),
  'Saída de lote vencido é recusada');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'perda', -5, 'Descarte por vencimento', 'Lote vencido, descartado', :'lote_vencido_id'::uuid);
select test.ok((select balance from public.lot_balances where lot_id = :'lote_vencido_id'::uuid) = 0,
  'Perda descarta o lote vencido (saída não é permitida, mas perda é)');

-- Lote vencido com saldo aparece na view para virar "tarefa de retirada" (PA-19).
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 3, 'Outro recebimento vencido', 'Teste da fila de descarte', :'lote_vencido_id'::uuid);
select test.ok((select balance from public.expiring_lots where lot_id = :'lote_vencido_id'::uuid) = 3,
  'Lote vencido com saldo aparece na fila de descarte (expiring_lots)');
select test.ok((select days_until_expiry from public.expiring_lots where lot_id = :'lote_vencido_id'::uuid) < 0,
  'Dias até o vencimento é negativo para lote já vencido');

-- Estorno carrega o lote do movimento original.
select id as movimento_lote_id from public.stock_movements where reference = 'Outro recebimento vencido' \gset
select public.reverse_stock_movement(:'movimento_lote_id'::uuid, 'Lançamento de teste, desfazendo');
select test.ok((select balance from public.lot_balances where lot_id = :'lote_vencido_id'::uuid) = 0,
  'Estorno de movimento com lote também é aplicado ao lote (saldo volta a 0)');

-- RN-LOT-06: corrigir validade exige justificativa.
select test.throws(format($$select public.update_lot_expiry('%s'::uuid, current_date + 10, '')$$, :'lote_tarde_id'),
  'Corrigir validade do lote sem justificativa é recusado');
select public.update_lot_expiry(:'lote_tarde_id'::uuid, current_date + 10, 'Data de validade digitada errada no recebimento');
select test.ok((select expires_at from public.lots where id = :'lote_tarde_id'::uuid) = current_date + 10,
  'Dono corrige a validade do lote com justificativa');

-- Não é possível ligar lote de um endereço/produto a movimento de outro endereço.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 1, null, null, '%s'::uuid)$$, :'endereco_estranho_id', :'produto_estranho_id', :'lote_tarde_id'),
  'Lote de outro endereço não é aceito em movimento de endereço diferente');

-- Permissões e isolamento entre empresas.
reset role;
select test.as_user('90000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.lots) = 0, 'Repositor não enxerga lotes');
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'entrada', 1, null, null, '%s'::uuid)$$, :'endereco_id', :'iogurte_id', :'lote_tarde_id'),
  'Repositor não pode registrar movimento com lote');

reset role;
select test.as_user('90000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.lots where warehouse_address_id = :'endereco_id'::uuid) = 0,
  'Dono de outra empresa não vê lotes de mercado alheio (RLS)');

-- Sem exclusão física (RN-ACL-06).
reset role;
select test.as_user('90000000-0000-0000-0000-00000000000a');
select test.throws(format($$delete from public.lots where id = '%s'::uuid$$, :'lote_tarde_id'),
  'Excluir fisicamente um lote é recusado');
