-- Testes de foto de evidência anexada nos lugares já adiados (B5.4).
-- O bucket/políticas do Storage não existem neste Postgres de teste (só no
-- projeto real) — aqui testamos só a gravação do caminho da foto nas
-- tabelas, que é o que as funções realmente fazem.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f5000000-0000-0000-0000-00000000000a','dono-b54@x.com','{"full_name":"Dono B54"}'),
 ('f5000000-0000-0000-0000-00000000000b','gerente-b54@x.com','{"full_name":"Gerente B54"}'),
 ('f5000000-0000-0000-0000-00000000000c','conferente-b54@x.com','{"full_name":"Conferente B54"}'),
 ('f5000000-0000-0000-0000-00000000000d','repositor-b54@x.com','{"full_name":"Repositor B54"}');

select test.as_user('f5000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B54 Ltda','Rede B54','55990011000158');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f5000000-0000-0000-0000-00000000000b','manager'),
         ('f5000000-0000-0000-0000-00000000000c','receiver'),
         ('f5000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '55990011000158';

select id as rede_id from public.companies where cnpj = '55990011000158' \gset

select test.as_user('f5000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B54', 'B54-CTR-1');
insert into public.products (company_id, name, base_unit, barcode) values (:'rede_id'::uuid, 'Refrigerante B54', 'unidade', '7891234500019');
insert into public.products (company_id, name, base_unit) values (:'rede_id'::uuid, 'Arroz B54', 'unidade');

reset role;
select id as loja_id from public.markets where internal_code = 'B54-CTR-1' \gset
select id as refri_id from public.products where name = 'Refrigerante B54' \gset
select id as arroz_id from public.products where name = 'Arroz B54' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in (
  'f5000000-0000-0000-0000-00000000000b'::uuid,
  'f5000000-0000-0000-0000-00000000000c'::uuid,
  'f5000000-0000-0000-0000-00000000000d'::uuid
);

insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'refri_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'arroz_id'::uuid, 'Unidade', 1, true);

reset role;
select id as embalagem_refri_id from public.product_packagings where product_id = :'refri_id'::uuid \gset

select test.as_user('f5000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B54-END-1', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '01', 'A', 1, 1, 1, 'B54-POS-1', :'refri_id'::uuid, 5, 20, 30, 30);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B54-END-1' \gset
select id as posicao_id from public.gondola_positions where code = 'B54-POS-1' \gset

------------------------------------------------------------
-- Buscar produto por código de barras (bug corrigido: conferente/repositor
-- agora têm select em products/product_packagings).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.products where barcode = '7891234500019') = 1,
  'Conferente encontra produto pelo código de barras (bug do B4.2 corrigido)');
select test.ok((select count(*) from public.product_packagings where product_id = :'refri_id'::uuid) = 1,
  'Conferente também enxerga a embalagem do produto encontrado');

select test.as_user('f5000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.products where barcode = '7891234500019') = 1,
  'Repositor também encontra produto pelo código de barras');

------------------------------------------------------------
-- Caso 1: perda/ajuste acima do limite guarda a foto no pedido pendente (B3.4).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'entrada', 100, 'Compra inicial');

select test.as_user('f5000000-0000-0000-0000-00000000000b');
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'perda', -50, null, 'Saco rasgado, produto perdido', null, null, 'empresa1/mercado1/gerente/foto-perda.jpg');
reset role;
select test.ok((select photo_path from public.pending_stock_adjustments where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 'empresa1/mercado1/gerente/foto-perda.jpg',
  'Foto da perda acima do limite fica registrada no pedido pendente');

------------------------------------------------------------
-- Caso 2: contagem de recebimento guarda a foto (B4.2).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B54-001');
reset role;
select id as recebimento_id from public.receivings where invoice_number = 'NF-B54-001' \gset

select test.as_user('f5000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_id'::uuid);
select public.add_receiving_count(:'recebimento_id'::uuid, :'refri_id'::uuid, :'embalagem_refri_id'::uuid, 10, null, null, null, 'bom_estado', null, 'empresa1/mercado1/conferente/foto-contagem.jpg');
reset role;
select id as item_contado_id from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid \gset
select test.ok((select photo_path from public.receiving_counted_items where id = :'item_contado_id'::uuid) = 'empresa1/mercado1/conferente/foto-contagem.jpg',
  'Foto da contagem de recebimento fica registrada no item contado');

------------------------------------------------------------
-- Caso 3: recusa de item e de carga guardam a foto (B4.4).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000b');
select public.reject_receiving_count(:'item_contado_id'::uuid, 'Embalagem violada', 'empresa1/mercado1/gerente/foto-recusa-item.jpg');
select test.ok((select rejection_photo_path from public.receiving_counted_items where id = :'item_contado_id'::uuid) = 'empresa1/mercado1/gerente/foto-recusa-item.jpg',
  'Foto da recusa do item fica registrada');

select test.as_user('f5000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B54-002');
reset role;
select id as recebimento_2_id from public.receivings where invoice_number = 'NF-B54-002' \gset
select test.as_user('f5000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_2_id'::uuid);
select public.add_receiving_count(:'recebimento_2_id'::uuid, :'refri_id'::uuid, :'embalagem_refri_id'::uuid, 5);

select test.as_user('f5000000-0000-0000-0000-00000000000b');
select public.reject_receiving(:'recebimento_2_id'::uuid, 'Carga toda avariada', 'empresa1/mercado1/gerente/foto-recusa-carga.jpg');
select test.ok((select rejection_photo_path from public.receivings where id = :'recebimento_2_id'::uuid) = 'empresa1/mercado1/gerente/foto-recusa-carga.jpg',
  'Foto da recusa da carga inteira fica registrada');

------------------------------------------------------------
-- Caso 4: impedimento de reposição guarda a foto (B5.2).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_id'::uuid, 5);
reset role;
select id as tarefa_id from public.replenishment_tasks where gondola_position_id = :'posicao_id'::uuid \gset

select test.as_user('f5000000-0000-0000-0000-00000000000d');
select public.accept_replenishment_task(:'tarefa_id'::uuid);
select public.register_replenishment_impediment(:'tarefa_id'::uuid, 'Gôndola quebrada', 'empresa1/mercado1/repositor/foto-impedimento.jpg');
reset role;
select test.ok((select last_impediment_photo_path from public.replenishment_tasks where id = :'tarefa_id'::uuid) = 'empresa1/mercado1/repositor/foto-impedimento.jpg',
  'Foto do impedimento de reposição fica registrada');

------------------------------------------------------------
-- Caso 5: list_replenishment_tasks devolve o código de barras do produto
-- (DEC-B5-12) — o repositor consegue conferir sem precisar de select em
-- gondola_positions (continua bloqueado).
------------------------------------------------------------
select test.as_user('f5000000-0000-0000-0000-00000000000d');
select test.ok((select product_barcode from public.list_replenishment_tasks(:'loja_id'::uuid) where product_id = :'refri_id'::uuid limit 1) = '7891234500019',
  'Tarefa de reposição traz o código de barras do produto para conferência');
select test.ok((select count(*) from public.gondola_positions where id = :'posicao_id'::uuid) = 0,
  'Repositor continua sem select direto em gondola_positions (blindagem do B3.1 preservada)');
