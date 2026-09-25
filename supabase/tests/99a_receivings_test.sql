-- Testes de recebimento e itens esperados (B4.1).
-- Nome de arquivo: a convenção de 2 dígitos (00-99) chegou ao fim; "99a"
-- mantém a ordenação como STRING depois de "99_..." sem precisar renomear
-- os arquivos existentes (ver histórico do B3.2 sobre esse mesmo problema).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('d0000000-0000-0000-0000-00000000000a','dono-receb@x.com','{"full_name":"Dono Recebimento"}'),
 ('d0000000-0000-0000-0000-00000000000b','gerente-receb@x.com','{"full_name":"Gerente Recebimento"}'),
 ('d0000000-0000-0000-0000-00000000000c','conferente-receb@x.com','{"full_name":"Conferente Recebimento"}'),
 ('d0000000-0000-0000-0000-00000000000d','repositor-receb@x.com','{"full_name":"Repositor Recebimento"}'),
 ('d0000000-0000-0000-0000-00000000000e','dono-outra-receb@x.com','{"full_name":"Dono Outra Empresa Recebimento"}');

select test.as_user('d0000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Recebimento Ltda','Rede Recebimento','82945134000140');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('d0000000-0000-0000-0000-00000000000b','manager'),
         ('d0000000-0000-0000-0000-00000000000c','receiver'),
         ('d0000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '82945134000140';

select test.as_user('d0000000-0000-0000-0000-00000000000e');
select public.create_company('Rede Outra Recebimento Ltda','Outra Recebimento','91827364000103');

reset role;
select id as rede_id from public.companies where cnpj = '82945134000140' \gset

select test.as_user('d0000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja Recebimento', 'REC-CTR-1');
insert into public.suppliers (company_id, name) values (:'rede_id'::uuid, 'Distribuidora Recebimento Ltda');
insert into public.products (company_id, name, base_unit, tracks_batch_expiry) values (:'rede_id'::uuid, 'Oleo Recebimento 900ml', 'unidade', false);

reset role;
select id as loja_id from public.markets where internal_code = 'REC-CTR-1' \gset
select id as fornecedor_id from public.suppliers where name = 'Distribuidora Recebimento Ltda' \gset
select id as oleo_id from public.products where name = 'Oleo Recebimento 900ml' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('d0000000-0000-0000-0000-00000000000b'::uuid, 'd0000000-0000-0000-0000-00000000000c'::uuid);

-- Repositor não pode criar recebimento (não é dono/gerente).
select test.as_user('d0000000-0000-0000-0000-00000000000d');
select test.throws(format($$select public.create_receiving('%s'::uuid, '%s'::uuid, 'NF-001')$$, :'loja_id', :'fornecedor_id'),
  'Repositor não pode criar recebimento');

-- Sem nota fiscal e sem motivo é recusado (PA-07: sempre auditado quando sem nota).
reset role;
select test.as_user('d0000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.create_receiving('%s'::uuid, '%s'::uuid, null, null, null)$$, :'loja_id', :'fornecedor_id'),
  'Recebimento sem nota fiscal e sem motivo é recusado');

-- Dono cria recebimento com nota fiscal.
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, 'NF-12345');
select test.ok((select count(*) from public.receivings where market_id = :'loja_id'::uuid) = 1,
  'Recebimento criado com nota fiscal');

reset role;
select id as recebimento_id from public.receivings where invoice_number = 'NF-12345' \gset

-- Gerente cria recebimento sem nota, com motivo (PA-07 aceito com justificativa).
select test.as_user('d0000000-0000-0000-0000-00000000000b');
select public.create_receiving(:'loja_id'::uuid, :'fornecedor_id'::uuid, null, 'Pedido 456', 'Fornecedor entregou sem a nota, envia depois por e-mail');
select test.ok((select count(*) from public.receivings where market_id = :'loja_id'::uuid and no_invoice_reason is not null) = 1,
  'Recebimento sem nota fiscal aceito com motivo registrado');

-- Adicionar item esperado.
select test.as_user('d0000000-0000-0000-0000-00000000000a');
select public.add_receiving_item(:'recebimento_id'::uuid, :'oleo_id'::uuid, 48);
select test.ok((select expected_quantity from public.receiving_items where receiving_id = :'recebimento_id'::uuid and product_id = :'oleo_id'::uuid) = 48,
  'Item esperado adicionado com a quantidade correta');

-- Corrigir a quantidade esperada antes da conferência começar (upsert).
select public.add_receiving_item(:'recebimento_id'::uuid, :'oleo_id'::uuid, 60);
select test.ok((select expected_quantity from public.receiving_items where receiving_id = :'recebimento_id'::uuid and product_id = :'oleo_id'::uuid) = 60,
  'Corrigir a quantidade esperada substitui o valor (upsert)');

-- Quantidade esperada inválida é recusada.
select test.throws(format($$select public.add_receiving_item('%s'::uuid, '%s'::uuid, 0)$$, :'recebimento_id', :'oleo_id'),
  'Quantidade esperada zero é recusada');
select test.throws(format($$select public.add_receiving_item('%s'::uuid, '%s'::uuid, -5)$$, :'recebimento_id', :'oleo_id'),
  'Quantidade esperada negativa é recusada');

-- Remover item esperado.
select public.remove_receiving_item((select id from public.receiving_items where receiving_id = :'recebimento_id'::uuid and product_id = :'oleo_id'::uuid));
select test.ok((select count(*) from public.receiving_items where receiving_id = :'recebimento_id'::uuid) = 0,
  'Item esperado removido');

-- Depois que a conferência começa (status muda), não é mais possível alterar itens.
reset role;
update public.receivings set status = 'em_conferencia' where id = :'recebimento_id'::uuid;
select test.as_user('d0000000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.add_receiving_item('%s'::uuid, '%s'::uuid, 10)$$, :'recebimento_id', :'oleo_id'),
  'Não é possível adicionar item depois que a conferência começou');
reset role;
update public.receivings set status = 'aguardando_recebimento' where id = :'recebimento_id'::uuid;
select test.as_user('d0000000-0000-0000-0000-00000000000a');

-- RN-REC-01: conferente enxerga o cabeçalho do recebimento...
reset role;
select test.as_user('d0000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.receivings where market_id = :'loja_id'::uuid) = 2,
  'Conferente enxerga o cabeçalho dos recebimentos do mercado dele');
-- ...mas NUNCA os itens esperados (blindagem real, não só de tela): nem
-- consulta (RLS) nem consegue escrever (permissão da função).
select test.ok((select count(*) from public.receiving_items) = 0,
  'Conferente não enxerga (nem pelo RLS) os itens esperados de nenhum recebimento');
select test.throws(format($$select public.add_receiving_item('%s'::uuid, '%s'::uuid, 48)$$, :'recebimento_id', :'oleo_id'),
  'Conferente não pode adicionar item esperado (só dono/gerente)');

-- Repositor não vê nem cabeçalho (não é dono/gerente/conferente vinculado a esse propósito).
reset role;
select test.as_user('d0000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.receivings where market_id = :'loja_id'::uuid) = 0,
  'Repositor não enxerga recebimentos (RLS)');

-- Isolamento entre empresas.
reset role;
select test.as_user('d0000000-0000-0000-0000-00000000000e');
select test.ok((select count(*) from public.receivings where market_id = :'loja_id'::uuid) = 0,
  'Dono de outra empresa não vê recebimentos de mercado alheio (RLS)');
select test.throws(format($$select public.create_receiving('%s'::uuid, '%s'::uuid, 'NF-999')$$, :'loja_id', :'fornecedor_id'),
  'Dono de outra empresa não pode criar recebimento em mercado alheio');

-- Sem exclusão física (RN-ACL-06) — só remove_receiving_item (função) apaga um item em rascunho.
reset role;
select test.as_user('d0000000-0000-0000-0000-00000000000a');
select test.throws(format($$delete from public.receivings where id = '%s'::uuid$$, :'recebimento_id'),
  'Excluir fisicamente um recebimento é recusado');
