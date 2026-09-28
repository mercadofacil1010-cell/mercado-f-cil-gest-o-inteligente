-- Testes de conferência cega do recebimento (B4.2).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-00000000000a','dono-conf@x.com','{"full_name":"Dono Conferencia"}'),
 ('e0000000-0000-0000-0000-00000000000b','gerente-conf@x.com','{"full_name":"Gerente Conferencia"}'),
 ('e0000000-0000-0000-0000-00000000000c','conferente-conf@x.com','{"full_name":"Conferente Conferencia"}'),
 ('e0000000-0000-0000-0000-00000000000d','repositor-conf@x.com','{"full_name":"Repositor Conferencia"}'),
 ('e0000000-0000-0000-0000-00000000000e','dono-outra-conf@x.com','{"full_name":"Dono Outra Empresa Conferencia"}');

select test.as_user('e0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Conferencia Ltda','Rede Conferencia','40381726000136');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('e0000000-0000-0000-0000-00000000000b','manager'),
         ('e0000000-0000-0000-0000-00000000000c','receiver'),
         ('e0000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '40381726000136';

select test.as_user('e0000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra Conferencia Ltda','Outra Conferencia','59402817000139');

reset role;
select id as rede_id from public.companies where cnpj = '40381726000136' \gset

select test.as_user('e0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Conferencia', 'CNF-CTR-1');
insert into public.suppliers (company_id, name) values (:'rede_id'::uuid, 'Distribuidora Conferencia Ltda');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Arroz Conferencia 1kg', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'CNF-CTR-1' \gset
select id as fornecedor_id from public.suppliers where name = 'Distribuidora Conferencia Ltda' \gset
select id as arroz_id from public.products where name = 'Arroz Conferencia 1kg' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('e0000000-0000-0000-0000-00000000000b'::uuid, 'e0000000-0000-0000-0000-00000000000c'::uuid);

insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'arroz_id'::uuid, 'Unidade', 1, true);
insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'arroz_id'::uuid, 'Caixa com 12', 12, false);

reset role;
select id as embalagem_unidade_id from public.product_packagings where product_id = :'arroz_id'::uuid and is_base \gset
select id as embalagem_caixa_id from public.product_packagings where product_id = :'arroz_id'::uuid and not is_base \gset

select test.as_user('e0000000-0000-0000-0000-00000000000a');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-CONF-001');
reset role;
select id as recebimento_id from public.receivings where invoice_number = 'NF-CONF-001' \gset

select test.as_user('e0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_id'::uuid, :'arroz_id'::uuid, 120);

-- Não é possível contar antes de iniciar a conferência.
reset role;
select test.as_user('e0000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 1)$$, :'recebimento_id', :'arroz_id', :'embalagem_unidade_id'),
  'Não é possível contar antes da conferência começar');

-- Repositor não pode iniciar a conferência (não é conferente/gerente/dono).
select test.as_user('e0000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.start_receiving_conference('%s'::uuid)$$, :'recebimento_id'),
  'Repositor não pode iniciar conferência');

-- O próprio conferente inicia a conferência (DEC-B4-03).
select test.as_user('e0000000-0000-0000-0000-00000000000c');
select public.start_receiving_conference(:'recebimento_id'::uuid);
select test.ok((select status from public.receivings where id = :'recebimento_id'::uuid) = 'em_conferencia',
  'Conferente inicia a conferência sozinho');
select test.ok((select conference_started_by from public.receivings where id = :'recebimento_id'::uuid) = 'e0000000-0000-0000-0000-00000000000c'::uuid,
  'Conferência registra quem iniciou');

-- Iniciar de novo, já em conferência, é idempotente (retomar).
select public.start_receiving_conference(:'recebimento_id'::uuid);
select test.ok((select status from public.receivings where id = :'recebimento_id'::uuid) = 'em_conferencia',
  'Iniciar de novo enquanto já está em conferência apenas retoma (idempotente)');

-- RN-REC-01: mesmo em conferência, o conferente nunca enxerga os itens esperados.
select test.ok((select count(*) from public.receiving_items) = 0,
  'Conferente continua sem ver itens esperados durante a conferência (RLS)');

-- Contagem simples: 3 caixas de 12 = 36 na unidade base.
select public.add_receiving_count(:'recebimento_id'::uuid, :'arroz_id'::uuid, :'embalagem_caixa_id'::uuid, 3);
select test.ok((select base_quantity from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid and packaging_id = :'embalagem_caixa_id'::uuid) = 36,
  'Contagem em caixa converte para a unidade base (3 x 12 = 36)');

-- Contagem com lote, validade e condição.
select public.add_receiving_count(
  :'recebimento_id'::uuid, :'arroz_id'::uuid, :'embalagem_unidade_id'::uuid, 5,
  'L-CONF-01', current_date - 30, current_date + 300, 'avariado', 'Caixa amassada, mas produto íntegro'
);
select test.ok((select count(*) from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid and condition = 'avariado') = 1,
  'Contagem registra lote, validade e condição do produto');

-- Quantidade inválida é recusada.
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 0)$$, :'recebimento_id', :'arroz_id', :'embalagem_unidade_id'),
  'Quantidade contada zero é recusada');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, -2)$$, :'recebimento_id', :'arroz_id', :'embalagem_unidade_id'),
  'Quantidade contada negativa é recusada');

-- Fabricação depois da validade é recusada (check de datas).
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, null, '%s'::date, '%s'::date)$$,
  :'recebimento_id', :'arroz_id', :'embalagem_unidade_id', (current_date + 10)::text, current_date::text),
  'Fabricação depois da validade é recusada');

-- Remover um item contado por engano.
reset role;
select id as item_avariado_id from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid and condition = 'avariado' \gset
select test.as_user('e0000000-0000-0000-0000-00000000000c');
select public.remove_receiving_count(:'item_avariado_id'::uuid);
select test.ok((select count(*) from public.receiving_counted_items where id = :'item_avariado_id'::uuid) = 0,
  'Item contado removido');

-- Gerente também pode contar no mesmo recebimento.
select test.as_user('e0000000-0000-0000-0000-00000000000b');
select public.add_receiving_count(:'recebimento_id'::uuid, :'arroz_id'::uuid, :'embalagem_unidade_id'::uuid, 2);
select test.ok((select count(*) from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid) = 2,
  'Gerente também pode registrar contagem no mesmo recebimento');

-- Repositor não enxerga nem pode contar.
reset role;
select test.as_user('e0000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.receiving_counted_items) = 0,
  'Repositor não enxerga itens contados (RLS)');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 1)$$, :'recebimento_id', :'arroz_id', :'embalagem_unidade_id'),
  'Repositor não pode registrar contagem');

-- Isolamento entre empresas.
reset role;
select test.as_user('e0000000-0000-0000-0000-00000000000e');
select test.ok((select count(*) from public.receiving_counted_items) = 0,
  'Dono de outra empresa não vê itens contados de recebimento alheio (RLS)');
select test.throws(format($$select public.start_receiving_conference('%s'::uuid)$$, :'recebimento_id'),
  'Dono de outra empresa não pode iniciar conferência alheia');

-- Sem exclusão física direta na tabela (só via remove_receiving_count).
reset role;
select test.as_user('e0000000-0000-0000-0000-00000000000a');
select test.throws(format($$delete from public.receiving_counted_items where id = '%s'::uuid$$,
  (select id from public.receiving_counted_items where receiving_id = :'recebimento_id'::uuid limit 1)),
  'Excluir fisicamente um item contado direto na tabela é recusado');

-- Depois de finalizado (simulando o B4.3), não é mais possível contar.
reset role;
update public.receivings set status = 'finalizado' where id = :'recebimento_id'::uuid;
select test.as_user('e0000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.add_receiving_count('%s'::uuid, '%s'::uuid, '%s'::uuid, 1)$$, :'recebimento_id', :'arroz_id', :'embalagem_unidade_id'),
  'Não é possível contar depois que o recebimento foi finalizado');
select test.throws(format($$select public.start_receiving_conference('%s'::uuid)$$, :'recebimento_id'),
  'Não é possível reiniciar a conferência de um recebimento já finalizado');
