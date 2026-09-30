-- B9.1 — Planos, teste gratuito e cupons no banco (RF-BILL-01/02/03/06,
-- RF-ADM-03/04, RN-ACC-05, RN-BILL-03/04/05/06, RN-CRT-BIL-03/04, E-06).
--
-- Escopo decidido com o proprietário (30/09/2026): planos e preços comerciais
-- ainda não estão fechados — construir a ESTRUTURA (cadastro de plano,
-- teste grátis configurável, cupons) sem fixar nenhum valor real agora
-- (PA-28: "validar comercialmente antes da integração do pagamento").
-- Cobrança de verdade (cálculo de assinatura/proporcional, B9.2) e gateway
-- de pagamento (B9.3) ficam para depois — mesmo padrão de "mecanismo
-- genérico agora, integração real quando houver decisão comercial" já usado
-- no leitor de código de barras (B5.4) e no PDV (B7).
--
-- PA-29 (valor base + valor por mercado): os dois campos existem no plano,
-- ambos opcionais — "não obrigar fórmula única".
-- PA-31 (teste exige cartão?): parâmetro por plano (`requires_payment_method_for_trial`).
-- PA-32/RN-BILL-04 (quantos testes por empresa): já garantido de graça pelo
-- `unique` em `companies.cnpj` desde a fundação — uma empresa (CNPJ) só
-- pode existir uma vez, então só pode começar um teste uma vez. A "exceção
-- manual auditada" é `admin_adjust_trial`, sempre com justificativa.
-- PA-33/RN-CRT-BIL-04 (cupom): percentual ou valor fixo, vigência, limite de
-- uso; elegibilidade fica como texto livre por enquanto (nenhuma regra de
-- segmento/plano específica foi pedida ainda).
-- RN-BILL-05 (cupom altera o quê): decisão — o cupom desconta sempre o TOTAL
-- calculado (nunca base/por-mercado separadamente), mais simples e correto
-- independente de quantos mercados a empresa tiver; o cálculo do total em
-- si é o B9.2, ainda não construído.
-- RN-BILL-06 (combinação de cupons): decisão — nunca cumulativo (aceita a
-- sugestão do PA-33 "não cumulativo por padrão"): uma empresa tem no máximo
-- um cupom vinculado por vez (`companies.coupon_id`, uma FK só).
-- RN-ACC-05/RN-BILL-03 (duração do teste configurável): `plans.trial_days`,
-- um número livre de dias — resolve também o E-06 (documento pedia opção de
-- 30 dias; como não é mais uma lista fixa de 7/15/20, qualquer duração é
-- só configurar o número).

create type public.coupon_discount_type as enum ('percentual', 'valor_fixo');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  -- PA-29: valor base e valor por mercado, os dois opcionais — sem preço
  -- comercial fechado ainda, o cadastro fica pronto para quando existir.
  base_price numeric(12, 2) check (base_price is null or base_price >= 0),
  price_per_market numeric(12, 2) check (price_per_market is null or price_per_market >= 0),
  max_markets integer check (max_markets is null or max_markets > 0),
  features text[] not null default '{}',
  -- RN-ACC-05/RN-BILL-03: dias de teste grátis, configurável por plano.
  trial_days integer not null default 15 check (trial_days >= 0),
  -- PA-31: por plano/campanha, não uma regra única do sistema.
  requires_payment_method_for_trial boolean not null default false,
  -- Plano aplicado quando ninguém escolhe nenhum (cadastro de empresa de hoje).
  is_default boolean not null default false,
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
comment on table public.plans is 'Catálogo de planos comerciais (B9.1) — estrutura pronta, preços reais ficam a critério do administrador da plataforma.';

create unique index plans_one_default_key on public.plans (is_default) where is_default;

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

-- Qualquer usuário autenticado vê os planos ativos (é o catálogo público de
-- assinatura); só o administrador da plataforma vê também os inativos.
create policy "plans_select" on public.plans for select to authenticated
  using (status = 'active' or private.is_platform_admin());

revoke insert, update, delete on public.plans from authenticated, anon;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(btrim(code)) between 3 and 40),
  discount_type public.coupon_discount_type not null,
  discount_value numeric(12, 2) not null check (discount_value > 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  times_used integer not null default 0 check (times_used >= 0),
  eligibility_note text check (eligibility_note is null or char_length(eligibility_note) <= 300),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  check (valid_until is null or valid_until > valid_from),
  check (discount_type <> 'percentual' or discount_value <= 100)
);
comment on table public.coupons is 'Cupons de desconto (B9.1) — percentual ou valor fixo, nunca cumulativo (RN-BILL-06): uma empresa tem no máximo um vinculado.';

create unique index coupons_code_key on public.coupons (lower(code));

alter table public.coupons enable row level security;

-- Cupom não é um catálogo público de navegação — só quem já tem o código
-- valida (função abaixo); só o administrador lista todos.
create policy "coupons_select" on public.coupons for select to authenticated
  using (private.is_platform_admin());

revoke insert, update, delete on public.coupons from authenticated, anon;

alter table public.companies
  add column plan_id uuid references public.plans (id),
  add column coupon_id uuid references public.coupons (id);
comment on column public.companies.plan_id is 'Plano contratado (B9.1). Nulo só para empresas criadas antes deste campo existir.';
comment on column public.companies.coupon_id is 'Cupom aplicado no cadastro (RN-BILL-06: no máximo um, nunca cumulativo).';

-- Semente: plano padrão preservando o comportamento já existente (15 dias
-- de teste, sem preço) — nenhuma empresa já cadastrada muda de
-- comportamento, e create_company (abaixo) sempre tem um plano para cair
-- quando ninguém escolhe nenhum.
insert into public.plans (name, description, trial_days, is_default, status)
values ('Padrão', 'Plano padrão — preços a definir comercialmente (PA-28).', 15, true, 'active');

-- create_company (fundação/B0.1) agora aceita plano e cupom opcionais.
-- `create or replace` não basta aqui porque a lista de parâmetros muda de
-- tamanho (viraria uma sobrecarga nova, ambígua com a antiga nas
-- referências por nome só, como o `revoke`/`grant` abaixo): precisa de
-- DROP explícito antes.
drop function public.create_company(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, boolean
);

create function public.create_company(
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

  insert into public.companies (
    legal_name, trade_name, cnpj, state_registration, phone, email, zip_code, street, number,
    complement, district, city, state, segment, product_range, has_pos, pos_name,
    account_status, subscription_status, trial_ends_at, created_by, plan_id, coupon_id
  ) values (
    trim(p_legal_name), trim(p_trade_name), regexp_replace(p_cnpj, '\D', '', 'g'), nullif(trim(p_state_registration), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g'), ''), p_street, p_number, p_complement, p_district, p_city,
    upper(nullif(trim(p_state), '')), p_segment, p_product_range, coalesce(p_has_pos, false), p_pos_name,
    'active',
    case when p_start_trial then 'trial'::public.subscription_status else 'active'::public.subscription_status end,
    case when p_start_trial then now() + make_interval(days => v_plan.trial_days) else null end,
    v_user, v_plan.id, v_coupon.id
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

revoke execute on function public.create_company from public, anon;
grant execute on function public.create_company to authenticated;

-- Administração de planos (RF-ADM-03) — só o administrador da plataforma.
create function public.create_plan(
  p_name text,
  p_description text default null,
  p_trial_days integer default 15,
  p_requires_payment_method_for_trial boolean default false,
  p_base_price numeric default null,
  p_price_per_market numeric default null,
  p_max_markets integer default null,
  p_features text[] default '{}'
)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.plans;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma cadastra planos';
  end if;

  insert into public.plans (
    name, description, trial_days, requires_payment_method_for_trial,
    base_price, price_per_market, max_markets, features, created_by
  ) values (
    btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_trial_days, 15),
    coalesce(p_requires_payment_method_for_trial, false), p_base_price, p_price_per_market,
    p_max_markets, coalesce(p_features, '{}'), v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_plan(text, text, integer, boolean, numeric, numeric, integer, text[]) from public, anon;
grant execute on function public.create_plan(text, text, integer, boolean, numeric, numeric, integer, text[]) to authenticated;

create function public.update_plan(
  p_id uuid,
  p_name text,
  p_description text default null,
  p_trial_days integer default 15,
  p_requires_payment_method_for_trial boolean default false,
  p_base_price numeric default null,
  p_price_per_market numeric default null,
  p_max_markets integer default null,
  p_features text[] default '{}'
)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.plans;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma edita planos';
  end if;

  update public.plans set
    name = btrim(p_name),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    trial_days = coalesce(p_trial_days, 15),
    requires_payment_method_for_trial = coalesce(p_requires_payment_method_for_trial, false),
    base_price = p_base_price,
    price_per_market = p_price_per_market,
    max_markets = p_max_markets,
    features = coalesce(p_features, '{}')
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Plano não encontrado';
  end if;

  return v_row;
end;
$$;
revoke all on function public.update_plan(uuid, text, text, integer, boolean, numeric, numeric, integer, text[]) from public, anon;
grant execute on function public.update_plan(uuid, text, text, integer, boolean, numeric, numeric, integer, text[]) to authenticated;

-- Troca o plano padrão de forma atômica (nunca dois planos padrão ao mesmo tempo).
create function public.set_default_plan(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma define o plano padrão';
  end if;
  if not exists (select 1 from public.plans where id = p_id and status = 'active') then
    raise exception 'Plano não encontrado ou inativo';
  end if;

  update public.plans set is_default = false where is_default;
  update public.plans set is_default = true where id = p_id;
end;
$$;
revoke all on function public.set_default_plan(uuid) from public, anon;
grant execute on function public.set_default_plan(uuid) to authenticated;

-- RN-ACL-06: sem exclusão física — só inativa (mesmo padrão de produtos/fornecedores).
create function public.inactivate_plan(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma inativa planos';
  end if;
  if (select is_default from public.plans where id = p_id) then
    raise exception 'Não é possível inativar o plano padrão — defina outro como padrão antes';
  end if;

  update public.plans set status = 'inactive' where id = p_id;
end;
$$;
revoke all on function public.inactivate_plan(uuid) from public, anon;
grant execute on function public.inactivate_plan(uuid) to authenticated;

-- Administração de cupons (RF-ADM-04).
create function public.create_coupon(
  p_code text,
  p_discount_type public.coupon_discount_type,
  p_discount_value numeric,
  p_valid_from timestamptz default now(),
  p_valid_until timestamptz default null,
  p_usage_limit integer default null,
  p_eligibility_note text default null
)
returns public.coupons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.coupons;
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma cadastra cupons';
  end if;

  insert into public.coupons (
    code, discount_type, discount_value, valid_from, valid_until, usage_limit, eligibility_note, created_by
  ) values (
    upper(btrim(p_code)), p_discount_type, p_discount_value, coalesce(p_valid_from, now()), p_valid_until,
    p_usage_limit, nullif(btrim(coalesce(p_eligibility_note, '')), ''), v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_coupon(text, public.coupon_discount_type, numeric, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.create_coupon(text, public.coupon_discount_type, numeric, timestamptz, timestamptz, integer, text) to authenticated;

create function public.deactivate_coupon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma desativa cupons';
  end if;

  update public.coupons set status = 'inactive' where id = p_id;
end;
$$;
revoke all on function public.deactivate_coupon(uuid) from public, anon;
grant execute on function public.deactivate_coupon(uuid) to authenticated;

create function public.list_coupons()
returns setof public.coupons
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma vê os cupons';
  end if;

  return query select * from public.coupons order by created_at desc;
end;
$$;
revoke all on function public.list_coupons() from public, anon;
grant execute on function public.list_coupons() to authenticated;

-- PA-32/RN-BILL-04: "um teste por CNPJ" já vem de graça do unique em
-- companies.cnpj — isto aqui é só a exceção manual, sempre com justificativa
-- (mesmo padrão de auditoria de sempre).
create function public.admin_adjust_trial(p_company_id uuid, p_new_trial_ends_at timestamptz, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Somente o administrador da plataforma ajusta teste grátis manualmente';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo do ajuste manual';
  end if;

  update public.companies set trial_ends_at = p_new_trial_ends_at where id = p_company_id;

  -- Insere direto (em vez de log_audit_event): o administrador que ajusta o
  -- teste de outra empresa não é membro dela, e log_audit_event exige
  -- vínculo com a empresa informada — aqui a autoridade já foi checada
  -- acima (is_platform_admin), mesma ideia de log_security_event.
  insert into public.audit_log (actor_id, actor_role, company_id, action, entity, entity_id, after, context)
  values (
    (select auth.uid()), 'platform_admin', p_company_id, 'event', 'trial_adjusted_manually', p_company_id::text,
    jsonb_build_object('new_trial_ends_at', p_new_trial_ends_at, 'reason', p_reason),
    private.request_context()
  );
end;
$$;
revoke all on function public.admin_adjust_trial(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_adjust_trial(uuid, timestamptz, text) to authenticated;

-- Auditoria genérica (B0.2) — mais dois `elsif` para as tabelas novas
-- (nenhuma tem empresa/mercado dona: são catálogo da própria plataforma).
create or replace function private.audit_scope(entity text, row_data jsonb)
returns table (company_id uuid, market_id uuid)
language plpgsql
stable
set search_path = ''
as $$
begin
  if entity = 'companies' then
    return query select (row_data ->> 'id')::uuid, null::uuid;
  elsif entity = 'markets' then
    return query select (row_data ->> 'company_id')::uuid, (row_data ->> 'id')::uuid;
  elsif entity = 'company_members' then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity = 'member_markets' then
    return query
      select cm.company_id, (row_data ->> 'market_id')::uuid
      from public.company_members cm
      where cm.id = (row_data ->> 'member_id')::uuid;
  elsif entity = 'profiles' then
    return query
      select cm.company_id, null::uuid
      from public.company_members cm
      where cm.user_id = (row_data ->> 'id')::uuid
      order by cm.created_at
      limit 1;
  elsif entity = 'invites' then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity in ('suppliers', 'categories', 'brands', 'products') then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  elsif entity = 'product_packagings' then
    return query
      select p.company_id, null::uuid
      from public.products p
      where p.id = (row_data ->> 'product_id')::uuid;
  elsif entity = 'market_products' then
    return query
      select p.company_id, (row_data ->> 'market_id')::uuid
      from public.products p
      where p.id = (row_data ->> 'product_id')::uuid;
  elsif entity in ('warehouse_addresses', 'gondola_positions') then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'stock_movements' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'lots' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'pending_stock_adjustments' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'inventory_counts' then
    return query
      select m.company_id, m.id
      from public.warehouse_addresses wa
      join public.markets m on m.id = wa.market_id
      where wa.id = (row_data ->> 'warehouse_address_id')::uuid;
  elsif entity = 'inventory_count_items' then
    return query
      select m.company_id, m.id
      from public.inventory_counts ic
      join public.warehouse_addresses wa on wa.id = ic.warehouse_address_id
      join public.markets m on m.id = wa.market_id
      where ic.id = (row_data ->> 'inventory_count_id')::uuid;
  elsif entity = 'receivings' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity in ('receiving_items', 'receiving_counted_items', 'receiving_recount_requests') then
    return query
      select m.company_id, m.id
      from public.receivings r
      join public.markets m on m.id = r.market_id
      where r.id = (row_data ->> 'receiving_id')::uuid;
  elsif entity = 'replenishment_tasks' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'replenishment_task_counts' then
    return query
      select m.company_id, m.id
      from public.replenishment_tasks rt
      join public.markets m on m.id = rt.market_id
      where rt.id = (row_data ->> 'task_id')::uuid;
  elsif entity = 'offline_sync_conflicts' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'incidents' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'alerts' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'sale_events' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity = 'sale_event_items' then
    return query
      select m.company_id, m.id
      from public.sale_events se
      join public.markets m on m.id = se.market_id
      where se.id = (row_data ->> 'sale_event_id')::uuid;
  elsif entity = 'pdv_product_mappings' then
    return query
      select m.company_id, m.id
      from public.markets m
      where m.id = (row_data ->> 'market_id')::uuid;
  elsif entity in ('plans', 'coupons') then
    return query select null::uuid, null::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger plans_audit
  after insert or update on public.plans
  for each row execute function private.audit_trigger();

create trigger coupons_audit
  after insert or update on public.coupons
  for each row execute function private.audit_trigger();
