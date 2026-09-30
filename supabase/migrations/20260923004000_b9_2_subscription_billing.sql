-- B9.2 — Assinatura, cálculo e proporcional (RF-ORG-08, RF-BILL-04/10,
-- RN-BILL-01/02/09, RN-CRT-BIL-01/02, PA-30, F-5.3). Ainda sem gateway
-- (B9.3): tudo aqui é cálculo e aceite — nenhum valor é debitado de
-- verdade. O ciclo de cobrança é ancorado num dia do mês (1-28, nunca
-- 29-31, para nunca cair num mês sem esse dia): o dia em que o teste
-- termina (ou o dia da criação, sem teste).
\set ON_ERROR_STOP 1

alter table public.companies
  add column billing_cycle_anchor_day smallint not null default extract(day from now())::smallint
    check (billing_cycle_anchor_day between 1 and 28);
comment on column public.companies.billing_cycle_anchor_day is 'Dia do mês (1-28) que ancora o ciclo mensal de cobrança (RN-BILL-02/PA-30).';

alter table public.markets
  add column pending_billing_amount numeric(12,2);
comment on column public.markets.pending_billing_amount is 'Valor proporcional calculado, aguardando aceite do dono (RN-BILL-09/RN-ORG-02). Só existe com status = awaiting_billing.';

-- create_company (B0.1/B9.1) passa a fixar o dia-âncora do ciclo. Mesma
-- assinatura de antes — `create or replace` basta, nenhum parâmetro mudou.
create or replace function public.create_company(
  p_legal_name text,
  p_trade_name text,
  p_cnpj text,
  p_state_registration text default null,
  p_phone text default null,
  p_email text default null,
  p_zip_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_segment text default null,
  p_product_range text default null,
  p_has_pos boolean default false,
  p_pos_name text default null,
  p_start_trial boolean default true,
  p_plan_id uuid default null,
  p_coupon_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company uuid;
  v_plan public.plans;
  v_coupon public.coupons;
  v_trial_ends timestamptz;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para criar uma empresa';
  end if;

  select * into v_plan from public.plans where id = coalesce(p_plan_id, (select id from public.plans where is_default limit 1));
  if v_plan.id is null then
    raise exception 'Plano não encontrado';
  end if;
  if v_plan.status <> 'active' and p_plan_id is not null then
    raise exception 'Este plano não está mais disponível';
  end if;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon from public.coupons where lower(code) = lower(btrim(p_coupon_code));
    if v_coupon.id is null or v_coupon.status <> 'active' then
      raise exception 'Cupom inválido';
    end if;
    if now() < v_coupon.valid_from or (v_coupon.valid_until is not null and now() > v_coupon.valid_until) then
      raise exception 'Cupom fora da validade';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.times_used >= v_coupon.usage_limit then
      raise exception 'Cupom esgotou o limite de uso';
    end if;
  end if;

  v_trial_ends := case when p_start_trial then now() + make_interval(days => v_plan.trial_days) else null end;

  insert into public.companies (
    legal_name, trade_name, cnpj, state_registration, phone, email, zip_code, street, number,
    complement, district, city, state, segment, product_range, has_pos, pos_name,
    account_status, subscription_status, trial_ends_at, created_by, plan_id, coupon_id,
    billing_cycle_anchor_day
  ) values (
    trim(p_legal_name), trim(p_trade_name), regexp_replace(p_cnpj, '\D', '', 'g'), nullif(trim(p_state_registration), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g'), ''), p_street, p_number, p_complement, p_district, p_city,
    upper(nullif(trim(p_state), '')), p_segment, p_product_range, coalesce(p_has_pos, false), p_pos_name,
    'active',
    case when p_start_trial then 'trial'::public.subscription_status else 'active'::public.subscription_status end,
    v_trial_ends,
    v_user, v_plan.id, v_coupon.id,
    least(greatest(extract(day from coalesce(v_trial_ends, now()))::int, 1), 28)
  )
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company, v_user, 'owner', 'active');

  if v_coupon.id is not null then
    update public.coupons set times_used = times_used + 1 where id = v_coupon.id;
  end if;

  return v_company;
end;
$$;

-- Ciclo mensal atual da empresa a partir do dia-âncora. Dia sempre 1-28, então
-- soma/subtração de 1 mês nunca estoura para outro mês (sem o efeito
-- "31 de janeiro + 1 mês = 3 de março" do Postgres).
create function private.company_billing_cycle(p_company_id uuid)
returns table (cycle_start date, cycle_end date)
language sql
stable
set search_path = ''
as $$
  with anchor as (
    select billing_cycle_anchor_day as d from public.companies where id = p_company_id
  ), candidate as (
    select make_date(extract(year from current_date)::int, extract(month from current_date)::int, d) as start_this_month
    from anchor
  )
  select
    (case when start_this_month <= current_date then start_this_month else start_this_month - interval '1 month' end)::date,
    (case when start_this_month <= current_date then start_this_month + interval '1 month' else start_this_month end)::date
  from candidate;
$$;
revoke all on function private.company_billing_cycle(uuid) from public, anon;
grant execute on function private.company_billing_cycle(uuid) to authenticated;

-- RF-BILL-10: o que o dono vê sobre a própria assinatura. RN-BILL-01: valor
-- base + mercados cobrados (status = active) x valor por mercado, menos
-- desconto de cupom válido. `priced = false` quando o plano ainda não tem
-- nenhum preço comercial definido (PA-28) — o front mostra "a definir" em
-- vez de R$ 0,00.
create function public.calculate_subscription_amount(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_coupon public.coupons;
  v_billed_markets integer;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_priced boolean;
  v_cycle record;
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso à assinatura desta empresa';
  end if;

  select p.* into v_plan from public.plans p join public.companies c on c.plan_id = p.id where c.id = p_company_id;
  if v_plan.id is null then
    raise exception 'Empresa sem plano associado';
  end if;

  select count(*) into v_billed_markets from public.markets where company_id = p_company_id and status = 'active';

  v_priced := (v_plan.base_price is not null or v_plan.price_per_market is not null);
  v_subtotal := coalesce(v_plan.base_price, 0) + v_billed_markets * coalesce(v_plan.price_per_market, 0);

  select c.* into v_coupon from public.companies co join public.coupons c on c.id = co.coupon_id where co.id = p_company_id;
  if v_coupon.id is not null and v_coupon.status = 'active'
     and now() >= v_coupon.valid_from and (v_coupon.valid_until is null or now() <= v_coupon.valid_until) then
    v_discount := case
      when v_coupon.discount_type = 'percentual' then round(v_subtotal * v_coupon.discount_value / 100, 2)
      else least(v_coupon.discount_value, v_subtotal)
    end;
  end if;

  select * into v_cycle from private.company_billing_cycle(p_company_id);

  return jsonb_build_object(
    'planName', v_plan.name,
    'priced', v_priced,
    'basePrice', v_plan.base_price,
    'pricePerMarket', v_plan.price_per_market,
    'billedMarkets', v_billed_markets,
    'subtotal', case when v_priced then v_subtotal else null end,
    'discount', case when v_priced then v_discount else null end,
    'total', case when v_priced then greatest(v_subtotal - v_discount, 0) else null end,
    'couponCode', v_coupon.code,
    'cycleStart', v_cycle.cycle_start,
    'cycleEnd', v_cycle.cycle_end
  );
end;
$$;
revoke all on function public.calculate_subscription_amount(uuid) from public, anon;
grant execute on function public.calculate_subscription_amount(uuid) to authenticated;

-- RF-BILL-04/RN-BILL-02/RN-CRT-BIL-02/PA-30: proporcional = valor por
-- mercado x dias restantes do ciclo atual / dias do ciclo. Null quando o
-- plano não tem valor por mercado definido (nada a calcular ainda).
create function public.calculate_market_addition_cost(p_company_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_cycle record;
  v_days_total integer;
  v_days_remaining integer;
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso à assinatura desta empresa';
  end if;

  select p.* into v_plan from public.plans p join public.companies c on c.plan_id = p.id where c.id = p_company_id;
  if v_plan.id is null or v_plan.price_per_market is null then
    return null;
  end if;

  select * into v_cycle from private.company_billing_cycle(p_company_id);
  v_days_total := v_cycle.cycle_end - v_cycle.cycle_start;
  v_days_remaining := v_cycle.cycle_end - current_date;

  return round(v_plan.price_per_market * v_days_remaining / v_days_total, 2);
end;
$$;
revoke all on function public.calculate_market_addition_cost(uuid) from public, anon;
grant execute on function public.calculate_market_addition_cost(uuid) to authenticated;

-- F-5.3/RN-ORG-02/RN-BILL-09: mercado nasce "awaiting_billing" (RF-ORG-08).
-- Sem preço por mercado no plano, nada para aceitar — ativa direto. Com
-- preço, guarda o valor calculado para o dono confirmar (accept_market_billing).
create function public.evaluate_market_billing(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market public.markets;
  v_cost numeric(12,2);
begin
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.has_company_role(v_market.company_id, array['owner']::public.member_role[]) then
    raise exception 'Sem permissão para gerenciar este mercado';
  end if;
  if v_market.status <> 'awaiting_billing' then
    return v_market;
  end if;

  v_cost := public.calculate_market_addition_cost(v_market.company_id);

  if v_cost is null then
    update public.markets set status = 'active', pending_billing_amount = null where id = p_market_id returning * into v_market;
  else
    update public.markets set pending_billing_amount = v_cost where id = p_market_id returning * into v_market;
  end if;

  return v_market;
end;
$$;
revoke all on function public.evaluate_market_billing(uuid) from public, anon;
grant execute on function public.evaluate_market_billing(uuid) to authenticated;

-- RN-BILL-09: aceite explícito do valor calculado antes da ativação. A
-- transição (awaiting_billing → active) já fica no audit_log genérico da
-- tabela markets (before/after, incluindo o valor aceito), sem precisar de
-- um registro manual aqui (RF-BILL-08/AUD-08).
create function public.accept_market_billing(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market public.markets;
begin
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.has_company_role(v_market.company_id, array['owner']::public.member_role[]) then
    raise exception 'Sem permissão para gerenciar este mercado';
  end if;
  if v_market.status <> 'awaiting_billing' or v_market.pending_billing_amount is null then
    raise exception 'Este mercado não está aguardando aceite de cobrança';
  end if;

  update public.markets set status = 'active', pending_billing_amount = null where id = p_market_id returning * into v_market;
  return v_market;
end;
$$;
revoke all on function public.accept_market_billing(uuid) from public, anon;
grant execute on function public.accept_market_billing(uuid) to authenticated;

-- Recusa do valor calculado (ex.: fluxo abandonado antes do aceite) — some
-- da lista como "inativo" (RN-ACL-06: nunca exclusão física).
create function public.decline_market_billing(p_market_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market public.markets;
begin
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.has_company_role(v_market.company_id, array['owner']::public.member_role[]) then
    raise exception 'Sem permissão para gerenciar este mercado';
  end if;
  if v_market.status <> 'awaiting_billing' then
    raise exception 'Este mercado não está aguardando aceite de cobrança';
  end if;

  update public.markets set status = 'inactive', pending_billing_amount = null where id = p_market_id;
end;
$$;
revoke all on function public.decline_market_billing(uuid) from public, anon;
grant execute on function public.decline_market_billing(uuid) to authenticated;
