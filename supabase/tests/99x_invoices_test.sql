-- Testes do gateway de pagamento (B9.3) — fatura por ciclo
-- (create_invoice/list_invoices) e o efeito automático do pagamento
-- (register_invoice_payment, só chamável pelo service_role — a Edge
-- Function do webhook do Mercado Pago, nunca o usuário final).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('f9300000-0000-0000-0000-00000000000a','dono-b93@x.com','{"full_name":"Dono B93"}'),
 ('f9300000-0000-0000-0000-00000000000b','gerente-b93@x.com','{"full_name":"Gerente B93"}'),
 ('f9300000-0000-0000-0000-00000000000c','dono-outra-b93@x.com','{"full_name":"Dono Outra B93"}'),
 ('f9300000-0000-0000-0000-00000000000d','admin-b93@x.com','{"full_name":"Admin B93"}');

select test.as_user('f9300000-0000-0000-0000-00000000000a');
select public.create_company('Rede B93 Ltda','Rede B93','00011022033160', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false);

reset role;
insert into public.company_members (company_id, user_id, role)
select c.id, u.id::uuid, u.role::public.member_role from public.companies c,
 (values ('f9300000-0000-0000-0000-00000000000b','manager')) u(id, role)
where c.cnpj = '00011022033160';

select test.as_user('f9300000-0000-0000-0000-00000000000c');
select public.create_company('Rede Outra B93 Ltda','Outra B93','00011022033241');
reset role;

insert into public.platform_admins values ('f9300000-0000-0000-0000-00000000000d');
select id as rede_id from public.companies where cnpj = '00011022033160' \gset

select test.as_user('f9300000-0000-0000-0000-00000000000a');
insert into public.markets (company_id, name, internal_code, status) values (:'rede_id'::uuid, 'Loja B93', 'B93-CTR-1', 'active');
reset role;

------------------------------------------------------------
-- Caso 1: sem preço travado no plano, não gera fatura.
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.create_invoice('%s'::uuid)$$, :'rede_id'),
  'Sem preço definido no plano, não é possível gerar fatura');
reset role;

-- Trava um preço comercial na empresa (como o B9.4 faz via admin_update_company_plan).
update public.companies set locked_base_price = 100, locked_price_per_market = 20 where id = :'rede_id'::uuid;

------------------------------------------------------------
-- Caso 2: dono gera a fatura do ciclo; gerente e dono de outra empresa não podem.
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000b');
select test.throws(format($$select public.create_invoice('%s'::uuid)$$, :'rede_id'),
  'Gerente não gera fatura — só dono ou administrador');

select test.as_user('f9300000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.create_invoice('%s'::uuid)$$, :'rede_id'),
  'Dono de outra empresa não gera fatura alheia');

select test.as_user('f9300000-0000-0000-0000-00000000000a');
select public.create_invoice(:'rede_id'::uuid);
reset role;
select id as fatura_id, amount as valor_fatura from public.invoices where company_id = :'rede_id'::uuid \gset
select test.ok(:'valor_fatura' = '120.00', 'Fatura criada com o valor certo (100 base + 1 mercado x 20)');
select test.ok((select status from public.invoices where id = :'fatura_id'::uuid) = 'pendente',
  'Fatura nasce pendente');

------------------------------------------------------------
-- Caso 3: não duplica fatura pendente.
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.create_invoice('%s'::uuid)$$, :'rede_id'),
  'Já existe fatura pendente — não gera outra');
reset role;

------------------------------------------------------------
-- Caso 4: register_invoice_payment só pelo service_role.
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000a');
select test.throws(format($$select public.register_invoice_payment('%s'::uuid, 'pago', 'mp-pay-1')$$, :'fatura_id'),
  'Dono não pode registrar pagamento diretamente — só o webhook do gateway (service_role)');
reset role;

set role service_role;
select public.register_invoice_payment(:'fatura_id'::uuid, 'pago', 'mp-pay-1', 'pix');
reset role;
select test.ok((select status from public.invoices where id = :'fatura_id'::uuid) = 'pago',
  'Pagamento aprovado marca a fatura como paga');
select test.ok((select paid_at from public.invoices where id = :'fatura_id'::uuid) is not null,
  'paid_at é gravado no pagamento aprovado');
select test.ok((select payment_method from public.invoices where id = :'fatura_id'::uuid) = 'pix',
  'Forma de pagamento gravada');

set role service_role;
select test.throws(format($$select public.register_invoice_payment('%s'::uuid, 'pago', 'mp-pay-2')$$, :'fatura_id'),
  'Fatura já processada não é processada de novo');
reset role;

------------------------------------------------------------
-- Caso 5: pagamento recusado marca atraso automaticamente (sem admin manual).
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000a');
select public.create_invoice(:'rede_id'::uuid);
reset role;
select id as fatura2_id from public.invoices where company_id = :'rede_id'::uuid and status = 'pendente' \gset

set role service_role;
select public.register_invoice_payment(:'fatura2_id'::uuid, 'falhou', 'mp-pay-3');
reset role;
select test.ok((select subscription_status from public.companies where id = :'rede_id'::uuid) = 'past_due',
  'Pagamento recusado marca a assinatura em atraso automaticamente');
select test.ok((select past_due_since from public.companies where id = :'rede_id'::uuid) is not null,
  'past_due_since é gravado no atraso automático');

------------------------------------------------------------
-- Caso 6: pagamento aprovado reativa sozinho uma assinatura em atraso.
------------------------------------------------------------
update public.invoices set status = 'pendente' where id = :'fatura2_id'::uuid;
set role service_role;
select public.register_invoice_payment(:'fatura2_id'::uuid, 'pago', 'mp-pay-4', 'cartao');
reset role;
select test.ok((select subscription_status from public.companies where id = :'rede_id'::uuid) = 'active',
  'Pagamento aprovado reativa a assinatura em atraso automaticamente');
select test.ok((select past_due_since from public.companies where id = :'rede_id'::uuid) is null,
  'past_due_since volta a nulo na reativação automática');

------------------------------------------------------------
-- Caso 7: acesso de leitura — dono e admin da plataforma veem; outro dono e gerente, não.
------------------------------------------------------------
select test.as_user('f9300000-0000-0000-0000-00000000000a');
select test.ok((select count(*) from public.list_invoices(:'rede_id'::uuid)) = 2,
  'Dono lista as duas faturas da própria empresa');

select test.as_user('f9300000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from public.list_invoices(:'rede_id'::uuid)) = 2,
  'Administrador da plataforma também lista as faturas de qualquer empresa');

select test.as_user('f9300000-0000-0000-0000-00000000000c');
select test.throws(format($$select public.list_invoices('%s'::uuid)$$, :'rede_id'),
  'Dono de outra empresa não lista faturas alheias');
reset role;
