-- Testes das regras de acesso e integridade (B0.1). Cada linha vira um OK/FALHA no relatório.
\set ON_ERROR_STOP 1

-- Usuários: A dono de X, B dono de Y, C gerente de X (mercados 1 e 2), D repositor de X (mercado 2),
-- E conferente de X (mercado 1), F segundo dono de X, ADM administrador da plataforma.
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@x.com','{"full_name":"Dono A"}'),
 ('00000000-0000-0000-0000-00000000000b','b@y.com','{"full_name":"Dono B"}'),
 ('00000000-0000-0000-0000-00000000000c','c@x.com','{"full_name":"Gerente C"}'),
 ('00000000-0000-0000-0000-00000000000d','d@x.com','{"full_name":"Repositor D"}'),
 ('00000000-0000-0000-0000-00000000000e','e@x.com','{"full_name":"Conferente E"}'),
 ('00000000-0000-0000-0000-00000000000f','f@x.com','{"full_name":"Dono F"}'),
 ('00000000-0000-0000-0000-0000000000ad','adm@mf.com','{"full_name":"Admin"}');
insert into public.platform_admins values ('00000000-0000-0000-0000-0000000000ad');
update public.profiles set cpf = '12345678909' where id = '00000000-0000-0000-0000-00000000000d';
select test.ok((select count(*) from public.profiles) = 7, 'Perfil criado automaticamente no cadastro');

-- Empresas
select test.as_user('00000000-0000-0000-0000-00000000000a');
select test.throws($$select public.create_company('Rede X Ltda','Rede X','12345678000100')$$, 'CNPJ com dígito verificador errado é recusado');
select test.throws($$select public.create_company('Rede X Ltda','Rede X','11111111111111')$$, 'CNPJ com dígitos repetidos é recusado');
select public.create_company('Rede X Ltda','Rede X','12345678000195');
select test.ok((select account_status = 'active' and subscription_status = 'trial' and trial_ends_at > now() from public.companies), 'Empresa nasce com conta ativa e assinatura em teste');
insert into public.markets (company_id, name, internal_code) select id, 'X Centro', 'UND-1' from public.companies;
insert into public.markets (company_id, name, internal_code) select id, 'X Jardim', 'UND-2' from public.companies;
insert into public.markets (company_id, name) select id, 'X Avenida' from public.companies;
insert into public.markets (company_id, name) select id, 'X Norte' from public.companies;
select test.ok(true, 'Código interno do mercado é opcional (dois mercados sem código)');
select test.throws($$insert into public.markets (company_id, name) select id, 'x centro' from public.companies$$, 'Nome de mercado repetido na empresa é recusado (sem diferenciar maiúsculas)');
select test.throws($$insert into public.markets (company_id, name, internal_code) select id, 'X Sul', 'und-1' from public.companies$$, 'Código interno repetido na empresa é recusado');
select test.throws($$insert into public.markets (company_id, name, cnpj) select id, 'X Leste', '12345678000100' from public.companies$$, 'CNPJ inválido no mercado é recusado');
insert into public.markets (company_id, name, cnpj, uses_parent_cnpj) select id, 'X Filial', '12345678000195', true from public.companies;
select test.ok(true, 'Mercado pode usar o CNPJ da matriz');

reset role;
-- Equipe de X (feito como sistema; o fluxo de convite chega no B1.5)
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('00000000-0000-0000-0000-00000000000c','manager'),('00000000-0000-0000-0000-00000000000d','stocker'),('00000000-0000-0000-0000-00000000000e','receiver')) u(id, role)
where c.cnpj = '12345678000195';

-- Dono A vincula a equipe aos mercados
select test.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.member_markets (member_id, market_id)
select cm.id, m.id from public.company_members cm join public.markets m on m.company_id = cm.company_id
where (cm.user_id = '00000000-0000-0000-0000-00000000000c' and m.name in ('X Centro','X Jardim'))
   or (cm.user_id = '00000000-0000-0000-0000-00000000000d' and m.name = 'X Jardim')
   or (cm.user_id = '00000000-0000-0000-0000-00000000000e' and m.name = 'X Centro');
select test.ok((select count(*) from public.member_markets) = 4, 'Dono vincula membros a vários mercados');
select test.ok((select count(*) from public.markets) = 5, 'Dono vê todos os mercados da empresa');

-- Empresa Y
select test.as_user('00000000-0000-0000-0000-00000000000b');
select public.create_company('Rede Y Ltda','Rede Y','98765432000198');
insert into public.markets (company_id, name) select id, 'Y Único' from public.companies;
select test.throws($$select public.create_company('Outra','Outra','12345678000195')$$, 'CNPJ de empresa já cadastrada é recusado');
select test.ok((select count(*) from public.companies) = 1, 'Isolamento: dono de Y vê só a própria empresa');
select test.ok((select count(*) from public.markets) = 1, 'Isolamento: dono de Y não vê mercados de X');
select test.ok((select count(*) from public.company_members) = 1, 'Isolamento: dono de Y não vê equipe de X');
select test.ok((select count(*) from public.profiles) = 1, 'Isolamento: dono de Y não vê perfis de X');
select test.ok(test.rows($$update public.markets set name = 'hack' where name like 'X %'$$) = 0, 'Isolamento: dono de Y não altera mercados de X');
reset role;
select test.as_user('00000000-0000-0000-0000-00000000000b');
select test.throws($$insert into public.member_markets (member_id, market_id)
  select (select id from public.company_members limit 1), '00000000-0000-0000-0000-000000000000'::uuid$$, 'Vínculo com mercado de outra empresa é recusado');

-- Gerente C (Centro e Jardim)
select test.as_user('00000000-0000-0000-0000-00000000000c');
select test.ok((select string_agg(name, ',' order by name) from public.markets) = 'X Centro,X Jardim', 'Gerente vê somente os 2 mercados vinculados');
select test.ok((select count(*) from public.company_members) = 3, 'Gerente vê a equipe que compartilha mercados com ele (ele, D e E)');
select test.ok((select count(*) from public.profiles) = 3, 'Gerente vê os perfis da própria equipe');
select test.ok(test.rows($$update public.markets set opening_hours = '8h-22h' where name = 'X Jardim'$$) = 1, 'Gerente edita mercado vinculado');
select test.ok(test.rows($$update public.markets set opening_hours = 'x' where name = 'X Avenida'$$) = 0, 'Gerente não edita mercado sem vínculo');
select test.throws($$insert into public.markets (company_id, name) select company_id, 'X Novo' from public.company_members limit 1$$, 'Gerente não cria mercados');
select test.throws($$insert into public.member_markets (member_id, market_id) select cm.id, m.id from public.company_members cm, public.markets m where m.name = 'X Centro' and cm.user_id = '00000000-0000-0000-0000-00000000000d'$$, 'Gerente não cria vínculos de mercado (somente dono, por enquanto)');

-- Repositor D (Jardim)
select test.as_user('00000000-0000-0000-0000-00000000000d');
select test.ok((select string_agg(name, ',') from public.markets) = 'X Jardim', 'Repositor vê somente o mercado vinculado');
select test.ok((select count(*) from public.company_members) = 1, 'Repositor não vê a equipe (só o próprio vínculo)');
select test.ok((select count(*) from public.profiles) = 1, 'Repositor vê somente o próprio perfil');
select test.ok(test.rows($$update public.markets set name = 'hack'$$) = 0, 'Repositor não edita mercados');

-- Conferente E (Centro)
select test.as_user('00000000-0000-0000-0000-00000000000e');
select test.ok((select string_agg(name, ',') from public.markets) = 'X Centro', 'Conferente vê somente o mercado vinculado');
select test.ok((select count(*) from public.member_markets) = 1, 'Conferente vê só os próprios vínculos');

-- Administrador da plataforma
select test.as_user('00000000-0000-0000-0000-0000000000ad');
select test.ok((select count(*) from public.companies) = 2, 'Administrador vê as empresas (dados comerciais)');
select test.ok((select count(*) from public.profiles where cpf is not null) = 0, 'Administrador não vê CPF nem perfis dos clientes');

-- Anônimo
select test.as_user(null);
select test.ok((select count(*) from public.companies) = 0, 'Visitante sem login não vê empresas');
select test.ok((select count(*) from public.markets) = 0, 'Visitante sem login não vê mercados');
select test.throws($$select public.create_company('a','b','11222333000181')$$, 'Visitante sem login não cria empresa');
reset role;

-- Histórico: nada é apagado
select test.as_user('00000000-0000-0000-0000-00000000000a');
select test.throws($$delete from public.markets where name = 'X Norte'$$, 'Excluir mercado é bloqueado (deve inativar)');
select test.throws($$delete from public.company_members where user_id = '00000000-0000-0000-0000-00000000000d'$$, 'Excluir membro é bloqueado (deve desativar)');
select test.throws($$delete from public.companies$$, 'Excluir empresa é bloqueado');
select test.ok(test.rows($$update public.company_members set status = 'disabled' where user_id = '00000000-0000-0000-0000-00000000000e'$$) = 1, 'Dono desativa membro');
select test.ok(test.rows($$delete from public.member_markets mm using public.company_members cm where cm.id = mm.member_id and cm.user_id = '00000000-0000-0000-0000-00000000000d'$$) = 1, 'Dono remove o acesso de um membro a um mercado');

-- Ciclo de vida do mercado
select test.throws($$update public.markets set status = 'active' where name = 'X Norte'$$, 'Mercado não vai de rascunho direto para ativo');
select test.ok(test.rows($$update public.markets set status = 'awaiting_billing' where name = 'X Norte'$$) = 1, 'Rascunho → aguardando cobrança');
select test.ok(test.rows($$update public.markets set status = 'active' where name = 'X Norte'$$) = 1, 'Aguardando cobrança → ativo');
select test.ok(test.rows($$update public.markets set status = 'inactive' where name = 'X Norte'$$) = 1, 'Ativo → inativo');
select test.throws($$update public.markets set status = 'active' where name = 'X Norte'$$, 'Mercado inativo não volta a ativo');
select test.ok(test.rows($$update public.markets set is_open = true where name = 'X Centro'$$) = 1, 'Aberto/fechado é independente do ciclo de vida');
reset role;

-- Sempre um dono ativo
select test.throws($$update public.company_members set role = 'manager' where user_id = '00000000-0000-0000-0000-00000000000a'$$, 'Último dono ativo não pode ser rebaixado');
select test.throws($$update public.company_members set status = 'disabled' where user_id = '00000000-0000-0000-0000-00000000000a'$$, 'Último dono ativo não pode ser desativado');
insert into public.company_members (company_id, user_id, role) select id, '00000000-0000-0000-0000-00000000000f', 'owner' from public.companies where cnpj = '12345678000195';
select test.as_user('00000000-0000-0000-0000-00000000000f');
select test.ok(test.rows($$update public.company_members set role = 'manager' where user_id = '00000000-0000-0000-0000-00000000000a'$$) = 1, 'Com outro dono ativo, um dono pode ser rebaixado');
select test.ok(test.rows($$update public.company_members set role = 'manager' where user_id = '00000000-0000-0000-0000-00000000000f'$$) = 0, 'Dono não altera o próprio vínculo');
reset role;

-- Mover registros entre empresas
select test.throws($$update public.markets set company_id = (select id from public.companies where cnpj = '98765432000198') where name = 'X Centro'$$, 'Mercado não pode ser movido para outra empresa');

-- CPF
select test.throws($$update public.profiles set cpf = '12345678900' where id = '00000000-0000-0000-0000-00000000000a'$$, 'CPF com dígito verificador errado é recusado');
select test.ok(public.is_valid_cpf('12345678909') and not public.is_valid_cpf('11111111111'), 'Validação de CPF (válido e repetido)');
