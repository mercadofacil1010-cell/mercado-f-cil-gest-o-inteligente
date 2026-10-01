-- Testes do conector de PDV real (B7.4) — token de integração por
-- mercado, ingestão via token (sem sessão autenticada), idempotência e
-- revogação.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('fa740000-0000-0000-0000-00000000000a','dono-b74@x.com','{"full_name":"Dono B74"}'),
 ('fa740000-0000-0000-0000-00000000000b','gerente-b74@x.com','{"full_name":"Gerente B74"}');

select test.as_user('fa740000-0000-0000-0000-00000000000a');
select public.create_company('Rede B74 Ltda','Rede B74','99001100166090');
reset role;
select id as empresa_b74_id from public.companies where cnpj = '99001100166090' \gset

insert into public.company_members (company_id, user_id, role)
values (:'empresa_b74_id'::uuid, 'fa740000-0000-0000-0000-00000000000b', 'manager');

select test.as_user('fa740000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code) values (:'empresa_b74_id'::uuid, 'Loja B74', 'B74-1');
reset role;
select id as loja_b74_id from public.markets where internal_code = 'B74-1' \gset

insert into public.member_markets (member_id, market_id)
select cm.id, :'loja_b74_id'::uuid from public.company_members cm where cm.user_id = 'fa740000-0000-0000-0000-00000000000b'::uuid;

------------------------------------------------------------
-- Caso 1: só o dono cria token de integração; gerente é bloqueado.
------------------------------------------------------------
select test.as_user('fa740000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.create_pdv_token('%s'::uuid, 'PDV da loja')$$, :'loja_b74_id'),
  'Gerente não pode criar token de integração do PDV');
reset role;

select test.as_user('fa740000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.create_pdv_token('%s'::uuid, '')$$, :'loja_b74_id'),
  'Criar token sem nome é bloqueado');

-- Cria o token UMA vez e extrai id/token na mesma consulta (chamar a
-- função de novo geraria um segundo token).
select r.id as token_id_b74, r.token as token_pdv_b74
from (select public.create_pdv_token(:'loja_b74_id'::uuid, 'PDV da loja') as created) s,
     jsonb_to_record(s.created) as r(id uuid, token text)
\gset
reset role;

select test.ok(:'token_pdv_b74' is not null and length(:'token_pdv_b74') > 20,
  'Token de integração é devolvido em texto puro só na criação');

------------------------------------------------------------
-- Caso 2: listar tokens nunca devolve o valor nem o hash — só metadados.
------------------------------------------------------------
select test.as_user('fa740000-0000-0000-0000-00000000000a');
select test.ok(exists(
  select 1 from public.list_pdv_tokens(:'loja_b74_id'::uuid) where label = 'PDV da loja' and revoked_at is null
), 'Token recém-criado aparece na listagem, ainda não revogado');
reset role;

------------------------------------------------------------
-- Caso 3: o PDV real usa o token (sem sessão autenticada — testado aqui
-- com `reset role`, que volta ao papel sem autenticação nenhuma) para
-- registrar uma venda; idempotente como sempre (RN-PDV-01).
------------------------------------------------------------
reset role;
select r.duplicate as venda_duplicada, r.event ->> 'received_by' as venda_received_by
from (select public.pdv_receive_sale_event(
  :'token_pdv_b74', 'CX-01', 'EXT-B74-001', 'venda', now(),
  '[{"external_product_code":"COD-1","quantity":2}]'::jsonb
) as created) s,
     jsonb_to_record(s.created) as r(duplicate boolean, event jsonb)
\gset
select test.ok(:'venda_received_by' = 'fa740000-0000-0000-0000-00000000000a',
  'Venda via token fica atribuída ao dono que criou o token (received_by)');
select test.ok(:'venda_duplicada' = 'f',
  'Primeira chamada não é duplicata');

reset role;
select r.duplicate as venda_duplicada_2
from (select public.pdv_receive_sale_event(
  :'token_pdv_b74', 'CX-01', 'EXT-B74-001', 'venda', now(),
  '[{"external_product_code":"COD-1","quantity":2}]'::jsonb
) as created) s,
     jsonb_to_record(s.created) as r(duplicate boolean)
\gset
select test.ok(:'venda_duplicada_2' = 't',
  'Reenviar o mesmo evento pelo token nunca cria uma segunda linha (idempotente)');

select test.ok((select count(*) from public.sale_events where market_id = :'loja_b74_id'::uuid and external_event_id = 'EXT-B74-001') = 1,
  'Só existe uma linha para o mesmo evento, mesmo enviado duas vezes');

------------------------------------------------------------
-- Caso 4: token inválido ou inexistente é recusado.
------------------------------------------------------------
reset role;
select test.throws($$select public.pdv_receive_sale_event('token-que-nao-existe', 'CX-01', 'EXT-B74-002', 'venda', now(), '[{"external_product_code":"COD-1","quantity":1}]'::jsonb)$$,
  'Token de integração inexistente é recusado');

------------------------------------------------------------
-- Caso 5: revogar o token — só o dono; token revogado passa a ser
-- recusado pelo conector, mas a linha nunca é apagada (RN-ACL-06).
------------------------------------------------------------
select test.as_user('fa740000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.revoke_pdv_token('%s'::uuid)$$, :'token_id_b74'),
  'Gerente não pode revogar token de integração do PDV');
reset role;

select test.as_user('fa740000-0000-0000-0000-00000000000a');
select public.revoke_pdv_token(:'token_id_b74'::uuid);
reset role;

select test.ok((select revoked_at from public.pdv_integration_tokens where id = :'token_id_b74'::uuid) is not null,
  'Token revogado fica marcado, não é apagado');

reset role;
select test.throws(format($$select public.pdv_receive_sale_event('%s', 'CX-01', 'EXT-B74-003', 'venda', now(), '[{"external_product_code":"COD-1","quantity":1}]'::jsonb)$$, :'token_pdv_b74'),
  'Token revogado é recusado pelo conector de PDV');

------------------------------------------------------------
-- Caso 6: receive_sale_event autenticado (dono/gerente, caminho de
-- sempre) continua funcionando normalmente depois da extração do núcleo
-- compartilhado (private.ingest_sale_event) — regressão.
------------------------------------------------------------
select test.as_user('fa740000-0000-0000-0000-00000000000a');
select r.duplicate as venda_manual_duplicada
from (select public.receive_sale_event(:'loja_b74_id'::uuid, 'CX-02', 'EXT-B74-MANUAL-001', 'venda', now(), '[{"external_product_code":"COD-2","quantity":1}]'::jsonb) as created) s,
     jsonb_to_record(s.created) as r(duplicate boolean)
\gset
reset role;
select test.ok(:'venda_manual_duplicada' = 'f',
  'Lançamento manual autenticado (dono/gerente) continua funcionando normalmente');
