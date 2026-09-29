-- Testes do mapeamento de produtos do PDV e reprocessamento (B7.2) —
-- conversão de unidade, pendência quando não mapeado, reprocesso sozinho
-- ao cadastrar o vínculo, e o botão de "tentar de novo".
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fa000000-0000-0000-0000-00000000000a','dono-b72@x.com','{"full_name":"Dono B72"}'),
 ('fa000000-0000-0000-0000-00000000000b','gerente-b72@x.com','{"full_name":"Gerente B72"}'),
 ('fa000000-0000-0000-0000-00000000000c','repositor-b72@x.com','{"full_name":"Repositor B72"}'),
 ('fa000000-0000-0000-0000-00000000000d','dono-outra-b72@x.com','{"full_name":"Dono Outra B72"}');

select test.as_user('fa000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B72 Ltda','Rede B72','33004455000134');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('fa000000-0000-0000-0000-00000000000b','manager'),
         ('fa000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '33004455000134';

select test.as_user('fa000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B72 Ltda','Outra B72','44005566000181');

reset role;
select id as rede_id from public.companies where cnpj = '33004455000134' \gset

select test.as_user('fa000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B72', 'B72-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Refrigerante B72', 'unidade', false);
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Água B72', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'B72-CTR-1' \gset
select id as refri_id from public.products where name = 'Refrigerante B72' \gset
select id as agua_id from public.products where name = 'Água B72' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('fa000000-0000-0000-0000-00000000000b'::uuid, 'fa000000-0000-0000-0000-00000000000c'::uuid);

select test.as_user('fa000000-0000-0000-0000-00000000000a');
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'refri_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'refri_id'::uuid, 'Fardo com 6', 6, false);
insert into public.product_packagings (product_id, name, conversion_factor, is_base) values (:'agua_id'::uuid, 'Unidade', 1, true);

reset role;
select id as embalagem_unidade_id from public.product_packagings where product_id = :'refri_id'::uuid and is_base \gset
select id as embalagem_fardo_id from public.product_packagings where product_id = :'refri_id'::uuid and not is_base \gset
select id as embalagem_agua_id from public.product_packagings where product_id = :'agua_id'::uuid \gset

------------------------------------------------------------
-- Caso 1: venda com 2 itens, nenhum mapeado — evento fica pendente.
------------------------------------------------------------
select test.as_user('fa000000-0000-0000-0000-00000000000b');
select public.receive_sale_event(
  :'loja_id'::uuid, 'CAIXA-01', 'EVT-B72-001', 'venda', now(),
  '[{"external_product_code":"PDV-REFRI-FARDO","quantity":2},{"external_product_code":"PDV-AGUA","quantity":3}]'::jsonb
);
reset role;
select id as evento_id from public.sale_events where external_event_id = 'EVT-B72-001' \gset
select test.ok((select status from public.sale_events where id = :'evento_id'::uuid) = 'pendente_mapeamento',
  'Evento com itens sem vínculo fica pendente de mapeamento');
select test.ok((select count(*) from public.sale_event_items where sale_event_id = :'evento_id'::uuid and product_id is null) = 2,
  'Nenhum item tem produto vinculado ainda');

------------------------------------------------------------
-- Caso 2: cadastrar o vínculo do fardo de refrigerante reprocessa sozinho
-- o evento — mas ainda falta o vínculo da água, então continua pendente.
------------------------------------------------------------
select test.as_user('fa000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.create_pdv_product_mapping('%s'::uuid, 'PDV-REFRI-FARDO', '%s'::uuid, '%s'::uuid)$$,
  :'loja_id', :'agua_id', :'embalagem_fardo_id'),
  'Embalagem que não pertence ao produto informado é rejeitada');

select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-REFRI-FARDO', :'refri_id'::uuid, :'embalagem_fardo_id'::uuid);
reset role;
select test.ok((select status from public.sale_events where id = :'evento_id'::uuid) = 'pendente_mapeamento',
  'Evento continua pendente — ainda falta o vínculo do código da água');
select test.ok((select product_id from public.sale_event_items where sale_event_id = :'evento_id'::uuid and external_product_code = 'PDV-REFRI-FARDO') = :'refri_id'::uuid,
  'Item do refrigerante já foi vinculado ao produto certo');
select test.ok((select base_quantity from public.sale_event_items where sale_event_id = :'evento_id'::uuid and external_product_code = 'PDV-REFRI-FARDO') = 12,
  'Quantidade convertida para unidade base (2 fardos × 6 = 12)');

------------------------------------------------------------
-- Caso 3: cadastrar o segundo vínculo reprocessa sozinho e o evento sai
-- de pendente (RF-PDV-07) — sem duplicar nada.
------------------------------------------------------------
select test.as_user('fa000000-0000-0000-0000-00000000000b');
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-AGUA', :'agua_id'::uuid, :'embalagem_agua_id'::uuid);
reset role;
select test.ok((select status from public.sale_events where id = :'evento_id'::uuid) = 'recebido',
  'Evento sai de pendente sozinho assim que o último vínculo é cadastrado');
select test.ok((select count(*) from public.sale_event_items where sale_event_id = :'evento_id'::uuid) = 2,
  'Reprocessar não duplica os itens');
select test.ok((select base_quantity from public.sale_event_items where sale_event_id = :'evento_id'::uuid and external_product_code = 'PDV-AGUA') = 3,
  'Água (fator 1) converte 3 para 3');

------------------------------------------------------------
-- Caso 4: corrigir um vínculo já existente (upsert) e reprocessar
-- manualmente um evento (RF-PDV-07, botão explícito).
------------------------------------------------------------
select test.as_user('fa000000-0000-0000-0000-00000000000b');
select public.create_pdv_product_mapping(:'loja_id'::uuid, 'PDV-AGUA', :'agua_id'::uuid, :'embalagem_agua_id'::uuid);
reset role;
select test.ok((select count(*) from public.pdv_product_mappings where market_id = :'loja_id'::uuid and external_product_code = 'PDV-AGUA') = 1,
  'Cadastrar o mesmo código de novo atualiza (upsert), não duplica o vínculo');

select test.as_user('fa000000-0000-0000-0000-00000000000b');
select public.reprocess_sale_event(:'evento_id'::uuid);
reset role;
select test.ok((select status from public.sale_events where id = :'evento_id'::uuid) = 'recebido',
  'Reprocessar manualmente um evento já mapeado não quebra nada');

------------------------------------------------------------
-- Caso 5: acesso — repositor não cadastra vínculo nem lista; outra
-- empresa não vê os vínculos deste mercado.
------------------------------------------------------------
select test.as_user('fa000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.create_pdv_product_mapping('%s'::uuid, 'PDV-NOVO', '%s'::uuid, '%s'::uuid)$$,
  :'loja_id', :'refri_id', :'embalagem_unidade_id'),
  'Repositor não pode cadastrar vínculo de produto');
select test.throws(format($$select public.list_pdv_product_mappings('%s'::uuid)$$, :'loja_id'),
  'Repositor não pode listar vínculos de produto');

select test.as_user('fa000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.list_pdv_product_mappings('%s'::uuid)$$, :'loja_id'),
  'Dono de outra empresa não pode listar vínculos de mercado alheio');

select test.as_user('fa000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.list_pdv_product_mappings(:'loja_id'::uuid)) = 2,
  'Dono lista os 2 vínculos cadastrados');
