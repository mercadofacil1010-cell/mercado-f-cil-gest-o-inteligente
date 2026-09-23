-- Testes dos cadastros de apoio do catálogo: fornecedores, categorias e marcas (B2.1).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('30000000-0000-0000-0000-00000000000a','dono-cat@x.com','{"full_name":"Dono Catalogo"}'),
 ('30000000-0000-0000-0000-00000000000b','gerente-cat@x.com','{"full_name":"Gerente Catalogo"}'),
 ('30000000-0000-0000-0000-00000000000c','repositor-cat@x.com','{"full_name":"Repositor Catalogo"}'),
 ('30000000-0000-0000-0000-00000000000d','dono-outra-cat@x.com','{"full_name":"Dono Outra Empresa"}');

select test.as_user('30000000-0000-0000-0000-00000000000a');
select public.create_company('Rede Catalogo Ltda','Rede Catalogo','52345678000100');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('30000000-0000-0000-0000-00000000000b','manager'),('30000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '52345678000100';

select test.as_user('30000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra Catalogo Ltda','Outra Catalogo','62345678000163');

-- Dono cria fornecedor, categoria e marca.
select test.as_user('30000000-0000-0000-0000-00000000000a');
insert into public.suppliers (company_id, name, cnpj, phone, lead_time_days)
select id, 'Distribuidora Teste', '11222333000181', '11988887777', 3 from public.companies where cnpj = '52345678000100';
select test.ok((select count(*) from public.suppliers where name = 'Distribuidora Teste') = 1, 'Dono cadastra fornecedor');

insert into public.categories (company_id, name)
select id, 'Bebidas' from public.companies where cnpj = '52345678000100';
select test.ok((select count(*) from public.categories where name = 'Bebidas') = 1, 'Dono cadastra categoria');

insert into public.brands (company_id, name)
select id, 'Marca Teste' from public.companies where cnpj = '52345678000100';
select test.ok((select count(*) from public.brands where name = 'Marca Teste') = 1, 'Dono cadastra marca');

select test.throws($$insert into public.suppliers (company_id, name)
  select id, 'distribuidora teste' from public.companies where cnpj = '52345678000100'$$,
  'Nome de fornecedor repetido na empresa é recusado (sem diferenciar maiúsculas)');

select test.throws($$insert into public.suppliers (company_id, cnpj, name)
  select id, '123', 'Fornecedor CNPJ invalido' from public.companies where cnpj = '52345678000100'$$,
  'CNPJ fora do formato é recusado no fornecedor');

-- Gerente também cadastra e edita (PA-04, DEC-B1-10).
reset role;
select test.as_user('30000000-0000-0000-0000-00000000000b');
insert into public.suppliers (company_id, name)
select id, 'Fornecedor do Gerente' from public.companies where cnpj = '52345678000100';
select test.ok((select count(*) from public.suppliers where name = 'Fornecedor do Gerente') = 1, 'Gerente também cadastra fornecedor');

select id as supplier_id from public.suppliers where name = 'Fornecedor do Gerente' \gset
update public.suppliers set lead_time_days = 5 where id = :'supplier_id'::uuid;
select test.ok((select lead_time_days = 5 from public.suppliers where id = :'supplier_id'::uuid), 'Gerente edita fornecedor');
update public.suppliers set status = 'inactive' where id = :'supplier_id'::uuid;
select test.ok((select status = 'inactive' from public.suppliers where id = :'supplier_id'::uuid), 'Gerente inativa fornecedor (sem excluir)');

-- Repositor não vê nem cadastra (matriz de perfis, DEC-B1-10: só dono/gerente têm tela de catálogo).
reset role;
select test.as_user('30000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.suppliers) = 0, 'Repositor não enxerga fornecedores da empresa');
select test.throws($$insert into public.suppliers (company_id, name)
  select id, 'Fornecedor do Repositor' from public.companies where cnpj = '52345678000100'$$,
  'Repositor não cadastra fornecedor — permission denied pela política de INSERT');

-- Ninguém apaga fornecedor/categoria/marca de verdade (RN-ACL-06).
reset role;
select test.as_user('30000000-0000-0000-0000-00000000000a');
select test.throws($$delete from public.suppliers where id = (select id from public.suppliers limit 1)$$,
  'Ninguém apaga fornecedor de verdade — só inativar');
select test.throws($$delete from public.categories where id = (select id from public.categories limit 1)$$,
  'Ninguém apaga categoria de verdade — só inativar');
select test.throws($$delete from public.brands where id = (select id from public.brands limit 1)$$,
  'Ninguém apaga marca de verdade — só inativar');

-- Isolamento entre empresas.
reset role;
select id as rede_catalogo_id from public.companies where cnpj = '52345678000100' \gset
select test.as_user('30000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.suppliers) = 0, 'Dono de outra empresa não vê fornecedores da Rede Catalogo');
select test.throws(format($$insert into public.suppliers (company_id, name) values ('%s', 'Fornecedor Invasor')$$, :'rede_catalogo_id'),
  'Dono de outra empresa não cadastra fornecedor em empresa que não é sua');

-- Auditoria (mesmo mecanismo genérico do B0.2).
reset role;
select test.as_user('30000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.audit_log where entity = 'suppliers' and action = 'insert') >= 2,
  'Criação de fornecedor vira evento de auditoria');
select test.ok((select count(*) from public.audit_log where entity = 'suppliers' and action = 'update') >= 1,
  'Edição/inativação de fornecedor vira evento de auditoria');

reset role;
