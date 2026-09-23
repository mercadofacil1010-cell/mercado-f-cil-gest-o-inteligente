-- Testes de aprovação por limite de perdas e ajustes (B3.4).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a','dono-aprov@x.com','{"full_name":"Dono Aprovacao"}'),
 ('a0000000-0000-0000-0000-00000000000b','gerente-aprov@x.com','{"full_name":"Gerente Aprovacao"}'),
 ('a0000000-0000-0000-0000-00000000000c','repositor-aprov@x.com','{"full_name":"Repositor Aprovacao"}'),
 ('a0000000-0000-0000-0000-00000000000d','dono-outra-aprov@x.com','{"full_name":"Dono Outra Empresa Aprovacao"}');

select test.as_user('a0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Aprovacao Ltda','Rede Aprovacao','77661122000153');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('a0000000-0000-0000-0000-00000000000b','manager'),('a0000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '77661122000153';

select test.as_user('a0000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Aprovacao Ltda','Outra Aprovacao','66551122000184');

reset role;
select id as rede_id from public.companies where cnpj = '77661122000153' \gset

select test.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Aprovacao', 'APV-CTR-1');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Arroz Aprovacao 5kg', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'APV-CTR-1' \gset
select id as arroz_id from public.products where name = 'Arroz Aprovacao 5kg' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id = 'a0000000-0000-0000-0000-00000000000b'::uuid;

select test.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.warehouse_addresses (market_id, warehouse_name, sector, street, aisle, shelf, level, position, code, capacity)
values (:'loja_id'::uuid, 'Depósito 1', 'Mercearia', 'A', '01', '01', '01', '01', 'APV-END-1', 1000);

reset role;
select id as endereco_id from public.warehouse_addresses where code = 'APV-END-1' \gset

-- Limite padrão da empresa é 20 (conferido antes de qualquer alteração).
select test.ok((select loss_adjustment_approval_threshold from public.companies where id = :'rede_id'::uuid) = 20,
  'Limite padrão de aprovação da empresa é 20');

-- Entrada inicial de estoque (não passa por aprovação, tipo não é perda/ajuste).
select test.as_user('a0000000-0000-0000-0000-00000000000a');
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'entrada', 500, 'Recebimento inicial');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 500,
  'Entrada normal não passa por aprovação');

-- Perda abaixo do limite (20) entra direto no livro.
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'perda', -5, 'Avaria pequena', 'Pacote rasgado na prateleira');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 495,
  'Perda abaixo do limite abate o estoque na hora');
select test.ok((select count(*) from public.pending_stock_adjustments) = 0,
  'Perda abaixo do limite não gera pedido de aprovação');

-- Perda acima do limite exige motivo, mesmo indo para aprovação.
select test.throws(format($$select public.register_stock_movement('%s'::uuid, '%s'::uuid, 'perda', -30, null, null)$$, :'endereco_id', :'arroz_id'),
  'Perda acima do limite sem motivo é recusada');

-- Perda acima do limite, com motivo, fica pendente e NÃO abate o estoque ainda.
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'perda', -30, 'Lote danificado no transporte', 'Caixa inteira molhada, descartada');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 495,
  'Perda acima do limite não abate o estoque enquanto pendente');
select test.ok((select count(*) from public.pending_stock_adjustments where status = 'pending') = 1,
  'Perda acima do limite cria um pedido pendente');

reset role;
select id as pendente_id from public.pending_stock_adjustments where status = 'pending' \gset

-- Quem pediu não pode aprovar nem recusar o próprio pedido.
select test.as_user('a0000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.approve_pending_stock_adjustment('%s'::uuid, null)$$, :'pendente_id'),
  'Quem pediu não pode aprovar o próprio pedido');
select test.throws(format($$select public.reject_pending_stock_adjustment('%s'::uuid, 'não')$$, :'pendente_id'),
  'Quem pediu não pode recusar o próprio pedido');

-- Repositor não tem permissão para aprovar (nem enxerga a fila).
reset role;
select test.as_user('a0000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.pending_stock_adjustments) = 0,
  'Repositor não enxerga pedidos pendentes (RLS)');
select test.throws(format($$select public.approve_pending_stock_adjustment('%s'::uuid, null)$$, :'pendente_id'),
  'Repositor não pode aprovar pedidos');

-- Dono de outra empresa não enxerga nem aprova pedido alheio.
reset role;
select test.as_user('a0000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.pending_stock_adjustments) = 0,
  'Dono de outra empresa não vê pedidos pendentes de mercado alheio (RLS)');
select test.throws(format($$select public.approve_pending_stock_adjustment('%s'::uuid, null)$$, :'pendente_id'),
  'Dono de outra empresa não pode aprovar pedido alheio');

-- Gerente do mercado aprova o pedido: gera o movimento real e abate o estoque.
reset role;
select test.as_user('a0000000-0000-0000-0000-00000000000b');
select public.approve_pending_stock_adjustment(:'pendente_id'::uuid, 'Confirmado com o fornecedor, autorizado o descarte');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 465,
  'Aprovação gera o movimento real e abate o estoque (495 - 30)');
select test.ok((select status from public.pending_stock_adjustments where id = :'pendente_id'::uuid) = 'approved',
  'Pedido aprovado muda de status');
select test.ok((select resulting_movement_id from public.pending_stock_adjustments where id = :'pendente_id'::uuid) is not null,
  'Pedido aprovado guarda o movimento resultante');

-- Pedido já resolvido não pode ser aprovado/recusado de novo.
select test.throws(format($$select public.approve_pending_stock_adjustment('%s'::uuid, null)$$, :'pendente_id'),
  'Pedido já aprovado não pode ser aprovado de novo');

-- Ajuste negativo acima do limite, pendente, recusado pelo dono.
select test.as_user('a0000000-0000-0000-0000-00000000000b');
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'ajuste', -25, 'Contagem divergente', 'Contagem física achou 25 a menos');
reset role;
select id as pendente_ajuste_id from public.pending_stock_adjustments where type = 'ajuste' and status = 'pending' \gset

select test.as_user('a0000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.reject_pending_stock_adjustment('%s'::uuid, '')$$, :'pendente_ajuste_id'),
  'Recusar pedido sem motivo é recusado');
select public.reject_pending_stock_adjustment(:'pendente_ajuste_id'::uuid, 'Contagem parece errada, refazer antes de aprovar');
select test.ok((select balance from public.stock_balances where warehouse_address_id = :'endereco_id'::uuid and product_id = :'arroz_id'::uuid) = 465,
  'Pedido recusado não altera o estoque');
select test.ok((select status from public.pending_stock_adjustments where id = :'pendente_ajuste_id'::uuid) = 'rejected',
  'Pedido recusado muda de status');

-- Ajuste positivo acima do limite também passa por aprovação (não é só perda).
select public.register_stock_movement(:'endereco_id'::uuid, :'arroz_id'::uuid, 'ajuste', 40, 'Sobra na contagem', 'Contagem física achou 40 a mais');
select test.ok((select count(*) from public.pending_stock_adjustments where type = 'ajuste' and quantity = 40) = 1,
  'Ajuste positivo acima do limite também gera pedido pendente');
