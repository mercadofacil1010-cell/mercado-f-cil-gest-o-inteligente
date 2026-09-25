-- Testes de contagem de inventário (B3.6).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('c0000000-0000-0000-0000-00000000000a','dono-inv@x.com','{"full_name":"Dono Inventario"}'),
 ('c0000000-0000-0000-0000-00000000000b','gerente-inv@x.com','{"full_name":"Gerente Inventario"}'),
 ('c0000000-0000-0000-0000-00000000000c','repositor-inv@x.com','{"full_name":"Repositor Inventario"}'),
 ('c0000000-0000-0000-0000-00000000000d','dono-outra-inv@x.com','{"full_name":"Dono Outra Empresa Inventario"}');

select test.as_user('c0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Inventario Ltda','Rede Inventario','60731510000160');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('c0000000-0000-0000-0000-00000000000b','manager'),('c0000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '60731510000160';

select test.as_user('c0000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Inventario Ltda','Outra Inventario','75984390000180');

reset role;
select id as rede_id from public.companies where cnpj = '60731510000160' \gset

select test.as_user('c0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Inventario', 'INV-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Macarrao Inventario 500g', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Leite Inventario', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'INV-CTR-1' \gset
select id as macarrao_id from public.products where name = 'Macarrao Inventario 500g' \gset
select id as leite_id from public.products where name = 'Leite Inventario' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id = 'c0000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('c0000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'INV-END-1', 1000);

select test.as_user('c0000000-0000-0000-0000-00000000000d');
insert into public.markets (company_id, name, internal_code) values ((select id from public.companies where cnpj = '75984390000180'), 'Loja Estranha Inventario', 'INV-EST-1');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values ((select id from public.markets where internal_code = 'INV-EST-1'), 'Depósito 1', 'X', 'X', 'X', 'X', 'X', 'X', 'INV-END-X', 10);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'INV-END-1' \gset
select id as endereco_estranho_id from public.warehouse_addresses where code = 'INV-END-X' \gset

-- Entradas iniciais: macarrão 100, leite 40 num lote.
select test.as_user('c0000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'macarrao_id'::uuid, 'entrada', 100, 'Recebimento inicial');
select public.register_stock_movement(:'endereco_id'::uuid, :'leite_id'::uuid, 'entrada', 40, 'Recebimento inicial', null,
  (select id from public.get_or_create_lot(:'endereco_id'::uuid, :'leite_id'::uuid, 'L-INV-01', current_date + 20)));

-- Repositor não pode iniciar contagem.
reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.start_inventory_count('%s'::uuid)$$, :'endereco_id'),
  'Repositor não pode iniciar contagem');

-- Dono de outra empresa não pode iniciar contagem em endereço alheio.
reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.start_inventory_count('%s'::uuid)$$, :'endereco_id'),
  'Dono de outra empresa não pode iniciar contagem em endereço alheio');

-- Dono inicia a contagem.
reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000a');
select public.start_inventory_count(:'endereco_id'::uuid);
select test.ok((select count(*) from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid and status = 'aberta') = 1,
  'Contagem aberta criada para o endereço');

-- Não é possível abrir uma segunda contagem no mesmo endereço.
select test.throws(format($$select public.start_inventory_count('%s'::uuid)$$, :'endereco_id'),
  'Não é possível abrir uma segunda contagem enquanto a primeira estiver aberta');

reset role;
select id as contagem_id from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid and status = 'aberta' \gset

-- Conta macarrão a menos (98 em vez de 100) e leite igual (40).
select test.as_user('c0000000-0000-0000-0000-00000000000a');
select public.set_inventory_count_item(:'contagem_id'::uuid, :'macarrao_id'::uuid, 98);
select public.set_inventory_count_item(:'contagem_id'::uuid, :'leite_id'::uuid, 40);
select test.ok((select count(*) from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid) = 2,
  'Dois itens contados');

-- Corrigir a contagem antes de finalizar (upsert) — muda macarrão para 97.
select public.set_inventory_count_item(:'contagem_id'::uuid, :'macarrao_id'::uuid, 97);
select test.ok((select counted_quantity from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'macarrao_id'::uuid) = 97,
  'Corrigir a quantidade contada antes de finalizar substitui o valor (upsert)');

-- Teórico não é exposto durante a contagem (fica nulo até finalizar).
select test.ok((select theoretical_balance from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'macarrao_id'::uuid) is null,
  'Saldo teórico fica nulo enquanto a contagem está aberta (cega)');

-- Finaliza a contagem.
select public.finalize_inventory_count(:'contagem_id'::uuid);
select test.ok((select status from public.inventory_counts where id = :'contagem_id'::uuid) = 'finalizada',
  'Contagem muda para finalizada');
select test.ok((select theoretical_balance from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'macarrao_id'::uuid) = 100,
  'Saldo teórico do macarrão é revelado na finalização (100)');
select test.ok((select difference from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'macarrao_id'::uuid) = -3,
  'Diferença do macarrão é -3 (97 contado - 100 teórico)');
select test.ok((select resulting_movement_status from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'macarrao_id'::uuid) = 'posted',
  'Ajuste do macarrão foi lançado direto (abaixo do limite de aprovação)');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'macarrao_id'::uuid) = 97,
  'Saldo do macarrão reflete o ajuste automático (97)');
select test.ok((select resulting_movement_status from public.inventory_count_items where inventory_count_id = :'contagem_id'::uuid and product_id = :'leite_id'::uuid) = 'none',
  'Leite sem diferença não gera movimento');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'leite_id'::uuid) = 40,
  'Saldo do leite permanece 40 (sem diferença)');

-- Não é possível contar item nem finalizar de novo numa contagem já finalizada.
select test.throws(format($$select public.set_inventory_count_item('%s'::uuid, '%s'::uuid, 50)$$, :'contagem_id', :'macarrao_id'),
  'Não é possível editar item de contagem já finalizada');
select test.throws(format($$select public.finalize_inventory_count('%s'::uuid)$$, :'contagem_id'),
  'Não é possível finalizar uma contagem já finalizada');

-- Segunda contagem no mesmo endereço, agora com diferença acima do limite (> 20) — vai para aprovação.
select public.start_inventory_count(:'endereco_id'::uuid);
reset role;
select id as contagem_2_id from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid and status = 'aberta' \gset
select test.as_user('c0000000-0000-0000-0000-00000000000a');
select public.set_inventory_count_item(:'contagem_2_id'::uuid, :'macarrao_id'::uuid, 50);
select public.finalize_inventory_count(:'contagem_2_id'::uuid);
select test.ok((select resulting_movement_status from public.inventory_count_items where inventory_count_id = :'contagem_2_id'::uuid and product_id = :'macarrao_id'::uuid) = 'pending',
  'Diferença de -47 (acima do limite de 20) fica pendente de aprovação em vez de lançar direto');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'macarrao_id'::uuid) = 97,
  'Saldo do macarrão não muda enquanto o ajuste está pendente de aprovação');
select test.ok((select count(*) from public.pending_stock_adjustments where product_id = :'macarrao_id'::uuid and status = 'pending') = 1,
  'A contagem acima do limite cria um pedido pendente na mesma fila do B3.4');

-- Contagem sem nenhum item não pode ser finalizada.
reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000d');
select public.start_inventory_count(:'endereco_estranho_id'::uuid);
select test.throws(format($$select public.finalize_inventory_count((select id from public.inventory_counts where warehouse_address_id = '%s'::uuid and status = 'aberta'))$$, :'endereco_estranho_id'),
  'Contagem sem nenhum item contado não pode ser finalizada');

-- Isolamento entre empresas.
reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid) = 0,
  'Dono de outra empresa não vê contagens de mercado alheio (RLS)');

reset role;
select test.as_user('c0000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.inventory_count_items) = 0,
  'Repositor não enxerga itens de contagem (RLS)');
