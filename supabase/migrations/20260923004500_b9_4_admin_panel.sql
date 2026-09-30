-- B9.4 — Painel administrativo real (RF-ADM-01/02/06/07, RN-ADM-01/03/04,
-- IND-ADM-01..09). Decisão do usuário: preço trava na contratação —
-- editar o preço de um plano não muda o valor de quem já contratou; migrar
-- um cliente para o preço novo é uma ação manual e auditada do
-- administrador (RN-ADM-03/04).
\set ON_ERROR_STOP 1

alter table public.companies
  add column locked_base_price numeric(12,2),
  add column locked_price_per_market numeric(12,2);
comment on column public.companies.locked_base_price is 'Preço base travado na contratação (RN-ADM-03) — editar plans.base_price não muda isto. Só admin_update_company_plan reatualiza.';
comment on column public.companies.locked_price_per_market is 'Preço por mercado travado na contratação (RN-ADM-03) — mesma regra de locked_base_price.';

-- create_company (B0.1/B9.1/B9.2) passa a travar o preço do plano escolhido
-- no momento da contratação. Mesma assinatura — `create or replace` basta.
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
    billing_cycle_anchor_day, locked_base_price, locked_price_per_market
  ) values (
    trim(p_legal_name), trim(p_trade_name), regexp_replace(p_cnpj, '\D', '', 'g'), nullif(trim(p_state_registration), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g'), ''), p_street, p_number, p_complement, p_district, p_city,
    upper(nullif(trim(p_state), '')), p_segment, p_product_range, coalesce(p_has_pos, false), p_pos_name,
    'active',
    case when p_start_trial then 'trial'::public.subscription_status else 'active'::public.subscription_status end,
    v_trial_ends,
    v_user, v_plan.id, v_coupon.id,
    least(greatest(extract(day from coalesce(v_trial_ends, now()))::int, 1), 28),
    v_plan.base_price, v_plan.price_per_market
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

-- calculate_subscription_amount (B9.2) passa a usar o preço travado da
-- empresa (locked_base_price/locked_price_per_market), não mais o preço ao
-- vivo do plano — RN-ADM-03.
create or replace function public.calculate_subscription_amount(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
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

  select * into v_company from public.companies where id = p_company_id;
  select p.* into v_plan from public.plans p where p.id = v_company.plan_id;
  if v_company.id is null or v_plan.id is null then
    raise exception 'Empresa sem plano associado';
  end if;

  select count(*) into v_billed_markets from public.markets where company_id = p_company_id and status = 'active';

  v_priced := (v_company.locked_base_price is not null or v_company.locked_price_per_market is not null);
  v_subtotal := coalesce(v_company.locked_base_price, 0) + v_billed_markets * coalesce(v_company.locked_price_per_market, 0);

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
    'basePrice', v_company.locked_base_price,
    'pricePerMarket', v_company.locked_price_per_market,
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

-- calculate_market_addition_cost (B9.2) idem: preço travado da empresa.
create or replace function public.calculate_market_addition_cost(p_company_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_cycle record;
  v_days_total integer;
  v_days_remaining integer;
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso à assinatura desta empresa';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if v_company.id is null or v_company.locked_price_per_market is null then
    return null;
  end if;

  select * into v_cycle from private.company_billing_cycle(p_company_id);
  v_days_total := v_cycle.cycle_end - v_cycle.cycle_start;
  v_days_remaining := v_cycle.cycle_end - current_date;

  return round(v_company.locked_price_per_market * v_days_remaining / v_days_total, 2);
end;
$$;

-- RF-ADM-02/RF-ADM-06/RN-ADM-04: única forma de um cliente já contratado
-- ganhar o preço novo de um plano (ou migrar de plano) — ação manual do
-- administrador, sempre com motivo. A trilha antes/depois já sai de graça
-- do gatilho genérico de `companies` (B0.2); só precisamos anexar o motivo
-- via app.justification (mesmo mecanismo usado desde o B3.1).
create function public.admin_update_company_plan(p_company_id uuid, p_plan_id uuid, p_reason text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_row public.companies;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma altera o plano de uma empresa';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da alteração de plano';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and status = 'active';
  if v_plan.id is null then
    raise exception 'Plano não encontrado ou inativo';
  end if;

  perform set_config('app.justification', p_reason, true);

  update public.companies
  set plan_id = v_plan.id, locked_base_price = v_plan.base_price, locked_price_per_market = v_plan.price_per_market
  where id = p_company_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Empresa não encontrada';
  end if;

  return v_row;
end;
$$;
revoke all on function public.admin_update_company_plan(uuid, uuid, text) from public, anon;
grant execute on function public.admin_update_company_plan(uuid, uuid, text) to authenticated;

-- RF-ADM-07: auditoria de uma empresa vista pelo administrador. A política
-- de leitura de audit_log (B0.2) só deixa o dono ver a própria empresa —
-- esta função existe só para o caso do administrador precisar investigar.
create function public.admin_list_company_audit(p_company_id uuid, p_limit integer default 50)
returns setof public.audit_log
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma consulta a auditoria de outra empresa';
  end if;

  return query
    select * from public.audit_log
    where company_id = p_company_id
    order by occurred_at desc
    limit greatest(coalesce(p_limit, 50), 1);
end;
$$;
revoke all on function public.admin_list_company_audit(uuid, integer) from public, anon;
grant execute on function public.admin_list_company_audit(uuid, integer) to authenticated;

-- IND-ADM-01..09: indicadores da plataforma (seção 6.2) — substitui os
-- números fictícios da "Visão geral" do admin. "Previsão de receita" não
-- inventa uma taxa de crescimento: é a MRR atual, assumindo base estável
-- (não existe modelo de previsão definido em nenhuma decisão registrada).
create function public.get_platform_indicators()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_companies_count integer;
  v_active_markets integer;
  v_active_subscriptions integer;
  v_trial_subscriptions integer;
  v_cancelled integer;
  v_past_due integer;
  v_suspended integer;
  v_trial_conversion_pct numeric;
  v_mrr numeric(14,2);
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma vê os indicadores da plataforma';
  end if;

  select count(*) into v_companies_count from public.companies;
  select count(*) into v_active_markets from public.markets where status = 'active';
  select count(*) into v_active_subscriptions from public.companies where subscription_status = 'active';
  select count(*) into v_trial_subscriptions from public.companies where subscription_status = 'trial';
  select count(*) into v_cancelled from public.companies where subscription_status = 'cancelled';
  select count(*) into v_past_due from public.companies where subscription_status = 'past_due';
  select count(*) into v_suspended from public.companies where subscription_status = 'suspended';

  select case when count(*) filter (where trial_ends_at is not null and trial_ends_at < now()) = 0 then null
    else round(100.0 * count(*) filter (where trial_ends_at is not null and trial_ends_at < now() and subscription_status = 'active')
               / count(*) filter (where trial_ends_at is not null and trial_ends_at < now()), 1)
    end
  into v_trial_conversion_pct
  from public.companies;

  with billed as (
    select c.id as company_id, count(m.id) as billed_markets
    from public.companies c
    left join public.markets m on m.company_id = c.id and m.status = 'active'
    group by c.id
  )
  select coalesce(sum(greatest(
    coalesce(c.locked_base_price, 0) + b.billed_markets * coalesce(c.locked_price_per_market, 0)
    - case
        when co.id is not null and co.status = 'active'
          and now() >= co.valid_from and (co.valid_until is null or now() <= co.valid_until)
        then case
          when co.discount_type = 'percentual' then round((coalesce(c.locked_base_price, 0) + b.billed_markets * coalesce(c.locked_price_per_market, 0)) * co.discount_value / 100, 2)
          else least(co.discount_value, coalesce(c.locked_base_price, 0) + b.billed_markets * coalesce(c.locked_price_per_market, 0))
        end
        else 0
      end,
    0)), 0)
  into v_mrr
  from public.companies c
  join billed b on b.company_id = c.id
  left join public.coupons co on co.id = c.coupon_id
  where c.subscription_status = 'active'
    and (c.locked_base_price is not null or c.locked_price_per_market is not null);

  return jsonb_build_object(
    'companiesCount', v_companies_count,
    'activeMarkets', v_active_markets,
    'activeSubscriptions', v_active_subscriptions,
    'trialSubscriptions', v_trial_subscriptions,
    'cancelledSubscriptions', v_cancelled,
    'pastDueSubscriptions', v_past_due,
    'suspendedSubscriptions', v_suspended,
    'trialConversionPct', v_trial_conversion_pct,
    'mrr', v_mrr,
    'revenueForecast', v_mrr
  );
end;
$$;
revoke all on function public.get_platform_indicators() from public, anon;
grant execute on function public.get_platform_indicators() to authenticated;
