-- Testes das pendências de conciliação de sincronização offline (B5.5).
-- O que acontece de fato no celular (IndexedDB, fila de ações, fluxos
-- offline/online reais) não dá para testar aqui — isso é coberto na parte
-- manual. Aqui testamos só o que o banco garante: quem pode registrar uma
-- pendência, quem pode vê-la e resolvê-la (PA-40: nunca sobrescreve
-- silenciosamente).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f6000000-0000-0000-0000-00000000000a','dono-b55@x.com','{"full_name":"Dono B55"}'),
 ('f6000000-0000-0000-0000-00000000000b','gerente-b55@x.com','{"full_name":"Gerente B55"}'),
 ('f6000000-0000-0000-0000-00000000000c','repositor-b55@x.com','{"full_name":"Repositor B55"}'),
 ('f6000000-0000-0000-0000-00000000000d','dono-outra-b55@x.com','{"full_name":"Dono Outra Empresa B55"}');

select test.as_user('f6000000-0000-0000-0000-00000000000a');
select public.create_company('Rede B55 Ltda','Rede B55','55990012000100');

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f6000000-0000-0000-0000-00000000000b','manager'),
         ('f6000000-0000-0000-0000-00000000000c','stocker')) u(id, role)
where c.cnpj = '55990012000100';

select test.as_user('f6000000-0000-0000-0000-00000000000d');
select public.create_company('Rede Outra B55 Ltda','Outra B55','22334455000186');

reset role;
select id as rede_id from public.companies where cnpj = '55990012000100' \gset

select test.as_user('f6000000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B55', 'B55-CTR-1');
insert into public.markets (company_id, name, internal_code) values (:'rede_id'::uuid, 'Loja B55 2', 'B55-CTR-2');

reset role;
select id as loja_id from public.markets where internal_code = 'B55-CTR-1' \gset
select id as loja_2_id from public.markets where internal_code = 'B55-CTR-2' \gset

-- Gerente só tem acesso à primeira loja (o repositor também).
insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_id'::uuid from public.company_members cm
where cm.user_id in ('f6000000-0000-0000-0000-00000000000b'::uuid, 'f6000000-0000-0000-0000-00000000000c'::uuid);

------------------------------------------------------------
-- Caso 1: repositor registra uma pendência ao sincronizar e o servidor
-- recusar (ex.: a tarefa já tinha sido decidida por outra pessoa).
------------------------------------------------------------
select test.as_user('f6000000-0000-0000-0000-00000000000c');
select public.record_sync_conflict(
  :'loja_id'::uuid,
  'replenishment_withdrawal',
  '{"taskId":"11111111-1111-1111-1111-111111111111","quantity":10,"sourceWarehouseAddressId":"33333333-3333-3333-3333-333333333333"}'::jsonb,
  'Esta tarefa foi aceita por outro repositor'
);
reset role;
select id as pendencia_id from public.offline_sync_conflicts where action_type = 'replenishment_withdrawal' \gset

select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) = 1,
  'Pendência de conciliação é criada com o payload original');
select test.ok((select resolved_at from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) is null,
  'Pendência nasce não resolvida');

select test.as_user('f6000000-0000-0000-0000-00000000000c');
select test.throws($$select public.record_sync_conflict(null, 'replenishment_withdrawal', '{}'::jsonb, 'sem mercado')$$,
  'Não é possível registrar pendência sem um mercado válido');
select test.throws($$select public.record_sync_conflict('11111111-1111-1111-1111-111111111111'::uuid, 'replenishment_withdrawal', '{}'::jsonb, '')$$,
  'Motivo da falha é obrigatório');

------------------------------------------------------------
-- Caso 2: quem submeteu não vê a própria pendência de volta — mesmo padrão
-- de pending_stock_adjustments (B3.4); só dono/gerente do mercado veem.
------------------------------------------------------------
select test.as_user('f6000000-0000-0000-0000-00000000000c');
select test.ok((select count(*) from public.offline_sync_conflicts) = 0,
  'Repositor que registrou a pendência não a enxerga de volta');

select test.as_user('f6000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) = 1,
  'Gerente com acesso ao mercado enxerga a pendência');

select test.as_user('f6000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) = 1,
  'Dono enxerga a pendência mesmo sem estar vinculado ao mercado');

select test.as_user('f6000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) = 0,
  'Dono de outra empresa não enxerga a pendência alheia');

------------------------------------------------------------
-- Caso 3: resolver a pendência exige nota e é só dono/gerente.
------------------------------------------------------------
select test.as_user('f6000000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.resolve_sync_conflict('%s'::uuid, 'tentando resolver')$$, :'pendencia_id'),
  'Repositor não pode resolver a própria pendência');

select test.as_user('f6000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.resolve_sync_conflict('%s'::uuid, '')$$, :'pendencia_id'),
  'Nota de resolução é obrigatória');

select public.resolve_sync_conflict(:'pendencia_id'::uuid, 'Conferi com o repositor e refiz a contagem manualmente.');
reset role;
select test.ok((select resolved_at from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) is not null,
  'Pendência fica marcada como resolvida');
select test.ok((select resolved_by from public.offline_sync_conflicts where id = :'pendencia_id'::uuid) = 'f6000000-0000-0000-0000-00000000000b'::uuid,
  'Fica registrado quem resolveu');

select test.as_user('f6000000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.resolve_sync_conflict('%s'::uuid, 'de novo')$$, :'pendencia_id'),
  'Não é possível resolver a mesma pendência duas vezes');

------------------------------------------------------------
-- Caso 4: gerente sem acesso à segunda loja não enxerga nem resolve
-- pendências de lá.
------------------------------------------------------------
select test.as_user('f6000000-0000-0000-0000-00000000000a');
select public.record_sync_conflict(
  :'loja_2_id'::uuid,
  'receiving_count',
  '{"receivingId":"22222222-2222-2222-2222-222222222222"}'::jsonb,
  'A conferência deste recebimento já foi encerrada'
);
reset role;
select id as pendencia_2_id from public.offline_sync_conflicts where action_type = 'receiving_count' \gset

select test.as_user('f6000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_2_id'::uuid) = 0,
  'Gerente sem acesso à segunda loja não enxerga a pendência de lá');

select test.as_user('f6000000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.offline_sync_conflicts where id = :'pendencia_2_id'::uuid) = 1,
  'Dono enxerga a pendência da segunda loja normalmente');
