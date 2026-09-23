-- Testes da trilha de auditoria (B0.2).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('10000000-0000-0000-0000-00000000000a','aud-a@x.com','{"full_name":"Dono Aud"}'),
 ('10000000-0000-0000-0000-00000000000b','aud-b@y.com','{"full_name":"Dono B Aud"}'),
 ('10000000-0000-0000-0000-00000000000c','aud-c@x.com','{"full_name":"Gerente Aud"}'),
 ('10000000-0000-0000-0000-00000000000d','aud-d@x.com','{"full_name":"Repositor Aud"}');

select test.ok((select count(*) from public.audit_log where entity = 'profiles' and action = 'insert') >= 4,
  'Auditoria registra a criação dos perfis');

-- Empresa e mercados
select test.as_user('10000000-0000-0000-0000-00000000000a');
select set_config('app.device', 'Celular do teste', false);
select set_config('app.ip', '200.0.0.1', false);
select public.create_company('Auditada Ltda','Auditada','22345678000149');
select test.ok((select count(*) from public.audit_log where entity = 'companies' and action = 'insert') = 1,
  'Auditoria registra a criação da empresa');
select test.ok((select context ->> 'device' from public.audit_log where entity = 'companies' order by id desc limit 1) = 'Celular do teste',
  'Auditoria guarda o dispositivo informado pelo app');
select test.ok((select context ->> 'ip' from public.audit_log where entity = 'companies' order by id desc limit 1) = '200.0.0.1',
  'Auditoria guarda o endereço IP');
select test.ok((select actor_id from public.audit_log where entity = 'companies' order by id desc limit 1) = '10000000-0000-0000-0000-00000000000a',
  'Auditoria guarda quem fez a ação');
select test.ok((select actor_role from public.audit_log where entity = 'company_members' order by id desc limit 1) = 'owner',
  'Auditoria guarda o papel de quem fez a ação');

insert into public.markets (company_id, name, internal_code, timezone)
  select id, 'Mercado Auditado', 'AUD-1', 'America/Manaus' from public.companies where cnpj = '22345678000149';
select test.ok((select market_id is not null and company_id is not null from public.audit_log where entity = 'markets' order by id desc limit 1),
  'Auditoria do mercado guarda empresa e mercado');
select test.ok((select market_timezone from public.audit_log where entity = 'markets' order by id desc limit 1) = 'America/Manaus',
  'Auditoria guarda o fuso horário do mercado');

-- Alterações: antes, depois e campos alterados
update public.markets set opening_hours = '8h às 22h' where internal_code = 'AUD-1';
select test.ok((select changed_fields @> array['opening_hours'] from public.audit_log where entity = 'markets' and action = 'update' order by id desc limit 1),
  'Auditoria lista os campos alterados');
select test.ok((select (before ->> 'opening_hours') is null and (after ->> 'opening_hours') = '8h às 22h'
  from public.audit_log where entity = 'markets' and action = 'update' order by id desc limit 1),
  'Auditoria guarda o valor antes e depois');

-- Atualização que não muda nada não gera registro
select count(*) as antes from public.audit_log \gset
update public.markets set opening_hours = '8h às 22h' where internal_code = 'AUD-1';
select test.ok((select count(*) from public.audit_log) = :antes, 'Atualização sem mudança real não vira registro');

-- Justificativa (ações sensíveis)
select set_config('app.justification', 'Suspensão por inadimplência', false);
update public.markets set status = 'awaiting_billing' where internal_code = 'AUD-1';
select test.ok((select context ->> 'justification' from public.audit_log where entity = 'markets' order by id desc limit 1) = 'Suspensão por inadimplência',
  'Auditoria guarda a justificativa da ação');
select set_config('app.justification', '', false);

-- Evento sem mudança de linha (login, exportação)
select public.log_audit_event('session', 'login', (select id from public.companies where cnpj = '22345678000149'), null, '{"metodo":"senha"}'::jsonb);
select test.ok((select action = 'event' and entity = 'session' and after ->> 'metodo' = 'senha'
  from public.audit_log order by id desc limit 1), 'Evento avulso (login) é registrado');

-- Imutabilidade
select test.throws($$update public.audit_log set entity = 'hack' where id = 1$$, 'Auditoria não pode ser alterada');
select test.throws($$delete from public.audit_log where id = 1$$, 'Auditoria não pode ser apagada');
select test.throws($$insert into public.audit_log (action, entity) values ('event','falso')$$, 'Usuário não escreve direto na auditoria');

-- Equipe para testar a leitura
reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('10000000-0000-0000-0000-00000000000c','manager'),('10000000-0000-0000-0000-00000000000d','stocker')) u(id, role)
where c.cnpj = '22345678000149';
select test.as_user('10000000-0000-0000-0000-00000000000a');
insert into public.member_markets (member_id, market_id)
select cm.id, m.id from public.company_members cm join public.markets m on m.company_id = cm.company_id
where cm.user_id in ('10000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-00000000000d') and m.internal_code = 'AUD-1';
select test.ok((select count(*) from public.audit_log where entity = 'member_markets') = 2, 'Auditoria registra os vínculos de mercado');

-- Quem lê o quê
select test.ok((select count(*) from public.audit_log where company_id is not null) > 5, 'Dono lê a auditoria da própria empresa');
select test.as_user('10000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.audit_log where market_id is not null) > 0, 'Gerente lê a auditoria do mercado vinculado');
select test.ok((select count(*) from public.audit_log where entity = 'companies') = 0, 'Gerente não lê a auditoria da empresa');
select test.as_user('10000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.audit_log where actor_id <> '10000000-0000-0000-0000-00000000000d') = 0,
  'Repositor lê somente as próprias ações');
select test.as_user(null);
select test.throws($$select count(*) from public.audit_log$$, 'Visitante sem login não lê a auditoria');
reset role;

-- Isolamento entre empresas.
-- O identificador da empresa X é capturado fora do RLS: um invasor usaria o UUID direto,
-- não uma consulta (que voltaria vazia por causa do RLS).
reset role;
select id as empresa_x from public.companies where cnpj = '22345678000149' \gset
select id as mercado_x from public.markets where internal_code = 'AUD-1' \gset
select test.as_user('10000000-0000-0000-0000-00000000000b');
select public.create_company('Outra Auditada','Outra','88765432000134');
select test.ok((select count(*) from public.audit_log where company_id = :'empresa_x'::uuid) = 0,
  'Dono de outra empresa não lê a auditoria alheia');
select test.throws(format($$select public.log_audit_event('hack', null, %L::uuid)$$, :'empresa_x'),
  'Não é possível registrar evento em empresa de outro cliente');
select test.throws(format($$select public.log_audit_event('hack', null, null, %L::uuid)$$, :'mercado_x'),
  'Não é possível registrar evento em mercado de outro cliente');
reset role;
