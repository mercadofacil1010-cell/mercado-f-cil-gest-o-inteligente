-- Testes de produtos, embalagens e conversões (B2.2).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('40000000-0000-0000-0000-00000000000a','dono-prod@x.com','{"full_name":"Dono Produtos"}'),
 ('40000000-0000-0000-0000-00000000000b','gerente-prod@x.com','{"full_name":"Gerente Produtos"}'),
 ('40000000-0000-0000-0000-00000000000c','repositor-prod@x.com','{"full_name":"Repositor Produtos"}'),
 ('40000000-0000-0000-0000-00000000000d','dono-outra-prod@x.com','{"full_name":"Dono Outra Empresa Produtos"}');

select test.as_user('40000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Produtos Ltda','Rede Produtos','72345678000117');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('40000000-0000-0000-0000-00000000000b','manager'),('40000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '72345678000117';

select test.as_user('40000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Produtos Ltda','Outra Produtos','82345678000170');

reset role;
select id as rede_produtos_id from public.companies where cnpj = '72345678000117' \gset

-- Dono cadastra produto e a embalagem-base.
select test.as_user('40000000-0000-0000-0000-00000000000a');
insert into public.products (company_id, name, barcode, base_unit)
values (:'rede_produtos_id'::uuid, 'Leite Integral 1L', '7891000100103', 'unidade');
select test.ok((select count(*) from public.products where name = 'Leite Integral 1L') = 1, 'Dono cadastra produto');

select id as leite_id from public.products where name = 'Leite Integral 1L' \gset
insert into public.product_packagings (product_id, name, conversion_factor, is_base)
values (:'leite_id'::uuid, 'Unidade', 1, true);
select test.ok((select count(*) from public.product_packagings where product_id = :'leite_id'::uuid) = 1,
  'Dono cadastra a embalagem-base do produto');

insert into public.product_packagings (product_id, name, conversion_factor)
values (:'leite_id'::uuid, 'Caixa', 12);
select test.ok((select count(*) from public.product_packagings where product_id = :'leite_id'::uuid and name = 'Caixa') = 1,
  'Dono cadastra embalagem em cadeia (Caixa = 12 unidades)');

-- Regras de embalagem.
select test.throws(format($$insert into public.product_packagings (product_id, name, conversion_factor)
  values ('%s'::uuid, 'Fardo Invalido', 0)$$, :'leite_id'),
  'Fator de conversão zero é recusado');
select test.throws(format($$insert into public.product_packagings (product_id, name, conversion_factor)
  values ('%s'::uuid, 'Fardo Negativo', -6)$$, :'leite_id'),
  'Fator de conversão negativo é recusado');
select test.throws(format($$insert into public.product_packagings (product_id, name, conversion_factor, is_base)
  values ('%s'::uuid, 'Base Errada', 2, true)$$, :'leite_id'),
  'Embalagem-base precisa ter fator igual a 1');
select test.throws(format($$insert into public.product_packagings (product_id, name, conversion_factor, is_base)
  values ('%s'::uuid, 'Segunda Base', 1, true)$$, :'leite_id'),
  'Só pode existir uma embalagem-base ativa por produto');

-- Trocar o fator de uma embalagem preserva a linha antiga (inativa) em vez de reescrevê-la.
update public.product_packagings set status = 'inactive' where product_id = :'leite_id'::uuid and name = 'Caixa';
insert into public.product_packagings (product_id, name, conversion_factor)
values (:'leite_id'::uuid, 'Caixa', 24);
select test.ok((select count(*) from public.product_packagings where product_id = :'leite_id'::uuid and name = 'Caixa') = 2,
  'Trocar o fator da Caixa cria uma nova linha, sem apagar a antiga (histórico preservado)');
select test.ok((select conversion_factor from public.product_packagings where product_id = :'leite_id'::uuid and name = 'Caixa' and status = 'inactive') = 12,
  'A embalagem antiga mantém o fator de conversão original');
select test.ok((select conversion_factor from public.product_packagings where product_id = :'leite_id'::uuid and name = 'Caixa' and status = 'active') = 24,
  'A embalagem ativa reflete o novo fator de conversão');

-- Código de barras único por empresa.
select test.throws(format($$insert into public.products (company_id, name, barcode, base_unit)
  values ('%s'::uuid, 'Leite Duplicado', '7891000100103', 'unidade')$$, :'rede_produtos_id'),
  'Código de barras repetido na empresa é recusado');
insert into public.products (company_id, name, base_unit)
values (:'rede_produtos_id'::uuid, 'Banana Prata', 'quilograma');
insert into public.products (company_id, name, base_unit)
values (:'rede_produtos_id'::uuid, 'Banana Prata Organica', 'quilograma');
select test.ok(true, 'Dois produtos sem código de barras não conflitam entre si');

-- Gerente também cadastra (PA-04, DEC-B1-10).
reset role;
select test.as_user('40000000-0000-0000-0000-00000000000b');
insert into public.products (company_id, name, base_unit)
values (:'rede_produtos_id'::uuid, 'Produto do Gerente', 'unidade');
select test.ok((select count(*) from public.products where name = 'Produto do Gerente') = 1, 'Gerente também cadastra produto');

-- Repositor não vê nem cadastra (matriz de perfis, DEC-B1-10).
reset role;
select test.as_user('40000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.products) = 0, 'Repositor não enxerga produtos da empresa');
select test.throws(format($$insert into public.products (company_id, name, base_unit)
  values ('%s'::uuid, 'Produto do Repositor', 'unidade')$$, :'rede_produtos_id'),
  'Repositor não cadastra produto — permission denied pela política de INSERT');
select test.ok((select count(*) from public.product_packagings) = 0, 'Repositor também não enxerga embalagens');

-- Ninguém apaga produto/embalagem de verdade (RN-ACL-06).
reset role;
select test.as_user('40000000-0000-0000-0000-00000000000a');
select test.throws(format($$delete from public.products where id = '%s'::uuid$$, :'leite_id'),
  'Ninguém apaga produto de verdade — só inativar');
select test.throws($$delete from public.product_packagings where id = (select id from public.product_packagings limit 1)$$,
  'Ninguém apaga embalagem de verdade — só inativar');

-- Isolamento entre empresas.
reset role;
select test.as_user('40000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.products) = 0, 'Dono de outra empresa não vê produtos da Rede Produtos');
select test.throws(format($$insert into public.products (company_id, name, base_unit)
  values ('%s'::uuid, 'Produto Invasor', 'unidade')$$, :'rede_produtos_id'),
  'Dono de outra empresa não cadastra produto em empresa que não é sua');

-- Auditoria (mesmo mecanismo genérico do B0.2).
reset role;
select test.as_user('40000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.audit_log where entity = 'products' and action = 'insert') >= 3,
  'Criação de produto vira evento de auditoria');
select test.ok((select count(*) from public.audit_log where entity = 'product_packagings') >= 3,
  'Criação/edição de embalagem vira evento de auditoria');

reset role;
