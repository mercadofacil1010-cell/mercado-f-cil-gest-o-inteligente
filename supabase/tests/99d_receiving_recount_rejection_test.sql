-- Testes de recontagem, recusa e histórico do recebimento (B4.4).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f1000000-0000-0000-0000-00000000000a','dono-b44@x.com','{"full_name":"Dono B44"}'),
 ('f1000000-0000-0000-0000-00000000000b','gerente-b44@x.com','{"full_name":"Gerente B44"}'),
 ('f1000000-0000-0000-0000-00000000000c','conferente-b44@x.com','{"full_name":"Conferente B44"}'),
 ('f1000000-0000-0000-0000-00000000000d','repositor-b44@x.com','{"full_name":"Repositor B44"}'),
 ('f1000000-0000-0000-0000-00000000000e','dono-outra-b44@x.com','{"full_name":"Dono Outra Empresa B44"}');

select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B44 Ltda','Rede B44','33440055000171');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f1000000-0000-0000-0000-00000000000b','manager'),
         ('f1000000-0000-0000-0000-00000000000c','receiver'),
         ('f1000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '33440055000171';

select test.as_user('f1000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra B44 Ltda','Outra B44','22119933000135');

reset role;
select id as rede_id from public.companies where cnpj = '33440055000171' \gset

select test.as_user('f1000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B44', 'B44-CTR-1');
insert into public.suppliers (company_id, name) values (:'rede_id'::uuid, 'Distribuidora B44 Ltda');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Arroz B44 5kg', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'B44-CTR-1' \gset
select id as fornecedor_id from public.suppliers where name = 'Distribuidora B44 Ltda' \gset
select id as arroz_id from public.products where name = 'Arroz B44 5kg' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f1000000-0000-0000-0000-00000000000b'::uuid, 'f1000000-0000-0000-0000-00000000000c'::uuid);

insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'arroz_id'::uuid, 'Unidade', 1, true);

reset role;
select id as embalagem_arroz_id from public.product_packagings where product_id = :'arroz_id'::uuid \gset

select test.as_user('f1000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B44-END-1', 1000);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B44-END-1' \gset

------------------------------------------------------------
-- Caso 1: recontagem — pede de novo só o item divergente, a contagem
-- anterior não some, comparação passa a usar a tentativa mais recente.
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-B44-001');
reset role;
select id as recebimento_1_id from public.receivings where invoice_number = 'NF-B44-001' \gset
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_1_id'::uuid, :'arroz_id'::uuid, 50);

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_1_id'::uuid);
select public.add_receiving_count(:'recebimento_1_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 40);

-- Repositor não pode pedir recontagem.
select test.as_user('f1000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.request_receiving_recount('%s'::uuid, array['%s'::uuid], 'tentativa')$$, :'recebimento_1_id', :'arroz_id'),
  'Repositor não pode pedir recontagem');

-- Conferente também não pode pedir recontagem (só dono/gerente decidem).
select test.as_user('f1000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.request_receiving_recount('%s'::uuid, array['%s'::uuid], 'tentativa')$$, :'recebimento_1_id', :'arroz_id'),
  'Conferente não pode pedir recontagem — quem decide é dono/gerente');

select test.as_user('f1000000-0000-0000-0000-00000000000b');
select public.request_receiving_recount(:'recebimento_1_id'::uuid, array[:'arroz_id'::uuid], 'Diferença suspeita, recontar antes de decidir');
select test.ok((select status from public.receivings where id = :'recebimento_1_id'::uuid) = 'em_recontagem',
  'Recontagem pedida — status vira em_recontagem');
select test.ok((select active_attempt from public.receivings where id = :'recebimento_1_id'::uuid) = 2,
  'Attempt ativo avança para 2');

-- A contagem antiga (tentativa 1) continua lá, não é apagada.
select test.ok((select count(*) from public.receiving_counted_items where receiving_id = :'recebimento_1_id'::uuid and attempt = 1) = 1,
  'Contagem da primeira tentativa é preservada');

-- Repositor não pode contar (mesma regra de sempre).
select test.as_user('f1000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 50)$$,
  :'recebimento_1_id', :'arroz_id', :'embalagem_arroz_id'),
  'Repositor não pode contar durante a recontagem');

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.add_receiving_count(:'recebimento_1_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 50);
select test.ok((select count(*) from public.receiving_counted_items where receiving_id = :'recebimento_1_id'::uuid and attempt = 2) = 1,
  'Nova contagem já nasce na tentativa 2');

-- Não é possível remover a contagem da tentativa anterior.
select test.throws(format($$select public.remove_receiving_count((select id from public.receiving_counted_items where receiving_id = '%s'::uuid and attempt = 1))$$, :'recebimento_1_id'),
  'Não é possível remover contagem de tentativa anterior');

select test.as_user('f1000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'recebimento_1_id'::uuid, :'endereco_id'::uuid, null);
select test.ok((select status from public.receivings where id = :'recebimento_1_id'::uuid) = 'finalizado',
  'Depois da recontagem, sem divergência, finaliza direto');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 50,
  'Estoque recebe a quantidade da tentativa mais recente (50), não a primeira tentativa (40)');

------------------------------------------------------------
-- Caso 2: limite de 3 recontagens (PA-09).
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-B44-002');
reset role;
select id as recebimento_2_id from public.receivings where invoice_number = 'NF-B44-002' \gset
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_2_id'::uuid, :'arroz_id'::uuid, 30);

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_2_id'::uuid);
select public.add_receiving_count(:'recebimento_2_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 25);

select test.as_user('f1000000-0000-0000-0000-00000000000b');
select public.request_receiving_recount(:'recebimento_2_id'::uuid, array[:'arroz_id'::uuid], 'recontagem 1');
select public.request_receiving_recount(:'recebimento_2_id'::uuid, array[:'arroz_id'::uuid], 'recontagem 2');
select public.request_receiving_recount(:'recebimento_2_id'::uuid, array[:'arroz_id'::uuid], 'recontagem 3');
select test.throws(format($$select public.request_receiving_recount('%s'::uuid, array['%s'::uuid], 'recontagem 4')$$, :'recebimento_2_id', :'arroz_id'),
  'Quarta recontagem é recusada — limite de 3 já atingido');
select test.ok((select count(*) from public.receiving_recount_requests where receiving_id = :'recebimento_2_id'::uuid) = 3,
  'Histórico guarda os 3 pedidos de recontagem (RF-REC-10)');

------------------------------------------------------------
-- Caso 3: recusa de um item específico — não entra no estoque, resto segue.
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-B44-003');
reset role;
select id as recebimento_3_id from public.receivings where invoice_number = 'NF-B44-003' \gset
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_3_id'::uuid, :'arroz_id'::uuid, 20);

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_3_id'::uuid);
select public.add_receiving_count(:'recebimento_3_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 20);
reset role;
select id as item_contado_3_id from public.receiving_counted_items where receiving_id = :'recebimento_3_id'::uuid \gset

-- Conferente não pode recusar (quem decide é dono/gerente).
select test.as_user('f1000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.reject_receiving_count('%s'::uuid, 'avariado')$$, :'item_contado_3_id'),
  'Conferente não pode recusar item contado');

-- Recusa sem motivo é bloqueada.
select test.as_user('f1000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.reject_receiving_count('%s'::uuid, '')$$, :'item_contado_3_id'),
  'Recusar item sem motivo é bloqueado');

select public.reject_receiving_count(:'item_contado_3_id'::uuid, 'Saco rasgado, produto perdido no transporte');
select test.ok((select rejected from public.receiving_counted_items where id = :'item_contado_3_id'::uuid) = true,
  'Item marcado como recusado');

select public.finalize_receiving(:'recebimento_3_id'::uuid, :'endereco_id'::uuid, 'Item recusado por avaria, restante aceito');
select test.ok((select status from public.receivings where id = :'recebimento_3_id'::uuid) = 'finalizado',
  'Recebimento finaliza mesmo com item recusado');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 50,
  'Estoque não muda com o recebimento 3 — item recusado nunca entrou (continua 50 do caso 1)');

------------------------------------------------------------
-- Caso 4: recusa da carga inteira — nada entra, sem chance de finalizar depois.
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-B44-004');
reset role;
select id as recebimento_4_id from public.receivings where invoice_number = 'NF-B44-004' \gset
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_4_id'::uuid, :'arroz_id'::uuid, 15);

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_4_id'::uuid);
select public.add_receiving_count(:'recebimento_4_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 15);

-- Repositor não pode recusar a carga.
select test.as_user('f1000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.reject_receiving('%s'::uuid, 'motivo qualquer')$$, :'recebimento_4_id'),
  'Repositor não pode recusar a carga inteira');

select test.as_user('f1000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.reject_receiving('%s'::uuid, '')$$, :'recebimento_4_id'),
  'Recusar a carga sem motivo é bloqueado');

select public.reject_receiving(:'recebimento_4_id'::uuid, 'Carga toda avariada, transporte não refrigerado');
select test.ok((select status from public.receivings where id = :'recebimento_4_id'::uuid) = 'recusado',
  'Carga inteira recusada');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 50,
  'Estoque não muda com a carga recusada (continua 50)');

-- Não é possível finalizar nem contar mais depois de recusado.
select test.throws(format($$select public.finalize_receiving('%s'::uuid, '%s'::uuid, null)$$, :'recebimento_4_id', :'endereco_id'),
  'Não é possível finalizar um recebimento já recusado');
select test.as_user('f1000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 5)$$,
  :'recebimento_4_id', :'arroz_id', :'embalagem_arroz_id'),
  'Não é possível contar mais um recebimento já recusado');

------------------------------------------------------------
-- Caso 5: recontagem para testar isolamento sem esbarrar no limite do caso 2.
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-B44-005');
reset role;
select id as recebimento_5_id from public.receivings where invoice_number = 'NF-B44-005' \gset
select test.as_user('f1000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_5_id'::uuid, :'arroz_id'::uuid, 10);

select test.as_user('f1000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_5_id'::uuid);
select public.add_receiving_count(:'recebimento_5_id'::uuid, :'arroz_id'::uuid, :'embalagem_arroz_id'::uuid, 10);

------------------------------------------------------------
-- Isolamento entre empresas.
------------------------------------------------------------
select test.as_user('f1000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.request_receiving_recount('%s'::uuid, array['%s'::uuid], 'motivo')$$, :'recebimento_5_id', :'arroz_id'),
  'Dono de outra empresa não pode pedir recontagem alheia');
select test.throws(format($$select public.reject_receiving('%s'::uuid, 'motivo')$$, :'recebimento_5_id'),
  'Dono de outra empresa não pode recusar recebimento alheio');
select test.throws(format($$select public.reject_receiving_count((select id from public.receiving_counted_items where receiving_id = '%s'::uuid), 'motivo')$$, :'recebimento_5_id'),
  'Dono de outra empresa não pode recusar item de recebimento alheio');
