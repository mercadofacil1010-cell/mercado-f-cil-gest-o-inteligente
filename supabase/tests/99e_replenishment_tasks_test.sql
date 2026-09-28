-- Testes de geração automática de tarefas de reposição (B5.1).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f2000000-0000-0000-0000-00000000000a','dono-b51@x.com','{"full_name":"Dono B51"}'),
 ('f2000000-0000-0000-0000-00000000000b','gerente-b51@x.com','{"full_name":"Gerente B51"}'),
 ('f2000000-0000-0000-0000-00000000000c','repositor-b51@x.com','{"full_name":"Repositor B51"}'),
 ('f2000000-0000-0000-0000-00000000000d','dono-outra-b51@x.com','{"full_name":"Dono Outra Empresa B51"}');

select test.as_user('f2000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B51 Ltda','Rede B51','55220011000179');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f2000000-0000-0000-0000-00000000000b','manager'),
         ('f2000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '55220011000179';

select test.as_user('f2000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B51 Ltda','Outra B51','77330022000144');

reset role;
select id as rede_id from public.companies where cnpj = '55220011000179' \gset

select test.as_user('f2000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B51', 'B51-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Refrigerante B51 2L', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Iogurte B51', 'unidade', true);

reset role;
select id as loja_id from public.markets where internal_code = 'B51-CTR-1' \gset
select id as refri_id from public.products where name = 'Refrigerante B51 2L' \gset
select id as iogurte_id from public.products where name = 'Iogurte B51' \gset

-- Limite de "perto de vencer" padrão da empresa é 7 dias.
select test.ok((select near_expiry_priority_days from public.companies where id = :'rede_id'::uuid) = 7,
  'Limite padrão de dias para "perto de vencer" é 7');

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f2000000-0000-0000-0000-00000000000b'::uuid, 'f2000000-0000-0000-0000-00000000000c'::uuid);

select test.as_user('f2000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B51-END-1', 1000);
reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B51-END-1' \gset

select test.as_user('f2000000-0000-0000-0000-00000000000a');
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '01', 'A', 1, 1, 1, 'B51-POS-1', :'refri_id'::uuid, 5, 20, 30, 30);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Laticínios', 'B', '01', 'A', 1, 1, 1, 'B51-POS-2', :'iogurte_id'::uuid, 5, 20, 30, 30);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Vazia', 'C', '01', 'A', 1, 1, 1, 'B51-POS-3', 0, 0, 0, 10);

reset role;
select id as posicao_refri_id from public.gondola_positions where code = 'B51-POS-1' \gset
select id as posicao_iogurte_id from public.gondola_positions where code = 'B51-POS-2' \gset
select id as posicao_vazia_id from public.gondola_positions where code = 'B51-POS-3' \gset

------------------------------------------------------------
-- Caso 1: saldo acima do mínimo — nenhuma tarefa nasce.
------------------------------------------------------------
select test.as_user('f2000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_refri_id'::uuid, 10);
select test.ok((select current_balance from public.gondola_positions where id = :'posicao_refri_id'::uuid) = 10,
  'Saldo registrado na posição');
select test.ok(not exists (select 1 from public.replenishment_tasks where gondola_position_id = :'posicao_refri_id'::uuid),
  'Saldo acima do mínimo não cria tarefa');

------------------------------------------------------------
-- Caso 2: saldo no mínimo — cria tarefa até o ideal (PA-10), sem ruptura.
------------------------------------------------------------
select public.record_gondola_balance(:'posicao_refri_id'::uuid, 5);
select test.ok((select count(*) from public.replenishment_tasks where gondola_position_id = :'posicao_refri_id'::uuid and status = 'pendente') = 1,
  'Saldo no mínimo cria uma tarefa pendente');
select test.ok((select quantity_needed from public.replenishment_tasks where gondola_position_id = :'posicao_refri_id'::uuid) = 15,
  'Quantidade pedida mira o ideal (20), não o máximo (30) — 20 - 5 = 15');
select test.ok((select is_ruptura from public.replenishment_tasks where gondola_position_id = :'posicao_refri_id'::uuid) = false,
  'Saldo 5 (não zerado) não é ruptura');

-- PA-13: registrar de novo enquanto ainda está baixo não duplica a tarefa.
select public.record_gondola_balance(:'posicao_refri_id'::uuid, 3);
select test.ok((select count(*) from public.replenishment_tasks where gondola_position_id = :'posicao_refri_id'::uuid) = 1,
  'Não duplica tarefa enquanto já existe uma pendente para a posição');

------------------------------------------------------------
-- Caso 3: ruptura (saldo zero) — prioridade mais alta.
------------------------------------------------------------
select public.record_gondola_balance(:'posicao_iogurte_id'::uuid, 0);
select test.ok((select is_ruptura from public.replenishment_tasks where gondola_position_id = :'posicao_iogurte_id'::uuid) = true,
  'Saldo zero é ruptura');

------------------------------------------------------------
-- Caso 4: fator validade — lote perto de vencer dá prioridade (DEC-B5-02).
------------------------------------------------------------
select test.as_user('f2000000-0000-0000-0000-00000000000a');
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'LOTE-B51-1', current_date + 3);
reset role;
select id as lote_id from public.lots where warehouse_address_id = :'endereco_id'::uuid and product_id = :'iogurte_id'::uuid \gset

select test.as_user('f2000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 50, 'Compra inicial', null, :'lote_id'::uuid);

-- A tarefa do iogurte (caso 3) ainda está pendente; um novo registro de
-- saldo baixo não cria outra (PA-13), mas já existia sem o lote perto de
-- vencer. Recusa a tarefa antiga e registra de novo para conferir o fator
-- validade calculado no momento do registro.
select test.as_user('f2000000-0000-0000-0000-00000000000b');
reset role;
delete from public.replenishment_tasks where gondola_position_id = :'posicao_iogurte_id'::uuid;
select test.as_user('f2000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_iogurte_id'::uuid, 2);
select test.ok((select is_near_expiry from public.replenishment_tasks where gondola_position_id = :'posicao_iogurte_id'::uuid) = true,
  'Lote perto de vencer (3 dias, dentro do limite de 7) marca is_near_expiry no momento do registro');

------------------------------------------------------------
-- Caso 5: posição sem produto atribuído — não é possível registrar saldo.
------------------------------------------------------------
select test.as_user('f2000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.record_gondola_balance('%s'::uuid, 0)$$, :'posicao_vazia_id'),
  'Posição sem produto atribuído não pode registrar saldo/gerar tarefa');

------------------------------------------------------------
-- Permissões e listagem.
------------------------------------------------------------
select test.as_user('f2000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.record_gondola_balance('%s'::uuid, 5)$$, :'posicao_refri_id'),
  'Repositor não pode registrar saldo (B5.1 é dono/gerente; app do repositor chega no B5.2)');

select test.as_user('f2000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.list_replenishment_tasks(:'loja_id'::uuid)) = 2,
  'Dono lista as 2 tarefas pendentes do mercado');

-- Iogurte (com lote perto de vencer, bônus de prioridade) fica na frente do
-- refrigerante (sem nenhum bônus) na ordenação por prioridade.
select test.ok(
  (select product_id from public.list_replenishment_tasks(:'loja_id'::uuid) order by priority_score desc limit 1) = :'iogurte_id'::uuid,
  'Tarefa com lote perto de vencer vem primeiro na prioridade');

------------------------------------------------------------
-- Isolamento entre empresas.
------------------------------------------------------------
select test.as_user('f2000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.record_gondola_balance('%s'::uuid, 0)$$, :'posicao_refri_id'),
  'Dono de outra empresa não pode registrar saldo de posição alheia');
select test.throws(format($$select public.list_replenishment_tasks('%s'::uuid)$$, :'loja_id'),
  'Dono de outra empresa não pode listar tarefas de mercado alheio');
