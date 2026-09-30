-- Testes de assinatura e cálculo (B9.2) — mensalidade (base + mercados x
-- valor por mercado - desconto de cupom), proporcional ao adicionar
-- mercado e aceite obrigatório antes da ativação.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
 ('ff000000-0000-0000-0000-00000000001a','dono-b92@x.com','{"full_name":"Dono B92"}'),
 ('ff000000-0000-0000-0000-00000000001b','dono2-b92@x.com','{"full_name":"Dono2 B92"}'),
 ('ff000000-0000-0000-0000-0000000000ad','admin-b92@x.com','{"full_name":"Admin B92"}')
on conflict (id) do nothing;
insert into public.platform_admins values ('ff000000-0000-0000-0000-0000000000ad')
  on conflict do nothing;

------------------------------------------------------------
-- Caso 1: plano sem preço (padrão do B9.1) — nada para calcular ou aceitar;
-- mercado novo já nasce ativo direto (RF-ORG-08 não se aplica sem preço).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000001a');
select public.create_company('Rede B92 Sem Preço','Rede B92 SP','99001100015040', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false);
reset role;
select id as empresa_sem_preco_id from public.companies where cnpj = '99001100015040' \gset

select test.as_user('ff000000-0000-0000-0000-00000000001a');
select test.ok((public.calculate_subscription_amount(:'empresa_sem_preco_id'::uuid) ->> 'priced')::boolean = false,
  'Plano sem base_price nem price_per_market: assinatura marcada como "não precificada"');
select test.ok((public.calculate_subscription_amount(:'empresa_sem_preco_id'::uuid) ->> 'total') is null,
  'Sem preço definido, o total vem nulo (não é R$ 0,00 — é "a definir")');
select test.ok(public.calculate_market_addition_cost(:'empresa_sem_preco_id'::uuid) is null,
  'Sem price_per_market, não há proporcional a calcular');
reset role;

insert into public.markets (id, company_id, name, internal_code, status)
values ('ff100000-0000-0000-0000-000000000001', :'empresa_sem_preco_id'::uuid, 'Loja Sem Preço', 'UND-1', 'awaiting_billing');

select test.as_user('ff000000-0000-0000-0000-00000000001a');
select public.evaluate_market_billing('ff100000-0000-0000-0000-000000000001'::uuid);
reset role;
select test.ok((select status from public.markets where id = 'ff100000-0000-0000-0000-000000000001') = 'active',
  'Sem preço definido no plano, o mercado é ativado direto — nada para aceitar');
select test.ok((select pending_billing_amount from public.markets where id = 'ff100000-0000-0000-0000-000000000001') is null,
  'Sem valor pendente quando não há nada a cobrar');

------------------------------------------------------------
-- Caso 2: acesso — só o dono (ou administrador da plataforma) vê/calcula a
-- assinatura da empresa; outro dono é bloqueado.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-00000000001b');
select test.throws(format($$select public.calculate_subscription_amount('%s'::uuid)$$, :'empresa_sem_preco_id'),
  'Dono de outra empresa não vê a assinatura alheia');
select test.throws(format($$select public.calculate_market_addition_cost('%s'::uuid)$$, :'empresa_sem_preco_id'),
  'Dono de outra empresa não calcula proporcional alheio');
select test.throws(format($$select public.evaluate_market_billing('%s'::uuid)$$, 'ff100000-0000-0000-0000-000000000001'),
  'Dono de outra empresa não avalia cobrança de mercado alheio');
select test.throws(format($$select public.accept_market_billing('%s'::uuid)$$, 'ff100000-0000-0000-0000-000000000001'),
  'Dono de outra empresa não aceita cobrança de mercado alheio');
reset role;

------------------------------------------------------------
-- Caso 3: plano com preço — mensalidade soma base + mercados cobrados
-- (status active) x valor por mercado (RN-BILL-01).
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_plan('Rede B92', 'Plano com preço para os testes de assinatura', 0, false, 500, 200, null, array['dashboard']);
reset role;
select id as plano_rede_id from public.plans where name = 'Rede B92' \gset

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.create_company('Rede B92 Com Preço','Rede B92 CP','99001100023060', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false, :'plano_rede_id'::uuid);
reset role;
select id as empresa_com_preco_id from public.companies where cnpj = '99001100023060' \gset

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select (public.calculate_subscription_amount(:'empresa_com_preco_id'::uuid) ->> 'total')::numeric as total_zero_mercados \gset
select test.ok(:total_zero_mercados = 500, 'Sem mercado cobrado ainda, a mensalidade é só o valor base');
reset role;

------------------------------------------------------------
-- Caso 4: adicionar mercado exige aceite do valor calculado antes de virar
-- ativo (RN-BILL-09/RN-ORG-02/F-5.3).
------------------------------------------------------------
insert into public.markets (id, company_id, name, internal_code, status)
values ('ff100000-0000-0000-0000-000000000002', :'empresa_com_preco_id'::uuid, 'Loja Um', 'UND-1', 'awaiting_billing');

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.evaluate_market_billing('ff100000-0000-0000-0000-000000000002'::uuid);
reset role;
select test.ok((select status from public.markets where id = 'ff100000-0000-0000-0000-000000000002') = 'awaiting_billing',
  'Com price_per_market definido, o mercado fica aguardando aceite — não ativa sozinho');
select test.ok((select pending_billing_amount from public.markets where id = 'ff100000-0000-0000-0000-000000000002') is not null
           and (select pending_billing_amount from public.markets where id = 'ff100000-0000-0000-0000-000000000002') <= 200,
  'Valor pendente calculado (proporcional, no máximo o valor cheio do mercado)');

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.accept_market_billing('ff100000-0000-0000-0000-000000000002'::uuid);
reset role;
select test.ok((select status from public.markets where id = 'ff100000-0000-0000-0000-000000000002') = 'active',
  'Aceite explícito ativa o mercado');
select test.ok((select pending_billing_amount from public.markets where id = 'ff100000-0000-0000-0000-000000000002') is null,
  'Valor pendente é limpo depois do aceite (já virou histórico na auditoria da própria tabela)');

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select (public.calculate_subscription_amount(:'empresa_com_preco_id'::uuid) ->> 'total')::numeric as total_um_mercado \gset
select test.ok(:total_um_mercado = 700, 'Com um mercado cobrado, a mensalidade soma base + 1 x valor por mercado (500 + 200)');
reset role;

select test.throws($$select public.accept_market_billing('ff100000-0000-0000-0000-000000000002'::uuid)$$,
  'Mercado já ativo não pode ser aceito de novo') ;

------------------------------------------------------------
-- Caso 5: recusar o valor calculado (fluxo abandonado) inativa o mercado,
-- sem excluir fisicamente (RN-ACL-06).
------------------------------------------------------------
insert into public.markets (id, company_id, name, internal_code, status)
values ('ff100000-0000-0000-0000-000000000003', :'empresa_com_preco_id'::uuid, 'Loja Dois', 'UND-2', 'awaiting_billing');

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.evaluate_market_billing('ff100000-0000-0000-0000-000000000003'::uuid);
select public.decline_market_billing('ff100000-0000-0000-0000-000000000003'::uuid);
reset role;
select test.ok((select status from public.markets where id = 'ff100000-0000-0000-0000-000000000003') = 'inactive',
  'Recusar o aceite inativa o mercado (nunca some fisicamente)');

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select (public.calculate_subscription_amount(:'empresa_com_preco_id'::uuid) ->> 'total')::numeric as total_apos_recusa \gset
select test.ok(:total_apos_recusa = 700, 'Mercado recusado (inativo) nunca entra na conta de mercados cobrados');
reset role;

------------------------------------------------------------
-- Caso 6: cupom válido desconta da mensalidade (RN-BILL-01/RN-CRT-BIL-01) —
-- reaproveita o mesmo cupom de uma empresa nova, sem esgotar o de outro teste.
------------------------------------------------------------
select test.as_user('ff000000-0000-0000-0000-0000000000ad');
select public.create_coupon('DESC20B92', 'percentual', 20, now() - interval '1 day', now() + interval '30 days', null, 'Teste de desconto na mensalidade');
reset role;

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.create_company('Rede B92 Com Cupom','Rede B92 CC','99001100031089', null, null, null, null, null, null, null, null, null, null, null, null, false, null, false, :'plano_rede_id'::uuid, 'DESC20B92');
reset role;
select id as empresa_com_cupom_id from public.companies where cnpj = '99001100031089' \gset

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select (public.calculate_subscription_amount(:'empresa_com_cupom_id'::uuid) ->> 'discount')::numeric as desconto_aplicado \gset
select (public.calculate_subscription_amount(:'empresa_com_cupom_id'::uuid) ->> 'total')::numeric as total_com_cupom \gset
reset role;
select test.ok(:desconto_aplicado = 100, 'Cupom de 20% sobre a base de R$ 500 desconta R$ 100');
select test.ok(:total_com_cupom = 400, 'Mensalidade com cupom: 500 - 100 = 400');

------------------------------------------------------------
-- Caso 7: fórmula do proporcional bate com "valor por mercado x dias
-- restantes do ciclo / dias do ciclo" (RN-BILL-02/RN-CRT-BIL-02/PA-30),
-- qualquer que seja o dia em que o teste rodar.
------------------------------------------------------------
update public.companies set billing_cycle_anchor_day = 5 where id = :'empresa_com_preco_id';
select
  (case when make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5) <= current_date
        then make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5)
        else (make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5) - interval '1 month')::date end) as ciclo_inicio,
  (case when make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5) <= current_date
        then (make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5) + interval '1 month')::date
        else make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5) end) as ciclo_fim
\gset

select test.as_user('ff000000-0000-0000-0000-00000000001b');
select public.calculate_market_addition_cost(:'empresa_com_preco_id'::uuid) as custo_calculado \gset
reset role;
select test.ok(
  :custo_calculado = round(200::numeric * (:'ciclo_fim'::date - current_date) / (:'ciclo_fim'::date - :'ciclo_inicio'::date), 2),
  'Proporcional bate exatamente com a fórmula do documento: valor x dias restantes / dias do ciclo'
);
