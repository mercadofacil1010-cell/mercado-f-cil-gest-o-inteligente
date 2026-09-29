-- Testes da Central de Inconsistências (B6.1) — ocorrência automática a
-- partir de recebimento, reposição, inventário e validade; ciclo de vida
-- (reconhecer, investigar, atribuir, encerrar com justificativa, reabrir).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f7000000-0000-0000-0000-00000000000a','dono-b61@x.com','{"full_name":"Dono B61"}'),
 ('f7000000-0000-0000-0000-00000000000b','gerente-b61@x.com','{"full_name":"Gerente B61"}'),
 ('f7000000-0000-0000-0000-00000000000c','conferente-b61@x.com','{"full_name":"Conferente B61"}'),
 ('f7000000-0000-0000-0000-00000000000d','repositor-b61@x.com','{"full_name":"Repositor B61"}'),
 ('f7000000-0000-0000-0000-00000000000e','dono-outra-b61@x.com','{"full_name":"Dono Outra B61"}');

select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B61 Ltda','Rede B61','66001122000100');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f7000000-0000-0000-0000-00000000000b','manager'),
         ('f7000000-0000-0000-0000-00000000000c','receiver'),
         ('f7000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '66001122000100';

select test.as_user('f7000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra B61 Ltda','Outra B61','77002233000158');

reset role;
select id as rede_id from public.companies where cnpj = '66001122000100' \gset

select test.as_user('f7000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B61', 'B61-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Suco B61', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Iogurte B61', 'unidade', true);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Leite B61', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'B61-CTR-1' \gset
select id as suco_id from public.products where name = 'Suco B61' \gset
select id as iogurte_id from public.products where name = 'Iogurte B61' \gset
select id as leite_id from public.products where name = 'Leite B61' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in (
  'f7000000-0000-0000-0000-00000000000b'::uuid,
  'f7000000-0000-0000-0000-00000000000c'::uuid,
  'f7000000-0000-0000-0000-00000000000d'::uuid
);

select test.as_user('f7000000-0000-0000-0000-00000000000a');
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'suco_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'iogurte_id'::uuid, 'Unidade', 1, true);
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'B61-END-1', 1000);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity)
values (:'loja_id'::uuid, 'Bebidas', 'A', '01', 'A', 1, 1, 1, 'B61-POS-1', :'suco_id'::uuid, 5, 20, 30, 30);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'B61-END-1' \gset
select id as posicao_id from public.gondola_positions where code = 'B61-POS-1' \gset
select id as embalagem_suco_id from public.product_packagings where product_id = :'suco_id'::uuid \gset

------------------------------------------------------------
-- Caso 1: recebimento com divergência DENTRO do limite — gerente finaliza
-- direto e a ocorrência já nasce (para acompanhamento, não para agir).
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B61-001');
reset role;
select id as receb_1_id from public.receivings where invoice_number = 'NF-B61-001' \gset
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'receb_1_id'::uuid, :'suco_id'::uuid, 100);

select test.as_user('f7000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'receb_1_id'::uuid);
select public.add_receiving_count(:'receb_1_id'::uuid, :'suco_id'::uuid, :'embalagem_suco_id'::uuid, 95);

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'receb_1_id'::uuid, :'endereco_id'::uuid, 'Faltaram 5 unidades na carga.');
reset role;
select test.ok((select count(*) from public.incidents where reference_receiving_id = :'receb_1_id'::uuid) = 1,
  'Divergência de recebimento dentro do limite já gera ocorrência');
select test.ok((select source from public.incidents where reference_receiving_id = :'receb_1_id'::uuid) = 'recebimento',
  'Ocorrência marcada como origem recebimento');
select test.ok((select expected_quantity from public.incidents where reference_receiving_id = :'receb_1_id'::uuid) = 100
  and (select counted_quantity from public.incidents where reference_receiving_id = :'receb_1_id'::uuid) = 95,
  'Ocorrência guarda esperado e contado do recebimento');

------------------------------------------------------------
-- Caso 2: recebimento com divergência ACIMA do limite — ocorrência nasce
-- assim que fica aguardando_aprovacao, antes do dono decidir.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B61-002');
reset role;
select id as receb_2_id from public.receivings where invoice_number = 'NF-B61-002' \gset
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'receb_2_id'::uuid, :'suco_id'::uuid, 100);

select test.as_user('f7000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'receb_2_id'::uuid);
select public.add_receiving_count(:'receb_2_id'::uuid, :'suco_id'::uuid, :'embalagem_suco_id'::uuid, 40);

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'receb_2_id'::uuid, :'endereco_id'::uuid, 'Carga veio bem incompleta.');
reset role;
select test.ok((select status from public.receivings where id = :'receb_2_id'::uuid) = 'aguardando_aprovacao',
  'Divergência grande fica aguardando aprovação do dono');
select test.ok((select count(*) from public.incidents where reference_receiving_id = :'receb_2_id'::uuid) = 1,
  'Ocorrência já nasce mesmo antes do dono decidir');
select test.ok((select severity from public.incidents where reference_receiving_id = :'receb_2_id'::uuid) = 'alta',
  'Diferença de 60% vira gravidade alta');

select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.finalize_receiving(:'receb_2_id'::uuid, :'endereco_id'::uuid, 'Aprovado — fornecedor já avisado.');
reset role;
select test.ok((select count(*) from public.incidents where reference_receiving_id = :'receb_2_id'::uuid) = 1,
  'Finalizar depois de aguardando_aprovacao não duplica a ocorrência');

------------------------------------------------------------
-- Caso 3: reposição com inconsistência (3 tentativas erradas) gera
-- ocorrência automaticamente via gatilho.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'suco_id'::uuid, 'entrada', 200, 'Compra inicial');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.record_gondola_balance(:'posicao_id'::uuid, 5);
reset role;
select id as tarefa_id from public.replenishment_tasks where gondola_position_id = :'posicao_id'::uuid \gset

select test.as_user('f7000000-0000-0000-0000-00000000000d');
select public.accept_replenishment_task(:'tarefa_id'::uuid);
select public.register_replenishment_withdrawal(:'tarefa_id'::uuid, 15, :'endereco_id'::uuid);
select public.register_replenishment_return(:'tarefa_id'::uuid, 0);
select public.submit_replenishment_count(:'tarefa_id'::uuid, 19);
select public.submit_replenishment_count(:'tarefa_id'::uuid, 21);
select public.submit_replenishment_count(:'tarefa_id'::uuid, 22);
reset role;
select test.ok((select status from public.replenishment_tasks where id = :'tarefa_id'::uuid) = 'com_inconsistencia',
  'Tarefa vira com_inconsistencia após 3 tentativas erradas');
select test.ok((select count(*) from public.incidents where reference_task_id = :'tarefa_id'::uuid) = 1,
  'Ocorrência de reposição nasce sozinha via gatilho');
select test.ok((select expected_quantity from public.incidents where reference_task_id = :'tarefa_id'::uuid) = 20
  and (select counted_quantity from public.incidents where reference_task_id = :'tarefa_id'::uuid) = 22,
  'Ocorrência guarda esperado (saldo anterior + retirado − devolvido) e a última contagem');

------------------------------------------------------------
-- Caso 4: inventário com diferença — ocorrência nasce junto com o ajuste
-- automático (sem lançar um segundo movimento). Produto próprio (leite),
-- sem nenhum movimento anterior, para a diferença ficar previsível.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'leite_id'::uuid, 'entrada', 100, 'Compra inicial leite');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.start_inventory_count(:'endereco_id'::uuid);
reset role;
select id as contagem_id from public.inventory_counts where warehouse_address_id = :'endereco_id'::uuid and status = 'aberta' \gset

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.set_inventory_count_item(:'contagem_id'::uuid, :'leite_id'::uuid, 95);
select public.finalize_inventory_count(:'contagem_id'::uuid);
reset role;
select test.ok((select count(*) from public.incidents where reference_inventory_count_id = :'contagem_id'::uuid) = 1,
  'Diferença de inventário gera ocorrência');
select test.ok((select correction_movement_id from public.incidents where reference_inventory_count_id = :'contagem_id'::uuid) is not null,
  'Ocorrência de inventário já vem com o movimento de ajuste vinculado (dentro do limite)');

------------------------------------------------------------
-- Caso 5: lote vencido ainda com saldo — sincronizado sob demanda, nunca
-- duplica ao chamar de novo.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.get_or_create_lot(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'LOTE-VENCIDO-B61', (current_date - 5));
reset role;
select id as lote_vencido_id from public.lots where batch_number = 'LOTE-VENCIDO-B61' \gset
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'iogurte_id'::uuid, 'entrada', 10, 'Compra', null, :'lote_vencido_id'::uuid);

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.sync_expiry_incidents(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.incidents where reference_lot_id = :'lote_vencido_id'::uuid) = 1,
  'Lote vencido com saldo gera ocorrência de validade');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.sync_expiry_incidents(:'loja_id'::uuid);
reset role;
select test.ok((select count(*) from public.incidents where reference_lot_id = :'lote_vencido_id'::uuid) = 1,
  'Chamar de novo não duplica a ocorrência de validade já aberta');

------------------------------------------------------------
-- Caso 6: acesso — só dono/gerente com acesso ao mercado veem/gerenciam;
-- outra empresa não enxerga nada.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.list_incidents('%s'::uuid)$$, :'loja_id'),
  'Conferente não pode listar inconsistências');

select test.as_user('f7000000-0000-0000-0000-00000000000e');
select test.throws(format($$select public.list_incidents('%s'::uuid)$$, :'loja_id'),
  'Dono de outra empresa não pode listar inconsistências de mercado alheio');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.list_incidents(:'loja_id'::uuid)) >= 5,
  'Gerente com acesso ao mercado lista todas as ocorrências criadas até aqui');

------------------------------------------------------------
-- Caso 7: ciclo de vida — reconhecer, investigar, atribuir, encerrar
-- (sempre com justificativa), reabrir.
------------------------------------------------------------
select id as incidente_id from public.incidents where reference_receiving_id = :'receb_1_id'::uuid \gset

select test.as_user('f7000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.acknowledge_incident('%s'::uuid)$$, :'incidente_id'),
  'Repositor não pode reconhecer inconsistência (sem acesso de gerência)');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.acknowledge_incident(:'incidente_id'::uuid);
reset role;
select test.ok((select status from public.incidents where id = :'incidente_id'::uuid) = 'reconhecida',
  'Inconsistência reconhecida');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.acknowledge_incident('%s'::uuid)$$, :'incidente_id'),
  'Não é possível reconhecer duas vezes');

select public.start_incident_investigation(:'incidente_id'::uuid);
reset role;
select test.ok((select status from public.incidents where id = :'incidente_id'::uuid) = 'em_investigacao',
  'Inconsistência entra em investigação');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.assign_incident(:'incidente_id'::uuid, 'f7000000-0000-0000-0000-00000000000c'::uuid, (current_date + 3));
reset role;
select test.ok((select assigned_to from public.incidents where id = :'incidente_id'::uuid) = 'f7000000-0000-0000-0000-00000000000c'::uuid,
  'Responsável atribuído');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.resolve_incident('%s'::uuid, 'descartada', '')$$, :'incidente_id'),
  'Encerrar sem justificativa é bloqueado (RF-INC-08)');

select public.resolve_incident(:'incidente_id'::uuid, 'descartada', 'Foi só arredondamento de nota, sem impacto real.');
reset role;
select test.ok((select status from public.incidents where id = :'incidente_id'::uuid) = 'encerrada',
  'Inconsistência encerrada');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'suco_id'::uuid) is not null,
  'Encerrar não impede o saldo de existir (sanity check da tabela)');

select test.as_user('f7000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.reopen_incident('%s'::uuid, 'quero reabrir')$$, :'incidente_id'),
  'Repositor não pode reabrir inconsistência');

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.reopen_incident('%s'::uuid, '')$$, :'incidente_id'),
  'Reabrir sem motivo é bloqueado');
select public.reopen_incident(:'incidente_id'::uuid, 'Fornecedor confirmou que realmente faltou produto.');
reset role;
select test.ok((select status from public.incidents where id = :'incidente_id'::uuid) = 'aberta',
  'Inconsistência reaberta volta para aberta');
select test.ok((select reopened_count from public.incidents where id = :'incidente_id'::uuid) = 1,
  'Contador de reabertura incrementa');

------------------------------------------------------------
-- Caso 8: RN-INC-02 — encerrar (mesmo "corrigida") nunca lança movimento
-- sozinho; só aceita vincular um movimento que já existe neste mercado.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000b');
select id as movimento_qualquer_id from public.stock_movements where warehouse_address_id = :'endereco_id'::uuid limit 1 \gset
reset role;

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.acknowledge_incident(:'incidente_id'::uuid);
select public.resolve_incident(:'incidente_id'::uuid, 'corrigida', 'Ajuste já feito à parte.', :'movimento_qualquer_id'::uuid);
reset role;
select test.ok((select correction_movement_id from public.incidents where id = :'incidente_id'::uuid) = :'movimento_qualquer_id'::uuid,
  'Encerrar como corrigida vincula o movimento já existente, sem criar um novo');

------------------------------------------------------------
-- Caso 9: recorrência — segunda ocorrência do mesmo produto em 30 dias
-- nasce sinalizada como recorrente, sem esconder a primeira.
------------------------------------------------------------
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, null, 'NF-B61-003');
reset role;
select id as receb_3_id from public.receivings where invoice_number = 'NF-B61-003' \gset
select test.as_user('f7000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'receb_3_id'::uuid, :'suco_id'::uuid, 50);

select test.as_user('f7000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'receb_3_id'::uuid);
select public.add_receiving_count(:'receb_3_id'::uuid, :'suco_id'::uuid, :'embalagem_suco_id'::uuid, 48);

select test.as_user('f7000000-0000-0000-0000-00000000000b');
select public.finalize_receiving(:'receb_3_id'::uuid, :'endereco_id'::uuid, 'Faltaram 2 de novo.');
reset role;
select test.ok((select is_recurring from public.incidents where reference_receiving_id = :'receb_3_id'::uuid) = true,
  'Nova divergência do mesmo produto dentro de 30 dias nasce marcada como recorrente');
select test.ok((select count(*) from public.incidents where product_id = :'suco_id'::uuid) >= 4,
  'Ocorrências anteriores do mesmo produto continuam todas visíveis (nada foi escondido/agrupado)');
