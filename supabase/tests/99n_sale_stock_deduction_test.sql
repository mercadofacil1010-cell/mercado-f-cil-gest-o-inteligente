-- Testes da baixa de estoque por venda do PDV (B7.3) — de qual posição a
-- venda tira (a de maior saldo), pendência quando não há posição, venda
-- maior que o saldo (zera e abre ocorrência), reposição automática e
-- devolução/cancelamento vinculados à venda original.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fb000000-0000-0000-0000-00000000000a','dono-b73@x.com','{"full_name":"Dono B73"}'),
 ('fb000000-0000-0000-0000-00000000000b','gerente-b73@x.com','{"full_name":"Gerente B73"}');

select test.as_user('fb000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B73 Ltda','Rede B73','55006600014028');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('fb000000-0000-0000-0000-00000000000b','manager')) u(id, role)
where c.cnpj = '55006600014028';

select id as rede_id from public.companies where cnpj = '55006600014028' \gset

select test.as_user('fb000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B73', 'B73-CTR-1');

reset role;
select id as loja_id from public.markets where internal_code = 'B73-CTR-1' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id = 'fb000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('fb000000-0000-0000-0000-00000000000a');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto A B73', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto B B73', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto C B73', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Produto D B73', 'unidade', false);

reset role;
select id as produto_a_id from public.products where name = 'Produto A B73' \gset
select id as produto_b_id from public.products where name = 'Produto B B73' \gset
select id as produto_c_id from public.products where name = 'Produto C B73' \gset
select id as produto_d_id from public.products where name = 'Produto D B73' \gset

select test.as_user('fb000000-0000-0000-0000-00000000000a');
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto_a_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto_b_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto_c_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'produto_d_id'::uuid, 'Unidade', 1, true);

reset role;
select id as emb_a_id from public.product_packagings where product_id = :'produto_a_id'::uuid \gset
select id as emb_b_id from public.product_packagings where product_id = :'produto_b_id'::uuid \gset
select id as emb_c_id from public.product_packagings where product_id = :'produto_c_id'::uuid \gset
select id as emb_d_id from public.product_packagings where product_id = :'produto_d_id'::uuid \gset

-- Produto A: duas posições, saldos diferentes (testa escolha da maior).
select test.as_user('fb000000-0000-0000-0000-00000000000a');
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '1', 'A', 1, 1, 1, 'A-POS-1', :'produto_a_id'::uuid, 5, 20, 30, 30, 10);
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '1', 'A', 1, 1, 2, 'A-POS-2', :'produto_a_id'::uuid, 5, 20, 30, 30, 25);

-- Produto B: uma posição, perto do mínimo (testa reposição automática).
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '2', 'A', 1, 1, 1, 'B-POS-1', :'produto_b_id'::uuid, 3, 10, 15, 15, 4);

-- Produto C: uma posição, saldo baixo (testa venda maior que o saldo).
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '3', 'A', 1, 1, 1, 'C-POS-1', :'produto_c_id'::uuid, 1, 10, 15, 15, 3);

-- Produto D: nenhuma posição ainda (testa pendência de posição).

reset role;
select id as pos_a1_id from public.gondola_positions where code = 'A-POS-1' \gset
select id as pos_a2_id from public.gondola_positions where code = 'A-POS-2' \gset
select id as pos_b_id from public.gondola_positions where code = 'B-POS-1' \gset
select id as pos_c_id from public.gondola_positions where code = 'C-POS-1' \gset

select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-A', :'produto_a_id'::uuid, :'emb_a_id'::uuid);
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-B', :'produto_b_id'::uuid, :'emb_b_id'::uuid);
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-C', :'produto_c_id'::uuid, :'emb_c_id'::uuid);
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-D', :'produto_d_id'::uuid, :'emb_d_id'::uuid);

------------------------------------------------------------
-- Caso 1: venda do produto A — baixa da posição com maior saldo (A-POS-2,
-- 25), nunca da A-POS-1 (10). Evento sai direto como 'processado'.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-A1', 'venda', now(),
  '[{"external_product_code":"PDV-A","quantity":16}]'::jsonb
);
reset role;
select id as evento_a1_id from public.sale_events where external_event_id = 'EVT-B73-A1' \gset

select test.ok((select status from public.sale_events where id = :'evento_a1_id'::uuid) = 'processado',
  'Venda já mapeada e com posição sai direto como processada');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a2_id'::uuid) = 9,
  'Baixa saiu da posição de maior saldo (25 - 16 = 9)');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a1_id'::uuid) = 10,
  'Posição de menor saldo não foi tocada');
select test.ok((select gondola_position_id from public.sale_event_items where sale_event_id = :'evento_a1_id'::uuid) = :'pos_a2_id'::uuid,
  'Item guarda de qual posição a baixa saiu (para a devolução saber depois)');

------------------------------------------------------------
-- Caso 2: nova venda do produto A — a maior posição agora é A-POS-1 (10),
-- já que A-POS-2 caiu para 9.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-A2', 'venda', now(),
  '[{"external_product_code":"PDV-A","quantity":3}]'::jsonb
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a1_id'::uuid) = 7,
  'Segunda venda baixou da posição que agora tem o maior saldo (10 - 3 = 7)');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a2_id'::uuid) = 9,
  'A outra posição não muda');

------------------------------------------------------------
-- Caso 3: venda do produto B derruba o saldo para o mínimo — reposição
-- nasce sozinha (RF-PDV-08), reaproveitando a regra do B5.1.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-B1', 'venda', now(),
  '[{"external_product_code":"PDV-B","quantity":2}]'::jsonb
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_b_id'::uuid) = 2,
  'Saldo do produto B caiu para 2 (4 - 2)');
select test.ok((select count(*) from public.replenishment_tasks where gondola_position_id = :'pos_b_id'::uuid and status = 'pendente') = 1,
  'Reposição foi criada sozinha ao cair para o mínimo ou menos');

------------------------------------------------------------
-- Caso 4: venda do produto C maior que o saldo disponível — nunca fica
-- negativo (zera) e abre uma ocorrência na Central de Inconsistências.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-C1', 'venda', now(),
  '[{"external_product_code":"PDV-C","quantity":5}]'::jsonb
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_c_id'::uuid) = 0,
  'Saldo nunca fica negativo — zera quando a venda é maior que o saldo (RN-EST-07)');
select test.ok((select count(*) from public.incidents where market_id = :'loja_id'::uuid and source = 'venda') = 1,
  'Venda maior que o saldo abre uma ocorrência (fonte "venda")');
select test.ok((select severity from public.incidents where source = 'venda' and market_id = :'loja_id'::uuid) = 'media',
  'Diferença de 40% entre o pedido (5) e o saldo disponível (3) — severidade calculada pela régua já existente (>10% e <=50%)');

------------------------------------------------------------
-- Caso 5: produto D não tem nenhuma posição de gôndola — a venda fica
-- pendente (nova pendência, RN-PDV-03/PA-16: nunca inventa posição).
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-D1', 'venda', now(),
  '[{"external_product_code":"PDV-D","quantity":1}]'::jsonb
);
reset role;
select id as evento_d1_id from public.sale_events where external_event_id = 'EVT-B73-D1' \gset
select test.ok((select status from public.sale_events where id = :'evento_d1_id'::uuid) = 'pendente_posicao',
  'Produto mapeado mas sem posição de gôndola fica pendente (nova pendência do B7.3)');
select test.ok((select unpositioned_codes from public.list_sale_events(:'loja_id'::uuid) where id = :'evento_d1_id'::uuid) = array['PDV-D'],
  'Listagem mostra o código sem posição configurada');

------------------------------------------------------------
-- Caso 6: cadastrar a posição do produto D reprocessa sozinho o evento
-- pendente (RF-PDV-07 aplicado à pendência de posição) — sem duplicar.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000a');
insert into public.gondola_positions (market_id, sector, aisle, gondola_number, side, module_number, shelf_number, position_number, code, product_id, min_quantity, ideal_quantity, max_quantity, capacity, current_balance)
values (:'loja_id'::uuid, 'Mercearia', '1', '4', 'A', 1, 1, 1, 'D-POS-1', :'produto_d_id'::uuid, 2, 10, 15, 15, 5);
reset role;
select id as pos_d_id from public.gondola_positions where code = 'D-POS-1' \gset

select test.ok((select status from public.sale_events where id = :'evento_d1_id'::uuid) = 'processado',
  'Configurar a posição reprocessa sozinho a venda que estava esperando por ela');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_d_id'::uuid) = 4,
  'A baixa que estava pendente foi aplicada (5 - 1 = 4)');

------------------------------------------------------------
-- Caso 7: cancelamento da venda EVT-B73-A2 devolve para a MESMA posição
-- de onde a venda original tirou (A-POS-1), vinculado à venda original.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-A2-CANC', 'cancelamento', now(),
  '[{"external_product_code":"PDV-A","quantity":3}]'::jsonb,
  'EVT-B73-A2'
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a1_id'::uuid) = 10,
  'Cancelamento devolveu para a mesma posição de onde a venda original tirou (7 + 3 = 10)');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a2_id'::uuid) = 9,
  'A outra posição do mesmo produto não foi tocada pelo cancelamento');

------------------------------------------------------------
-- Caso 8: devolução que referencia uma venda que este sistema nunca viu —
-- cai na posição mais carente do produto (nunca escolha silenciosa). Neste
-- momento A-POS-1 tem 10 e A-POS-2 tem 9 — a mais carente é a A-POS-2.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-A-DEV', 'devolucao', now(),
  '[{"external_product_code":"PDV-A","quantity":4}]'::jsonb,
  'EVT-EXTERNO-DESCONHECIDO'
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a2_id'::uuid) = 13,
  'Sem a venda original, a devolução foi para a posição mais carente do produto (9 + 4 = 13)');
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a1_id'::uuid) = 10,
  'A posição mais cheia do mesmo produto não foi tocada pela devolução');

------------------------------------------------------------
-- Caso 9: reenviar/reprocessar não duplica nada.
------------------------------------------------------------
select test.as_user('fb000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B73-A1', 'venda', now(),
  '[{"external_product_code":"PDV-A","quantity":16}]'::jsonb
);
reset role;
select test.ok((select current_balance from public.gondola_positions where id = :'pos_a2_id'::uuid) = 13,
  'Reenviar o mesmo evento de venda não baixa o estoque de novo');

select test.as_user('fb000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.reprocess_sale_event('%s'::uuid)$$, :'evento_a1_id'),
  'Reprocessar manualmente um evento já processado é bloqueado');
