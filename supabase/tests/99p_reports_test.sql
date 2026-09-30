-- Testes dos relatórios (B8.2) — um de cada tipo com dado real, exportação
-- fica a cargo da tela (gerada no navegador a partir do que a função devolve,
-- RN-RPT-04/PA-50), controle de acesso e relatório desconhecido bloqueado.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fd000000-0000-0000-0000-00000000000a','dono-b82@x.com','{"full_name":"Dono B82"}'),
 ('fd000000-0000-0000-0000-00000000000b','gerente-b82@x.com','{"full_name":"Gerente B82"}'),
 ('fd000000-0000-0000-0000-00000000000c','conferente-b82@x.com','{"full_name":"Conferente B82"}'),
 ('fd000000-0000-0000-0000-00000000000d','repositor-b82@x.com','{"full_name":"Repositor B82"}'),
 ('fd000000-0000-0000-0000-00000000000e','dono-outra-b82@x.com','{"full_name":"Dono Outra B82"}');

select test.as_user('fd000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B82 Ltda','Rede B82','77008800014052');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('fd000000-0000-0000-0000-00000000000b','manager'),
         ('fd000000-0000-0000-0000-00000000000c','receiver'),
         ('fd000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '77008800014052';

select test.as_user('fd000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra B82 Ltda','Outra B82','77008800014133');

reset role;
select id as rede_id from public.companies where cnpj = '77008800014052' \gset

select test.as_user('fd000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B82', 'B82-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto X B82', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto Y B82', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'B82-CTR-1' \gset
select id as produtox_id from public.products where name = 'Produto X B82' \gset
select id as produtoy_id from public.products where name = 'Produto Y B82' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in (
  'fd000000-0000-0000-0000-00000000000b'::uuid,
  'fd000000-0000-0000-0000-00000000000c'::uuid,
  'fd000000-0000-0000-0000-00000000000d'::uuid
);

select test.as_user('fd000000-0000-0000-0000-00000000000a');
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produtox_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produtoy_id'::uuid, 'Unidade', 1, true);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B82-END-1', 1000);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 2', 'Mercearia', 'A', '02', '01', '01', '01', 'B82-END-2', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '1', 'A', 1, 1, 1, 'B82-POS-X', :'produtox_id'::uuid, 5, 30, 40, 40, 0);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '2', 'A', 1, 1, 1, 'B82-POS-Y', :'produtoy_id'::uuid, 5, 30, 40, 40, 20);

reset role;
select id as endereco1_id from public.warehouse_addresses where code = 'B82-END-1' \gset
select id as endereco2_id from public.warehouse_addresses where code = 'B82-END-2' \gset
select id as embalagemx_id from public.product_packagings where product_id = :'produtox_id'::uuid \gset
select id as posicaox_id from public.gondola_positions where code = 'B82-POS-X' \gset

------------------------------------------------------------
-- Fixtures: recebimento com divergência (recebimentos/divergencias),
-- movimentação/perda, transferência, lote perto do vencimento, tarefa de
-- reposição pendente e uma venda do PDV.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B82-001');
reset role;
select id as receb_id from public.receivings where invoice_number = 'NF-B82-001' \gset
select test.as_user('fd000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'receb_id'::uuid, :'produtox_id'::uuid, 100);

select test.as_user('fd000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'receb_id'::uuid);
select public.add_receiving_count(:'receb_id'::uuid, :'produtox_id'::uuid, :'embalagemx_id'::uuid, 95);

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'receb_id'::uuid, :'endereco1_id'::uuid, 'Faltaram 5 unidades na carga.');

reset role;
select test.as_user('fd000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco1_id'::uuid, :'produtox_id'::uuid, 'perda', -5, 'Produto avariado');
select public.register_stock_transfer(:'endereco1_id'::uuid, :'endereco2_id'::uuid, :'produtox_id'::uuid, 10, 'Transferência entre depósitos');
select public.get_or_create_lot(:'endereco1_id'::uuid, :'produtoy_id'::uuid, 'LOTE-B82-1', current_date + 3);
reset role;
select id as lote_id from public.lots where batch_number = 'LOTE-B82-1' \gset
select test.as_user('fd000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco1_id'::uuid, :'produtoy_id'::uuid, 'entrada', 20, 'Compra inicial', null, :'lote_id'::uuid);

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-X', :'produtox_id'::uuid, :'embalagemx_id'::uuid);
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B82-001', 'venda', now(),
  '[{"external_product_code":"PDV-X","quantity":2,"unit_price":4.00}]'::jsonb
);
reset role;

------------------------------------------------------------
-- Caso 1: estoque atual — saldo do produto X no depósito 1.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'estoque_atual', null, null, :'produtox_id'::uuid) as r_estoque \gset
reset role;
select test.ok(jsonb_array_length(:'r_estoque'::jsonb) >= 1, 'Relatório de estoque atual traz o produto X');

------------------------------------------------------------
-- Caso 2: extrato de movimentações.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'movimentacoes', now() - interval '1 day', now() + interval '1 day', null) as r_mov \gset
reset role;
select test.ok(jsonb_array_length(:'r_mov'::jsonb) >= 4, 'Extrato de movimentações traz entrada/perda/transferências');

------------------------------------------------------------
-- Caso 3: recebimentos e divergências.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'recebimentos', now() - interval '1 day', now() + interval '1 day', null) as r_receb \gset
reset role;
select test.ok(jsonb_array_length(:'r_receb'::jsonb) = 1, 'Relatório de recebimentos traz o recebimento finalizado');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'divergencias_recebimento', now() - interval '1 day', now() + interval '1 day', null) as r_div \gset
reset role;
select test.ok(jsonb_array_length(:'r_div'::jsonb) = 1, 'Relatório de divergências de recebimento traz a divergência gerada');
select test.ok((:'r_div'::jsonb -> 0 ->> 'diferenca')::numeric = -5, 'Divergência mostra a diferença certa (95 contado − 100 esperado)');

------------------------------------------------------------
-- Caso 4: reposições, rupturas e validade.
------------------------------------------------------------
-- Antes de qualquer registro manual de saldo: POS-X já está zerada (a venda
-- do PDV zerou sozinha, RN-EST-07/B7.3) — é o momento certo para o
-- relatório de rupturas ver essa posição.
select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'rupturas', null, null, null) as r_rupt \gset
reset role;
select test.ok(jsonb_array_length(:'r_rupt'::jsonb) >= 1, 'Relatório de rupturas traz posições com saldo zerado');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicaox_id'::uuid, 2);
select public.get_report(:'loja_id'::uuid, 'reposicoes', now() - interval '1 day', now() + interval '1 day', null) as r_rep \gset
reset role;
select test.ok(jsonb_array_length(:'r_rep'::jsonb) >= 1, 'Relatório de reposições traz a tarefa criada');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'validade', null, null, null) as r_val \gset
reset role;
select test.ok(jsonb_array_length(:'r_val'::jsonb) = 1, 'Relatório de validade traz o lote com saldo');

------------------------------------------------------------
-- Caso 5: perdas, vendas, sem giro, inconsistências e transferências.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'perdas', now() - interval '1 day', now() + interval '1 day', null) as r_perdas \gset
reset role;
select test.ok(jsonb_array_length(:'r_perdas'::jsonb) = 1, 'Relatório de perdas traz o movimento de perda');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'vendas', now() - interval '1 day', now() + interval '1 day', null) as r_vendas \gset
reset role;
select test.ok(jsonb_array_length(:'r_vendas'::jsonb) = 1, 'Relatório de vendas traz o item vendido');
select test.ok((:'r_vendas'::jsonb -> 0 ->> 'preco_unitario')::numeric = 4.00, 'Relatório de vendas mostra o preço realmente usado');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'sem_giro', now() - interval '1 day', now() + interval '1 day', null) as r_semgiro \gset
reset role;
select test.ok((select count(*) from jsonb_array_elements(:'r_semgiro'::jsonb) x where x ->> 'produto' = 'Produto Y B82') = 1,
  'Relatório de produtos sem giro traz o produto Y, que nunca vendeu');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'inconsistencias', now() - interval '1 day', now() + interval '1 day', null) as r_inc \gset
reset role;
select test.ok(jsonb_array_length(:'r_inc'::jsonb) >= 1, 'Relatório de inconsistências traz a ocorrência do recebimento');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select public.get_report(:'loja_id'::uuid, 'transferencias', now() - interval '1 day', now() + interval '1 day', null) as r_transf \gset
reset role;
select test.ok(jsonb_array_length(:'r_transf'::jsonb) = 1, 'Relatório de transferências agrupa as duas pernas em uma linha');
select test.ok((:'r_transf'::jsonb -> 0 ->> 'quantidade')::numeric = 10, 'Transferência mostra a quantidade movida');

------------------------------------------------------------
-- Caso 6: acesso e relatório desconhecido.
------------------------------------------------------------
select test.as_user('fd000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.get_report('%s'::uuid, 'estoque_atual', null, null, null)$$, :'loja_id'),
  'Repositor não pode ver relatórios deste mercado');

select test.as_user('fd000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.get_report('%s'::uuid, 'estoque_atual', null, null, null)$$, :'loja_id'),
  'Dono de outra empresa não pode ver relatórios de mercado alheio');

select test.as_user('fd000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.get_report('%s'::uuid, 'relatorio_inventado', null, null, null)$$, :'loja_id'),
  'Nome de relatório desconhecido é bloqueado');
