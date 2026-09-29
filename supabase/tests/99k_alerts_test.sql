-- Testes do motor de alertas (B6.2) — feed único reunindo inconsistência
-- aberta (B6.1), saldo negativo e gôndola no mínimo sem tarefa ativa (o
-- caso que o B5.1 não cobre sozinho). Nunca resolve/descarta sozinho ao
-- listar (RN-DSH-05) — só sync_alerts (automático) ou discard_alert
-- (manual) mudam o estado.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f8000000-0000-0000-0000-00000000000a','dono-b62@x.com','{"full_name":"Dono B62"}'),
 ('f8000000-0000-0000-0000-00000000000b','gerente-b62@x.com','{"full_name":"Gerente B62"}'),
 ('f8000000-0000-0000-0000-00000000000c','repositor-b62@x.com','{"full_name":"Repositor B62"}'),
 ('f8000000-0000-0000-0000-00000000000d','dono-outra-b62@x.com','{"full_name":"Dono Outra B62"}'),
 ('f8000000-0000-0000-0000-00000000000e','conferente-b62@x.com','{"full_name":"Conferente B62"}');

select test.as_user('f8000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B62 Ltda','Rede B62','88001166000173');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f8000000-0000-0000-0000-00000000000b','manager'),
         ('f8000000-0000-0000-0000-00000000000c','stocker'),
         ('f8000000-0000-0000-0000-00000000000e','receiver')) u(id, role)
where c.cnpj = '88001166000173';

select test.as_user('f8000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B62 Ltda','Outra B62','99002277000110');

reset role;
select id as rede_id from public.companies where cnpj = '88001166000173' \gset

select test.as_user('f8000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B62', 'B62-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Café B62', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'B62-CTR-1' \gset
select id as cafe_id from public.products where name = 'Café B62' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in (
  'f8000000-0000-0000-0000-00000000000b'::uuid,
  'f8000000-0000-0000-0000-00000000000c'::uuid,
  'f8000000-0000-0000-0000-00000000000e'::uuid
);

select test.as_user('f8000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B62-END-1', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Mercearia', 'A', '01', 'A', 1, 1, 1, 'B62-POS-1', :'cafe_id'::uuid, 5, 20, 30, 30);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B62-END-1' \gset
select id as posicao_id from public.gondola_positions where code = 'B62-POS-1' \gset

-- A posição nasce com current_balance = 0 (abaixo do mínimo) por padrão —
-- registra um saldo saudável agora para não disparar o alerta da gôndola
-- antes da hora (Caso 3 é quem testa isso de propósito).
select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_id'::uuid, 20);
reset role;

------------------------------------------------------------
-- Caso 1: alerta a partir de uma inconsistência aberta (B6.1) — resolve
-- sozinho quando a inconsistência é encerrada.
------------------------------------------------------------
select test.as_user('f8000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B62-001');
reset role;
select id as receb_id from public.receivings where invoice_number = 'NF-B62-001' \gset
select test.as_user('f8000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'receb_id'::uuid, :'cafe_id'::uuid, 100);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'cafe_id'::uuid, 'Unidade', 1, true);

reset role;
select id as embalagem_id from public.product_packagings where product_id = :'cafe_id'::uuid \gset

select test.as_user('f8000000-0000-0000-0000-00000000000e');
select public.start_receiving_conference(:'receb_id'::uuid);
select public.add_receiving_count(:'receb_id'::uuid, :'cafe_id'::uuid, :'embalagem_id'::uuid, 90);

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'receb_id'::uuid, :'endereco_id'::uuid, 'Faltaram 10 unidades.');
reset role;
select id as incidente_id from public.incidents where reference_receiving_id = :'receb_id'::uuid \gset

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.alerts where reference_incident_id = :'incidente_id'::uuid and status = 'aberto') = 1,
  'Sincronizar cria alerta a partir da inconsistência aberta');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.alerts where reference_incident_id = :'incidente_id'::uuid and status = 'aberto') = 1,
  'Sincronizar de novo não duplica o alerta já aberto');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.acknowledge_incident(:'incidente_id'::uuid);
select public.resolve_incident(:'incidente_id'::uuid, 'descartada', 'Só arredondamento de nota.');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select status from public.alerts where reference_incident_id = :'incidente_id'::uuid) = 'resolvido',
  'Alerta se resolve sozinho quando a inconsistência é encerrada');

------------------------------------------------------------
-- Caso 2: alerta de saldo negativo — resolve sozinho quando o saldo deixa
-- de ser negativo.
------------------------------------------------------------
select test.as_user('f8000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'cafe_id'::uuid, 'saida', -100, 'Venda urgente', 'Cliente levou mais do que tinha registrado — ajuste depois.');
reset role;
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid) < 0,
  'Saldo do café fica negativo neste endereço');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.alerts where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid and alert_type = 'saldo_negativo' and status = 'aberto') = 1,
  'Sincronizar cria alerta de saldo negativo');

select test.as_user('f8000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'cafe_id'::uuid, 'entrada', 30, 'Reposição do estoque');
select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select status from public.alerts where warehouse_address_id = :'endereco_id'::uuid and product_id = :'cafe_id'::uuid and alert_type = 'saldo_negativo') = 'resolvido',
  'Alerta de saldo negativo se resolve sozinho quando o saldo volta a ficar positivo');

------------------------------------------------------------
-- Caso 3: gôndola no mínimo sem tarefa ativa — o caso que o B5.1 não cobre
-- sozinho (registrar saldo baixo sempre cria tarefa; aqui simulamos a
-- tarefa já concluída enquanto o saldo continua baixo).
------------------------------------------------------------
select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_id'::uuid, 3);
reset role;
select id as tarefa_id from public.replenishment_tasks where gondola_position_id = :'posicao_id'::uuid \gset

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.alerts where gondola_position_id = :'posicao_id'::uuid and status = 'aberto') = 0,
  'Enquanto a tarefa de reposição está ativa, não nasce alerta duplicado');

-- Simula a tarefa concluída (via update direto, só para o teste) mantendo
-- o saldo da posição ainda baixo — situação que o B5.1 não recria sozinho.
update public.replenishment_tasks set status = 'concluida' where id = :'tarefa_id'::uuid;

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.sync_alerts(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.alerts where gondola_position_id = :'posicao_id'::uuid and alert_type = 'gondola_no_minimo' and status = 'aberto') = 1,
  'Sem tarefa ativa e saldo ainda baixo, o alerta nasce sozinho');

------------------------------------------------------------
-- Caso 4: descarte manual — só a partir de aberto, e é dono/gerente.
------------------------------------------------------------
select id as alerta_gondola_id from public.alerts where gondola_position_id = :'posicao_id'::uuid and alert_type = 'gondola_no_minimo' and status = 'aberto' \gset

select test.as_user('f8000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.discard_alert('%s'::uuid, 'ok')$$, :'alerta_gondola_id'),
  'Repositor não pode descartar alerta');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select public.discard_alert(:'alerta_gondola_id'::uuid, 'Já sei, vou repor manualmente mais tarde.');
reset role;
select test.ok((select status from public.alerts where id = :'alerta_gondola_id'::uuid) = 'descartado',
  'Alerta descartado manualmente');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.discard_alert('%s'::uuid, 'de novo')$$, :'alerta_gondola_id'),
  'Não é possível descartar o mesmo alerta duas vezes');

------------------------------------------------------------
-- Caso 5: acesso — só dono/gerente do mercado; outra empresa não acessa.
------------------------------------------------------------
select test.as_user('f8000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.list_alerts('%s'::uuid)$$, :'loja_id'),
  'Repositor não pode listar alertas');

select test.as_user('f8000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.list_alerts('%s'::uuid)$$, :'loja_id'),
  'Dono de outra empresa não pode listar alertas de mercado alheio');

select test.as_user('f8000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.list_alerts(:'loja_id'::uuid)) >= 3,
  'Gerente com acesso ao mercado lista os alertas criados até aqui');
