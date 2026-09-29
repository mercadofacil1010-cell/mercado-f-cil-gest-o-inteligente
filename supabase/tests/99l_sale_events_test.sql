-- Testes da recepção de eventos de venda do PDV (B7.1) — idempotência,
-- validações e acesso. Mapeamento de produto (B7.2) e baixa de estoque
-- (B7.3) ainda não existem: aqui só fila e desduplicação.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f9000000-0000-0000-0000-00000000000a','dono-b71@x.com','{"full_name":"Dono B71"}'),
 ('f9000000-0000-0000-0000-00000000000b','gerente-b71@x.com','{"full_name":"Gerente B71"}'),
 ('f9000000-0000-0000-0000-00000000000c','conferente-b71@x.com','{"full_name":"Conferente B71"}'),
 ('f9000000-0000-0000-0000-00000000000d','dono-outra-b71@x.com','{"full_name":"Dono Outra B71"}');

select test.as_user('f9000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B71 Ltda','Rede B71','11002233000140');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f9000000-0000-0000-0000-00000000000b','manager'),
         ('f9000000-0000-0000-0000-00000000000c','receiver')) u(id, role)
where c.cnpj = '11002233000140';

select test.as_user('f9000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B71 Ltda','Outra B71','22003344000197');

reset role;
select id as rede_id from public.companies where cnpj = '11002233000140' \gset

select test.as_user('f9000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B71', 'B71-CTR-1');

reset role;
select id as loja_id from public.markets where internal_code = 'B71-CTR-1' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f9000000-0000-0000-0000-00000000000b'::uuid, 'f9000000-0000-0000-0000-00000000000c'::uuid);

------------------------------------------------------------
-- Caso 1: gerente registra uma venda com 2 itens.
------------------------------------------------------------
select test.as_user('f9000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-001', 'venda', now(),
  '[{"external_product_code":"SKU-1","quantity":2},{"external_product_code":"SKU-2","quantity":1}]'::jsonb
);
reset role;
select id as evento_1_id from public.sale_events where external_event_id = 'EVT-001' \gset

select test.ok((select count(*) from public.sale_events where id = :'evento_1_id'::uuid) = 1,
  'Evento de venda é registrado');
select test.ok((select status from public.sale_events where id = :'evento_1_id'::uuid) = 'recebido',
  'Evento nasce com status recebido');
select test.ok((select count(*) from public.sale_event_items where sale_event_id = :'evento_1_id'::uuid) = 2,
  'Os 2 itens do evento são registrados');

------------------------------------------------------------
-- Caso 2: reenviar o mesmo evento nunca cria uma segunda linha (RN-PDV-01).
------------------------------------------------------------
select test.as_user('f9000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-001', 'venda', now(),
  '[{"external_product_code":"SKU-1","quantity":2},{"external_product_code":"SKU-2","quantity":1}]'::jsonb
);
reset role;
select test.ok((select count(*) from public.sale_events where external_event_id = 'EVT-001') = 1,
  'Reenviar o mesmo evento não duplica a linha');
select test.ok((select count(*) from public.sale_event_items where sale_event_id = :'evento_1_id'::uuid) = 2,
  'Reenviar o mesmo evento não duplica os itens');

------------------------------------------------------------
-- Caso 3: validações — sem item, cancelamento sem referência, quantidade zero.
------------------------------------------------------------
select test.as_user('f9000000-0000-0000-0000-00000000000b');
select test.throws(
  $$select public.receive_sale_event('$$ || :'loja_id' || $$'::uuid, 'CAIXA-01', 'EVT-002', 'venda', now(), '[]'::jsonb)$$,
  'Evento sem nenhum item é bloqueado'
);
select test.throws(
  $$select public.receive_sale_event('$$ || :'loja_id' || $$'::uuid, 'CAIXA-01', 'EVT-003', 'cancelamento', now(), '[{"external_product_code":"SKU-1","quantity":1}]'::jsonb)$$,
  'Cancelamento sem apontar para a venda original é bloqueado'
);
select test.throws(
  $$select public.receive_sale_event('$$ || :'loja_id' || $$'::uuid, 'CAIXA-01', 'EVT-004', 'venda', now(), '[{"external_product_code":"SKU-1","quantity":0}]'::jsonb)$$,
  'Item com quantidade zero é bloqueado'
);

------------------------------------------------------------
-- Caso 4: cancelamento com referência é aceito.
------------------------------------------------------------
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-005', 'cancelamento', now(),
  '[{"external_product_code":"SKU-1","quantity":2}]'::jsonb,
  'EVT-001'
);
reset role;
select test.ok((select reference_external_event_id from public.sale_events where external_event_id = 'EVT-005') = 'EVT-001',
  'Cancelamento fica vinculado ao evento de venda original');

------------------------------------------------------------
-- Caso 5: acesso — conferente não registra nem lista; outra empresa não vê.
------------------------------------------------------------
select test.as_user('f9000000-0000-0000-0000-00000000000c');
select test.throws(
  $$select public.receive_sale_event('$$ || :'loja_id' || $$'::uuid, 'CAIXA-01', 'EVT-006', 'venda', now(), '[{"external_product_code":"SKU-1","quantity":1}]'::jsonb)$$,
  'Conferente não pode registrar evento de venda'
);
select test.throws(format($$select public.list_sale_events('%s'::uuid)$$, :'loja_id'),
  'Conferente não pode listar eventos de venda');

select test.as_user('f9000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.list_sale_events('%s'::uuid)$$, :'loja_id'),
  'Dono de outra empresa não pode listar eventos de venda de mercado alheio');

------------------------------------------------------------
-- Caso 6: listagem — contagem de itens e filtro por status.
------------------------------------------------------------
select test.as_user('f9000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.list_sale_events(:'loja_id'::uuid)) = 2,
  'Dono lista os 2 eventos registrados até aqui (EVT-001 e EVT-005 — os demais falharam validação/permissão)');
select test.ok((select item_count from public.list_sale_events(:'loja_id'::uuid) where external_event_id = 'EVT-001') = 2,
  'Contagem de itens do evento está correta');
select test.ok((select count(*) from public.list_sale_events(:'loja_id'::uuid, 'recebido'::public.sale_event_status)) = 2,
  'Filtro por status recebido traz todos (nenhum foi processado ainda)');
select test.ok((select count(*) from public.list_sale_events(:'loja_id'::uuid, 'processado'::public.sale_event_status)) = 0,
  'Filtro por status processado não traz nada (mapeamento/baixa ainda não existem)');
