-- Testes dos indicadores reais do painel (B8.1) — faturamento/ticket médio/
-- itens vendidos a partir de vendas do PDV (com e sem preço no catálogo),
-- estoque baixo/ruptura, reposição pendente, validade, perdas,
-- inconsistências abertas, acuracidade de inventário, giro/cobertura/sem
-- giro, ranking de produtos, feed de operação, indicador consolidado da
-- rede (só dono) e controle de acesso.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fc000000-0000-0000-0000-00000000000a','dono-b81@x.com','{"full_name":"Dono B81"}'),
 ('fc000000-0000-0000-0000-00000000000b','gerente-b81@x.com','{"full_name":"Gerente B81"}'),
 ('fc000000-0000-0000-0000-00000000000c','repositor-b81@x.com','{"full_name":"Repositor B81"}'),
 ('fc000000-0000-0000-0000-00000000000d','dono-outra-b81@x.com','{"full_name":"Dono Outra B81"}');

select test.as_user('fc000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B81 Ltda','Rede B81','66007700014095');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('fc000000-0000-0000-0000-00000000000b','manager'),
         ('fc000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '66007700014095';

select test.as_user('fc000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B81 Ltda','Outra B81','66007700014176');

reset role;
select id as rede_id from public.companies where cnpj = '66007700014095' \gset

select test.as_user('fc000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B81', 'B81-CTR-1');
-- Produto 1: tem preço de venda cadastrado (faturamento real).
insert into public.products (company_id, name, base_unit, tracks_batch_expiry, sale_price) values (:'rede_id'::uuid, 'Produto 1 B81', 'unidade', false, 5.00);
-- Produto 2: sem preço no catálogo — só o preço que o PDV mandar conta.
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto 2 B81', 'unidade', false);
-- Produto 3: nunca vendido (testa "produto sem giro").
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto 3 B81', 'unidade', false);
-- Produto 4: usado só para perda/validade/inventário.
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto 4 B81', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'B81-CTR-1' \gset
select id as produto1_id from public.products where name = 'Produto 1 B81' \gset
select id as produto2_id from public.products where name = 'Produto 2 B81' \gset
select id as produto3_id from public.products where name = 'Produto 3 B81' \gset
select id as produto4_id from public.products where name = 'Produto 4 B81' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('fc000000-0000-0000-0000-00000000000b'::uuid, 'fc000000-0000-0000-0000-00000000000c'::uuid);

select test.as_user('fc000000-0000-0000-0000-00000000000a');
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto1_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto2_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto3_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto4_id'::uuid, 'Unidade', 1, true);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B81-END-1', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '1', 'A', 1, 1, 1, 'B81-POS-1', :'produto1_id'::uuid, 5, 50, 100, 100, 50);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '2', 'A', 1, 1, 1, 'B81-POS-2', :'produto2_id'::uuid, 5, 30, 50, 50, 30);
-- Posição de produto 3: nunca vende (sem giro) e já nasce abaixo do mínimo (estoque baixo/ruptura).
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '3', 'A', 1, 1, 1, 'B81-POS-3', :'produto3_id'::uuid, 10, 30, 40, 40, 0);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B81-END-1' \gset
select id as posicao3_id from public.gondola_positions where code = 'B81-POS-3' \gset

select test.as_user('fc000000-0000-0000-0000-00000000000b');
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-P1', :'produto1_id'::uuid, (select id from public.product_packagings where product_id = :'produto1_id'::uuid));
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-P2', :'produto2_id'::uuid, (select id from public.product_packagings where product_id = :'produto2_id'::uuid));

------------------------------------------------------------
-- Caso 1: venda com produto de preço no catálogo (sem preço no evento —
-- usa o preço do produto) e produto sem preço no catálogo (preço vem do
-- próprio evento, como um PDV real mandaria).
------------------------------------------------------------
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B81-001', 'venda', now(),
  '[{"external_product_code":"PDV-P1","quantity":4},{"external_product_code":"PDV-P2","quantity":2,"unit_price":3.50}]'::jsonb
);
reset role;
select id as evento1_id from public.sale_events where external_event_id = 'EVT-B81-001' \gset

select test.ok((select unit_price from public.sale_event_items where sale_event_id = :'evento1_id'::uuid and external_product_code = 'PDV-P1') = 5.00,
  'Item sem preço no evento usa o preço do catálogo (snapshot no mapeamento)');
select test.ok((select unit_price from public.sale_event_items where sale_event_id = :'evento1_id'::uuid and external_product_code = 'PDV-P2') = 3.50,
  'Item com preço no próprio evento usa o preço informado pelo PDV');

------------------------------------------------------------
-- Caso 2: cancelamento parcial do produto 1 — reduz faturamento/itens.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B81-001-CANC', 'cancelamento', now(),
  '[{"external_product_code":"PDV-P1","quantity":1}]'::jsonb,
  'EVT-B81-001'
);
reset role;

------------------------------------------------------------
-- Caso 3: perda registrada, inconsistência aberta e lote perto do
-- vencimento — para os indicadores que não dependem de venda.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000a');
select public.get_or_create_lot(:'endereco_id'::uuid, :'produto4_id'::uuid, 'LOTE-B81-1', current_date + 3);
reset role;
select id as lote_b81_id from public.lots where batch_number = 'LOTE-B81-1' \gset
select test.as_user('fc000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'produto4_id'::uuid, 'entrada', 100, 'Compra inicial', null, :'lote_b81_id'::uuid);
select public.register_stock_movement(:'endereco_id'::uuid, :'produto4_id'::uuid, 'perda', -6, 'Produto avariado', null, :'lote_b81_id'::uuid);
select public.register_stock_movement(:'endereco_id'::uuid, :'produto4_id'::uuid, 'entrada', 10, 'Compra', null, :'lote_b81_id'::uuid);

select test.as_user('fc000000-0000-0000-0000-00000000000b');
select public.start_inventory_count(:'endereco_id'::uuid);
reset role;
select id as contagem_id from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid and status = 'aberta' \gset
select test.as_user('fc000000-0000-0000-0000-00000000000b');
select public.set_inventory_count_item(:'contagem_id'::uuid, :'produto4_id'::uuid, 104);
select public.finalize_inventory_count(:'contagem_id'::uuid);
reset role;

------------------------------------------------------------
-- Caso 4: indicadores do mercado — todos juntos.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000b');
select public.get_market_dashboard(:'loja_id'::uuid, 1) as painel \gset
reset role;

select test.ok((:'painel'::jsonb ->> 'revenue')::numeric = 22.00,
  'Faturamento líquido: (4×5,00 + 2×3,50) − 1×5,00 (cancelamento) = 22,00');
select test.ok((:'painel'::jsonb ->> 'salesCount')::int = 1,
  'Vendas realizadas conta só o evento de venda, não o cancelamento');
select test.ok((:'painel'::jsonb ->> 'avgTicket')::numeric = 22.00,
  'Ticket médio = faturamento / vendas realizadas (só 1 venda aqui)');
select test.ok((:'painel'::jsonb ->> 'itemsSold')::numeric = 5,
  'Itens vendidos líquido: (4+2) − 1 do cancelamento = 5');
select test.ok((:'painel'::jsonb ->> 'lowStockPositions')::int = 1,
  'Estoque baixo: só a posição do produto 3 (saldo 0 <= mínimo 10)');
select test.ok((:'painel'::jsonb ->> 'rupturaPositions')::int = 1,
  'Ruptura: só a posição do produto 3 (saldo 0)');
select test.ok((:'painel'::jsonb ->> 'nearExpiryLots')::int = 1,
  'Lote perto do vencimento (3 dias, dentro da janela padrão de 7)');
select test.ok((:'painel'::jsonb ->> 'losses')::numeric = 6,
  'Perdas do período: 6 unidades registradas como perda');
select test.ok((:'painel'::jsonb ->> 'accuracyPct')::numeric = 100,
  'Acuracidade: teórico 104 (100+10−6), contado 104 → 100% — nenhuma diferença aqui');
select test.ok((:'painel'::jsonb ->> 'openIncidents')::int = 0,
  'Nenhuma inconsistência aberta ainda — a contagem bateu certinho');
-- Saldo atual das posições depois da baixa automática do B7.3: produto 1
-- saiu de 50 para 47 (venda de 4, cancelamento devolveu 1), produto 2 saiu
-- de 30 para 28 (venda de 2), produto 3 continua em 0 — total 75.
select test.ok(round((:'painel'::jsonb ->> 'turnover')::numeric, 6) = round(5::numeric / 75, 6),
  'Giro (unidades): 5 vendidas líquidas / 75 de saldo atual das posições');
select test.ok((:'painel'::jsonb ->> 'coverageDays')::numeric = 15,
  'Cobertura: 75 de saldo atual / 5 vendidos por dia (período de 1 dia) = 15 dias');
select test.ok((:'painel'::jsonb ->> 'noTurnoverProducts')::int = 1,
  'Produto sem giro: só o produto 3, que nunca vendeu (tem posição, zero venda no período)');

------------------------------------------------------------
-- Caso 5: ranking de produtos — mais vendido e sem giro.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000b');
select product_id, product_name, quantity_sold from public.list_product_sales_ranking(:'loja_id'::uuid, 1, 5, 'top') where product_id = :'produto1_id'::uuid \gset
reset role;
select test.ok(:'quantity_sold'::numeric = 3, 'Produto 1 é o mais vendido do período: 4 vendidos − 1 cancelado = 3');

select test.as_user('fc000000-0000-0000-0000-00000000000b');
select product_id, quantity_sold from public.list_product_sales_ranking(:'loja_id'::uuid, 1, 5, 'bottom') where product_id = :'produto3_id'::uuid \gset
reset role;
select test.ok(:'quantity_sold'::numeric = 0, 'Produto 3 aparece no ranking de menor giro com zero vendas');

select test.as_user('fc000000-0000-0000-0000-00000000000c');
select test.throws(format($$select * from public.list_product_sales_ranking('%s'::uuid, 1, 5, 'top')$$, :'loja_id'),
  'Repositor não pode ver o ranking de produtos');

------------------------------------------------------------
-- Caso 6: feed de operação — a venda processada aparece.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.list_market_feed(:'loja_id'::uuid, 20) where kind = 'venda') >= 1,
  'Feed de operação mostra a venda processada');

------------------------------------------------------------
-- Caso 7: acesso — repositor não vê os indicadores; outra empresa não vê
-- indicadores de mercado alheio; indicador consolidado da rede é só do dono.
------------------------------------------------------------
select test.as_user('fc000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.get_market_dashboard('%s'::uuid, 1)$$, :'loja_id'),
  'Repositor não pode ver os indicadores do mercado');

select test.as_user('fc000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.get_market_dashboard('%s'::uuid, 1)$$, :'loja_id'),
  'Dono de outra empresa não pode ver indicadores de mercado alheio');

select test.as_user('fc000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.get_company_dashboard('%s'::uuid, 1)$$, :'rede_id'),
  'Gerente não pode ver o indicador consolidado da rede — só o dono');

select test.as_user('fc000000-0000-0000-0000-00000000000a');
select jsonb_array_length((select public.get_company_dashboard(:'rede_id'::uuid, 1)) -> 'markets') as qtd_mercados \gset
reset role;
select test.ok(:'qtd_mercados'::int = 1, 'Dono lista o indicador consolidado com o único mercado da rede');
