-- Testes de decisão, entrada no estoque e finalização do recebimento (B4.3).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-00000000000a','dono-dec@x.com','{"full_name":"Dono Decisao"}'),
 ('f0000000-0000-0000-0000-00000000000b','gerente-dec@x.com','{"full_name":"Gerente Decisao"}'),
 ('f0000000-0000-0000-0000-00000000000c','conferente-dec@x.com','{"full_name":"Conferente Decisao"}'),
 ('f0000000-0000-0000-0000-00000000000d','repositor-dec@x.com','{"full_name":"Repositor Decisao"}'),
 ('f0000000-0000-0000-0000-00000000000e','dono-outra-dec@x.com','{"full_name":"Dono Outra Empresa Decisao"}');

select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Decisao Ltda','Rede Decisao','11223344000186');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f0000000-0000-0000-0000-00000000000b','manager'),
         ('f0000000-0000-0000-0000-00000000000c','receiver'),
         ('f0000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '11223344000186';

select test.as_user('f0000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra Decisao Ltda','Outra Decisao','99887766000105');

reset role;
select id as rede_id from public.companies where cnpj = '11223344000186' \gset

select test.as_user('f0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Decisao', 'DEC-CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Decisao Bairro', 'DEC-BAI-1');
insert into public.suppliers (company_id, name) values (:'rede_id'::uuid, 'Distribuidora Decisao Ltda');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Cafe Decisao 500g', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Queijo Decisao', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'DEC-CTR-1' \gset
select id as loja_bairro_id from public.markets where internal_code = 'DEC-BAI-1' \gset
select id as fornecedor_id from public.suppliers where name = 'Distribuidora Decisao Ltda' \gset
select id as cafe_id from public.products where name = 'Cafe Decisao 500g' \gset
select id as queijo_id from public.products where name = 'Queijo Decisao' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f0000000-0000-0000-0000-00000000000b'::uuid, 'f0000000-0000-0000-0000-00000000000c'::uuid);

insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'cafe_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'queijo_id'::uuid, 'Unidade', 1, true);

reset role;
select id as embalagem_cafe_id from public.product_packagings where product_id = :'cafe_id'::uuid \gset
select id as embalagem_queijo_id from public.product_packagings where product_id = :'queijo_id'::uuid \gset

select test.as_user('f0000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'DEC-END-1', 1000);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_bairro_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'DEC-END-2', 1000);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'DEC-END-1' \gset
select id as endereco_outro_mercado_id from public.warehouse_addresses where code = 'DEC-END-2' \gset

-- Limite padrão da empresa é 20 (mesmo campo do B3.4).
select test.ok((select loss_adjustment_approval_threshold from public.companies where id = :'rede_id'::uuid) = 20,
  'Limite de aprovação reaproveitado do B3.4 é 20');

------------------------------------------------------------
-- Caso 1: sem divergência, gerente finaliza direto.
------------------------------------------------------------
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-DEC-001');
reset role;
select id as recebimento_1_id from public.receivings where invoice_number = 'NF-DEC-001' \gset
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_1_id'::uuid, :'cafe_id'::uuid, 10);

-- Não é possível finalizar sem nenhum item contado.
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_1_id', :'endereco_id'),
  'Não é possível finalizar sem nenhum item contado');

select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_1_id'::uuid);
select public.add_receiving_count(:'recebimento_1_id'::uuid, :'cafe_id'::uuid, :'embalagem_cafe_id'::uuid, 10);

select test.as_user('f0000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'recebimento_1_id'::uuid, :'endereco_id'::uuid, null);
select test.ok((select status from public.receivings where id = :'recebimento_1_id'::uuid) = 'finalizado',
  'Sem divergência, gerente finaliza direto');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid) = 10,
  'Estoque recebe a entrada (10 café)');
select test.ok((select finalized_by from public.receivings where id = :'recebimento_1_id'::uuid) = 'f0000000-0000-0000-0000-00000000000b'::uuid,
  'Recebimento registra quem finalizou');

-- Não é possível finalizar de novo.
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_1_id', :'endereco_id'),
  'Não é possível finalizar um recebimento já finalizado');

------------------------------------------------------------
-- Caso 2: divergência pequena (dentro do limite de 20), gerente finaliza com justificativa.
------------------------------------------------------------
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-DEC-002');
reset role;
select id as recebimento_2_id from public.receivings where invoice_number = 'NF-DEC-002' \gset
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_2_id'::uuid, :'cafe_id'::uuid, 50);

select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_2_id'::uuid);
select public.add_receiving_count(:'recebimento_2_id'::uuid, :'cafe_id'::uuid, :'embalagem_cafe_id'::uuid, 45);

-- Divergência sem justificativa é recusada (PA-06: sem tolerância).
select test.as_user('f0000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_2_id', :'endereco_id'),
  'Divergência sem justificativa é recusada, mesmo pequena');

select public.finalize_receiving(:'recebimento_2_id'::uuid, :'endereco_id'::uuid, 'Faltaram 5 unidades na caixa, conferido duas vezes');
select test.ok((select status from public.receivings where id = :'recebimento_2_id'::uuid) = 'finalizado',
  'Divergência de 5 (dentro do limite de 20) — gerente finaliza com justificativa');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid) = 55,
  'Estoque recebe a quantidade CONTADA (45), não a esperada (50) — 10 + 45 = 55');

------------------------------------------------------------
-- Caso 3: divergência grande (acima do limite), gerente não pode finalizar sozinho.
------------------------------------------------------------
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-DEC-003');
reset role;
select id as recebimento_3_id from public.receivings where invoice_number = 'NF-DEC-003' \gset
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_3_id'::uuid, :'cafe_id'::uuid, 100);

select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_3_id'::uuid);
select public.add_receiving_count(:'recebimento_3_id'::uuid, :'cafe_id'::uuid, :'embalagem_cafe_id'::uuid, 50);

select test.as_user('f0000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'recebimento_3_id'::uuid, :'endereco_id'::uuid, 'Faltaram 50 unidades, fornecedor já avisado');
select test.ok((select status from public.receivings where id = :'recebimento_3_id'::uuid) = 'aguardando_aprovacao',
  'Divergência de 50 (acima do limite de 20) — gerente não finaliza sozinho, fica aguardando aprovação');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid) = 55,
  'Estoque não muda enquanto aguarda aprovação do dono (continua 55)');

-- Repositor não pode aprovar.
reset role;
select test.as_user('f0000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, 'tentativa')$$, :'recebimento_3_id', :'endereco_id'),
  'Repositor não pode finalizar recebimento');

-- Dono aprova a divergência grande.
reset role;
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.finalize_receiving(:'recebimento_3_id'::uuid, :'endereco_id'::uuid, 'Confirmado com o fornecedor, aceito com falta de 50');
select test.ok((select status from public.receivings where id = :'recebimento_3_id'::uuid) = 'finalizado',
  'Dono finaliza a divergência grande');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid) = 105,
  'Estoque recebe a quantidade contada (50) — 55 + 50 = 105');

------------------------------------------------------------
-- Caso 4: produto com lote — cria o lote no destino, exige número de lote.
------------------------------------------------------------
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-DEC-004');
reset role;
select id as recebimento_4_id from public.receivings where invoice_number = 'NF-DEC-004' \gset
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_4_id'::uuid, :'queijo_id'::uuid, 20);

select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_4_id'::uuid);
-- Conta sem informar o lote (produto controla lote).
select public.add_receiving_count(:'recebimento_4_id'::uuid, :'queijo_id'::uuid, :'embalagem_queijo_id'::uuid, 20);

select test.as_user('f0000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_4_id', :'endereco_id'),
  'Produto que controla lote sem número de lote contado impede a finalização');

-- Corrige: remove o item sem lote e conta de novo com lote.
reset role;
select id as item_sem_lote_id from public.receiving_counted_items where receiving_id = :'recebimento_4_id'::uuid \gset
select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.remove_receiving_count(:'item_sem_lote_id'::uuid);
select public.add_receiving_count(:'recebimento_4_id'::uuid, :'queijo_id'::uuid, :'embalagem_queijo_id'::uuid, 20, 'L-DEC-01', null, current_date + 60);

select test.as_user('f0000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'recebimento_4_id'::uuid, :'endereco_id'::uuid, null);
select test.ok((select status from public.receivings where id = :'recebimento_4_id'::uuid) = 'finalizado',
  'Com lote informado, finaliza sem divergência');
reset role;
select test.ok((select count(*) from public.lots where warehouse_address_id = :'endereco_id'::uuid and batch_number = 'L-DEC-01') = 1,
  'Lote é criado no endereço de destino');
select test.ok((select expires_at from public.lots where warehouse_address_id = :'endereco_id'::uuid and batch_number = 'L-DEC-01') = current_date + 60,
  'Lote criado com a validade informada na contagem');
select test.as_user('f0000000-0000-0000-0000-00000000000a');

------------------------------------------------------------
-- get_receiving_comparison: só dono/gerente, nunca o conferente.
------------------------------------------------------------
select test.ok((select difference from public.get_receiving_comparison(:'recebimento_2_id'::uuid) where product_id = :'cafe_id'::uuid) = -5,
  'Comparação mostra a diferença correta (-5) para dono');

reset role;
select test.as_user('f0000000-0000-0000-0000-00000000000c');
select test.throws(format($$select * from public.get_receiving_comparison('%s'::uuid)$$, :'recebimento_2_id'),
  'Conferente não pode ver a comparação esperado x contado');

------------------------------------------------------------
-- Endereço de destino de outro mercado é recusado.
------------------------------------------------------------
reset role;
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-DEC-005');
reset role;
select id as recebimento_5_id from public.receivings where invoice_number = 'NF-DEC-005' \gset
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_5_id'::uuid, :'cafe_id'::uuid, 5);
select test.as_user('f0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_5_id'::uuid);
select public.add_receiving_count(:'recebimento_5_id'::uuid, :'cafe_id'::uuid, :'embalagem_cafe_id'::uuid, 5);
select test.as_user('f0000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_5_id', :'endereco_outro_mercado_id'),
  'Endereço de destino de outro mercado é recusado');

------------------------------------------------------------
-- Isolamento entre empresas.
------------------------------------------------------------
reset role;
select test.as_user('f0000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_5_id', :'endereco_id'),
  'Dono de outra empresa não pode finalizar recebimento alheio');
select test.throws(format($$select * from public.get_receiving_comparison('%s'::uuid)$$, :'recebimento_5_id'),
  'Dono de outra empresa não vê a comparação de recebimento alheio');
