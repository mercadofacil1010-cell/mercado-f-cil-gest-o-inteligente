-- Testes da contagem cega da gôndola ao concluir a reposição (B5.3).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f4000000-0000-0000-0000-00000000000a','dono-b53@x.com','{"full_name":"Dono B53"}'),
 ('f4000000-0000-0000-0000-00000000000b','gerente-b53@x.com','{"full_name":"Gerente B53"}'),
 ('f4000000-0000-0000-0000-00000000000c','repositor-b53@x.com','{"full_name":"Repositor B53"}'),
 ('f4000000-0000-0000-0000-00000000000d','dono-outra-b53@x.com','{"full_name":"Dono Outra Empresa B53"}');

select test.as_user('f4000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B53 Ltda','Rede B53','44339911000113');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f4000000-0000-0000-0000-00000000000b','manager'),
         ('f4000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '44339911000113';

select test.as_user('f4000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B53 Ltda','Outra B53','33227788000122');

reset role;
select id as rede_id from public.companies where cnpj = '44339911000113' \gset

select test.as_user('f4000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B53', 'B53-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Água B53 500ml', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'B53-CTR-1' \gset
select id as agua_id from public.products where name = 'Água B53 500ml' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f4000000-0000-0000-0000-00000000000b'::uuid, 'f4000000-0000-0000-0000-00000000000c'::uuid);

select test.as_user('f4000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B53-END-1', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '01', 'A', 1, 1, 1, 'B53-POS-1', :'agua_id'::uuid, 5, 20, 30, 30);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '02', 'A', 1, 1, 1, 'B53-POS-2', :'agua_id'::uuid, 5, 20, 30, 30);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B53-END-1' \gset
select id as posicao_1_id from public.gondola_positions where code = 'B53-POS-1' \gset
select id as posicao_2_id from public.gondola_positions where code = 'B53-POS-2' \gset

select test.as_user('f4000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'agua_id'::uuid, 'entrada', 200, 'Compra inicial');

------------------------------------------------------------
-- Caso 1: erra na primeira, acerta na segunda tentativa (RN-REP-05).
------------------------------------------------------------
select test.as_user('f4000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_1_id'::uuid, 5);
reset role;
select id as tarefa_1_id from public.replenishment_tasks where gondola_position_id = :'posicao_1_id'::uuid \gset

select test.as_user('f4000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_1_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_1_id'::uuid, 15, :'endereco_id'::uuid);

-- Não é possível contar antes de registrar a devolução (mesmo que zero).
select test.throws(format($$select public.submit_replenishment_count('%s'::uuid, 20)$$, :'tarefa_1_id'),
  'Não é possível contar antes de registrar a devolução da sobra');

select public.register_replenishment_return(:'tarefa_1_id'::uuid, 0);

-- A devolução não pode ser registrada duas vezes.
select test.throws(format($$select public.register_replenishment_return('%s'::uuid, 0)$$, :'tarefa_1_id'),
  'A devolução já registrada não pode ser registrada de novo');

-- Esperado é 5 + 15 - 0 = 20. Repositor conta errado primeiro (contou rápido, 19).
select public.submit_replenishment_count(:'tarefa_1_id'::uuid, 19);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'em_transito',
  'Contagem errada (19) não conclui — permite recontagem');

-- Segunda tentativa acerta.
select public.submit_replenishment_count(:'tarefa_1_id'::uuid, 20);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'concluida',
  'Segunda tentativa bate (20) — tarefa concluída sem precisar da terceira');
select test.ok((select count(*) from public.replenishment_task_counts where task_id = :'tarefa_1_id'::uuid) = 2,
  'Ficam registradas as 2 tentativas (a errada e a certa), nenhuma apagada');
select test.ok((select attempt from public.replenishment_task_counts where task_id = :'tarefa_1_id'::uuid and matches = true) = 2,
  'A tentativa certa é a de número 2');

select test.as_user('f4000000-0000-0000-0000-00000000000a');
select test.ok((select current_balance from public.gondola_positions where id = :'posicao_1_id'::uuid) = 20,
  'Saldo da gôndola reflete a contagem confirmada');
select test.ok((select quantity_placed from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 15,
  'Quantidade reposta é calculada (retirado 15 - devolvido 0), não digitada pelo repositor');

------------------------------------------------------------
-- Caso 2: blindagem estrutural — o repositor nunca vê o saldo teórico.
------------------------------------------------------------
select test.as_user('f4000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_2_id'::uuid, 5);
reset role;
select id as tarefa_2_id from public.replenishment_tasks where gondola_position_id = :'posicao_2_id'::uuid \gset

select test.as_user('f4000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_2_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_2_id'::uuid, 10, :'endereco_id'::uuid);
select public.register_replenishment_return(:'tarefa_2_id'::uuid, 0);

-- RN-REP-03: o repositor não tem select em gondola_positions (RLS, desde o B3.1).
select test.ok((select count(*) from public.gondola_positions where id = :'posicao_2_id'::uuid) = 0,
  'Repositor não enxerga a posição de gôndola (nem o saldo teórico) por RLS');
-- Nem o saldo_before/quantity_withdrawn calculados ficam visíveis fora da tarefa
-- (a RLS de replenishment_tasks já cobre isso — aqui só confirmamos que a
-- contagem em si nunca devolve o valor esperado para o chamador).
select public.submit_replenishment_count(:'tarefa_2_id'::uuid, 99);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_2_id'::uuid) = 'em_transito',
  'Contagem completamente errada (99) só diz que não bateu — não revela o esperado');

-- Repositor 2 (sem vínculo com a tarefa) não pode contar.
select test.as_user('f4000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.submit_replenishment_count('%s'::uuid, 15)$$, :'tarefa_2_id'),
  'Gerente não pode registrar a contagem cega — é o próprio repositor que conta');

------------------------------------------------------------
-- Isolamento entre empresas.
------------------------------------------------------------
select test.as_user('f4000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.submit_replenishment_count('%s'::uuid, 15)$$, :'tarefa_2_id'),
  'Dono de outra empresa não pode contar tarefa alheia');
select test.throws(format($$select public.register_replenishment_return('%s'::uuid, 0)$$, :'tarefa_2_id'),
  'Dono de outra empresa não pode registrar devolução de tarefa alheia');
