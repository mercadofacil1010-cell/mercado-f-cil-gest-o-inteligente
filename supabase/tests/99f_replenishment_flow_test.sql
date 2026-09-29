-- Testes do fluxo do repositor gravado no banco (B5.2).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f3000000-0000-0000-0000-00000000000a','dono-b52@x.com','{"full_name":"Dono B52"}'),
 ('f3000000-0000-0000-0000-00000000000b','gerente-b52@x.com','{"full_name":"Gerente B52"}'),
 ('f3000000-0000-0000-0000-00000000000c','repositor-b52@x.com','{"full_name":"Repositor B52"}'),
 ('f3000000-0000-0000-0000-00000000000d','repositor2-b52@x.com','{"full_name":"Repositor Dois B52"}'),
 ('f3000000-0000-0000-0000-00000000000e','dono-outra-b52@x.com','{"full_name":"Dono Outra Empresa B52"}');

select test.as_user('f3000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B52 Ltda','Rede B52','66551100000114');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f3000000-0000-0000-0000-00000000000b','manager'),
         ('f3000000-0000-0000-0000-00000000000c','stocker'),
         ('f3000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '66551100000114';

select test.as_user('f3000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra B52 Ltda','Outra B52','22447700000161');

reset role;
select id as rede_id from public.companies where cnpj = '66551100000114' \gset

select test.as_user('f3000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B52', 'B52-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Suco B52 1L', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Presunto B52', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'B52-CTR-1' \gset
select id as suco_id from public.products where name = 'Suco B52 1L' \gset
select id as presunto_id from public.products where name = 'Presunto B52' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in (
  'f3000000-0000-0000-0000-00000000000b'::uuid,
  'f3000000-0000-0000-0000-00000000000c'::uuid,
  'f3000000-0000-0000-0000-00000000000d'::uuid
);

select test.as_user('f3000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B52-END-1', 1000);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 2', 'Mercearia', 'B', '01', '01', '01', '01', 'B52-END-2', 1000);

reset role;
select id as endereco_1_id from public.warehouse_addresses where code = 'B52-END-1' \gset
select id as endereco_2_id from public.warehouse_addresses where code = 'B52-END-2' \gset

select test.as_user('f3000000-0000-0000-0000-00000000000a');
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '01', 'A', 1, 1, 1, 'B52-POS-1', :'suco_id'::uuid, 5, 20, 30, 30);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Frios', 'B', '01', 'A', 1, 1, 1, 'B52-POS-2', :'presunto_id'::uuid, 5, 20, 30, 30);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '02', 'A', 1, 1, 1, 'B52-POS-3', :'suco_id'::uuid, 5, 20, 30, 30);

reset role;
select id as posicao_suco_id from public.gondola_positions where code = 'B52-POS-1' \gset
select id as posicao_presunto_id from public.gondola_positions where code = 'B52-POS-2' \gset
select id as posicao_suco2_id from public.gondola_positions where code = 'B52-POS-3' \gset

-- Estoque inicial no depósito.
select test.as_user('f3000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_1_id'::uuid, :'suco_id'::uuid, 'entrada', 100, 'Compra inicial');
select public.get_or_create_lot(:'endereco_1_id'::uuid, :'presunto_id'::uuid, 'LOTE-B52-1', current_date + 30);
reset role;
select id as lote_presunto_id from public.lots where warehouse_address_id = :'endereco_1_id'::uuid and product_id = :'presunto_id'::uuid \gset
select test.as_user('f3000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_1_id'::uuid, :'presunto_id'::uuid, 'entrada', 50, 'Compra inicial', null, :'lote_presunto_id'::uuid);

------------------------------------------------------------
-- Caso 1: fluxo completo sem divergência — aceite, retirada, reposição.
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_suco_id'::uuid, 5);
reset role;
select id as tarefa_1_id from public.replenishment_tasks where gondola_position_id = :'posicao_suco_id'::uuid \gset

-- Repositor 2 não pode agir numa tarefa que repositor 1 vai aceitar (ainda pendente, ok ver).
select test.as_user('f3000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_1_id'::uuid);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'aceita',
  'Repositor aceita a tarefa pendente');
select test.ok((select accepted_by from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'f3000000-0000-0000-0000-00000000000c'::uuid,
  'Tarefa registra quem aceitou');

-- Ninguém mais pode aceitar de novo.
select test.as_user('f3000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.accept_replenishment_task('%s'::uuid)$$, :'tarefa_1_id'),
  'Repositor 2 não pode aceitar tarefa já aceita');

-- Repositor 2 não pode retirar/concluir a tarefa do repositor 1.
select test.throws(format($$select public.register_replenishment_withdrawal('%s'::uuid, 10, '%s'::uuid)$$, :'tarefa_1_id', :'endereco_1_id'),
  'Repositor 2 não pode retirar a tarefa de outro repositor');

select test.as_user('f3000000-0000-0000-0000-00000000000c');
select public.register_replenishment_withdrawal(:'tarefa_1_id'::uuid, 15, :'endereco_1_id'::uuid);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'em_transito',
  'Retirada registrada — tarefa em trânsito (G-09)');

select public.register_replenishment_completion(:'tarefa_1_id'::uuid, 15, 0);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_1_id'::uuid) = 'concluida',
  'Reposto (15) + devolvido (0) fecha com o retirado (15) — tarefa concluída');

-- Saldos só são visíveis a dono/gerente (o repositor não lê stock_balances/gondola_positions).
select test.as_user('f3000000-0000-0000-0000-00000000000a');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_1_id'::uuid and product_id = :'suco_id'::uuid) = 85,
  'Depósito reduz com a retirada (100 - 15 = 85)');
select test.ok((select current_balance from public.gondola_positions where id = :'posicao_suco_id'::uuid) = 20,
  'Saldo da gôndola sobe com o reposto (5 + 15 = 20)');

------------------------------------------------------------
-- Caso 2: sobra devolvida a outro endereço — quantidades fecham.
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_suco2_id'::uuid, 5);
reset role;
select id as tarefa_2_id from public.replenishment_tasks where gondola_position_id = :'posicao_suco2_id'::uuid \gset

select test.as_user('f3000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_2_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_2_id'::uuid, 20, :'endereco_1_id'::uuid);
select public.register_replenishment_completion(:'tarefa_2_id'::uuid, 15, 5, :'endereco_2_id'::uuid);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_2_id'::uuid) = 'concluida',
  '15 repostos + 5 devolvidos fecha com 20 retirados');

select test.as_user('f3000000-0000-0000-0000-00000000000a');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_2_id'::uuid and product_id = :'suco_id'::uuid) = 5,
  'Sobra devolvida entra no endereço escolhido (depósito 2)');

------------------------------------------------------------
-- Caso 3: divergência — vira inconsistência, gerente decide (DEC-B5-04).
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_presunto_id'::uuid, 5);
reset role;
select id as tarefa_3_id from public.replenishment_tasks where gondola_position_id = :'posicao_presunto_id'::uuid \gset

select test.as_user('f3000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_3_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_3_id'::uuid, 15, :'endereco_1_id'::uuid);
select test.ok((select withdrawal_lot_id from public.replenishment_tasks where id = :'tarefa_3_id'::uuid) = :'lote_presunto_id'::uuid,
  'Retirada de produto com lote segue FEFO automaticamente');

-- Repositor tenta concluir com quantidades que não fecham (13, não 15).
select public.register_replenishment_completion(:'tarefa_3_id'::uuid, 13, 0, null, 'Perdi 2 unidades, não sei onde');
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_3_id'::uuid) = 'com_inconsistencia',
  '13 repostos não fecha com 15 retirados — vira inconsistência');

-- Repositor não pode resolver a própria inconsistência.
select test.throws(format($$select public.resolve_replenishment_inconsistency('%s'::uuid, 'ok')$$, :'tarefa_3_id'),
  'Repositor não pode decidir a inconsistência — só gerente/dono');

select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.resolve_replenishment_inconsistency(:'tarefa_3_id'::uuid, 'Quebra registrada, sem necessidade de ajuste adicional');
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_3_id'::uuid) = 'concluida',
  'Gerente decide e a tarefa fecha');
select test.ok((select resolved_by from public.replenishment_tasks where id = :'tarefa_3_id'::uuid) = 'f3000000-0000-0000-0000-00000000000b'::uuid,
  'Registra quem resolveu a inconsistência');

------------------------------------------------------------
-- Caso 4: impedimento — volta pendente, motivo registrado (DEC-B5-06).
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000a');
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '03', 'A', 1, 1, 1, 'B52-POS-4', :'suco_id'::uuid, 5, 20, 30, 30);
reset role;
select id as posicao_suco4_id from public.gondola_positions where code = 'B52-POS-4' \gset

select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_suco4_id'::uuid, 5);
reset role;
select id as tarefa_4_id from public.replenishment_tasks where gondola_position_id = :'posicao_suco4_id'::uuid \gset

select test.as_user('f3000000-0000-0000-0000-00000000000c');
select public.accept_replenishment_task(:'tarefa_4_id'::uuid);

-- Impedimento antes de retirar (sem estoque em trânsito para estornar).
select test.throws(format($$select public.register_replenishment_impediment('%s'::uuid, '')$$, :'tarefa_4_id'),
  'Impedimento sem motivo é bloqueado');
select public.register_replenishment_impediment(:'tarefa_4_id'::uuid, 'Gôndola quebrada, aguardando manutenção');
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) = 'pendente',
  'Impedimento devolve a tarefa para pendente');
select test.ok((select last_impediment_reason from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) = 'Gôndola quebrada, aguardando manutenção',
  'Motivo do impedimento fica registrado');
select test.ok((select accepted_by from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) is null,
  'Tarefa fica livre para qualquer repositor aceitar de novo');

-- Repositor 2 aceita, retira, aí registra impedimento — estoque retirado volta ao depósito.
select test.as_user('f3000000-0000-0000-0000-00000000000d');
select public.accept_replenishment_task(:'tarefa_4_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_4_id'::uuid, 10, :'endereco_1_id'::uuid);
reset role;
select balance as saldo_antes_impedimento from public.stock_balances where warehouse_address_id = :'endereco_1_id'::uuid and product_id = :'suco_id'::uuid \gset
select test.as_user('f3000000-0000-0000-0000-00000000000d');
select public.register_replenishment_impediment(:'tarefa_4_id'::uuid, 'Empilhadeira quebrou no meio do caminho');
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) = 'pendente',
  'Tarefa volta pendente mesmo depois de retirada');

select test.as_user('f3000000-0000-0000-0000-00000000000a');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_1_id'::uuid and product_id = :'suco_id'::uuid) = :'saldo_antes_impedimento'::numeric + 10,
  'Estoque retirado volta ao depósito de origem quando o impedimento acontece em trânsito');

------------------------------------------------------------
-- Atribuição manual pelo gerente (PA-12).
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000b');
select public.assign_replenishment_task(:'tarefa_4_id'::uuid, 'f3000000-0000-0000-0000-00000000000c'::uuid);
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) = 'aceita',
  'Gerente atribui a tarefa direto a um repositor específico');
select test.ok((select accepted_by from public.replenishment_tasks where id = :'tarefa_4_id'::uuid) = 'f3000000-0000-0000-0000-00000000000c'::uuid,
  'Tarefa fica com o repositor escolhido pelo gerente');

------------------------------------------------------------
-- Permissões e listagem.
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000b');
select test.throws($$select public.assign_replenishment_task((select id from public.replenishment_tasks limit 1), 'f3000000-0000-0000-0000-00000000000c'::uuid)$$,
  'Não é possível atribuir uma tarefa que já está aceita');

select test.as_user('f3000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.list_replenishment_tasks(:'loja_id'::uuid)) >= 1,
  'Repositor lista suas próprias tarefas e as pendentes do mercado');

------------------------------------------------------------
-- Isolamento entre empresas.
------------------------------------------------------------
select test.as_user('f3000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.accept_replenishment_task('%s'::uuid)$$, :'tarefa_4_id'),
  'Dono de outra empresa não pode aceitar tarefa alheia');
select test.throws(format($$select public.assign_replenishment_task('%s'::uuid, 'f3000000-0000-0000-0000-00000000000c'::uuid)$$, :'tarefa_4_id'),
  'Dono de outra empresa não pode atribuir tarefa alheia');
