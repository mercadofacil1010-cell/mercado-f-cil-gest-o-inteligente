-- B9.3 — Gateway de pagamento (RF-BILL-05, PA-27, INT-PAY). Decisão do
-- usuário em DECISOES.md: Mercado Pago, via Checkout Pro (hospedado, cobre
-- Pix/boleto/cartão num único fluxo em vez de três integrações separadas).
--
-- Sem credencial de sandbox ainda: a estrutura inteira (fatura, criação de
-- cobrança, webhook, efeito automático em atraso/reativação) é construída
-- agora; falta só configurar o segredo MERCADOPAGO_ACCESS_TOKEN nas Edge
-- Functions (supabase/functions/mercadopago-*) para funcionar de ponta a
-- ponta — até lá, a função de criar cobrança retorna um erro claro em vez
-- de travar silenciosamente.
--
-- `register_invoice_payment` só é chamável pelo service_role (a Edge
-- Function do webhook usa a service role key, nunca o usuário final) —
-- é o único jeito de uma fatura virar paga/falha, e é isso que agora torna
-- automático o que o B9.5 fazia manualmente (admin_mark_past_due /
-- admin_reactivate_subscription): pagamento aprovado reativa sozinho uma
-- assinatura em atraso/suspensa; pagamento recusado/cancelado marca atraso
-- sozinho numa assinatura ativa.
\set ON_ERROR_STOP 1

create type public.invoice_status as enum ('pendente', 'pago', 'falhou', 'cancelado');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  cycle_start date not null,
  cycle_end date not null,
  amount numeric(12,2) not null check (amount >= 0),
  status public.invoice_status not null default 'pendente',
  payment_method text,
  gateway text not null default 'mercado_pago',
  gateway_preference_id text,
  gateway_payment_id text,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.invoices is 'Faturas da assinatura (B9.3) — uma por ciclo. Criada pendente pelo dono/admin, atualizada só pelo webhook do gateway (register_invoice_payment, service_role).';

create unique index invoices_company_pending_key on public.invoices (company_id) where status = 'pendente';
create index invoices_company_idx on public.invoices (company_id, created_at desc);

alter table public.invoices enable row level security;

create policy "invoices_select" on public.invoices for select to authenticated
  using (
    private.has_company_role(company_id, array['owner']::public.member_role[])
    or private.is_platform_admin()
  );

-- Sem insert/update/delete direto: só as funções abaixo (create_invoice via
-- security definer; register_invoice_payment restrita ao service_role).
revoke insert, update, delete on public.invoices from authenticated, anon;

-- RF-BILL-05: o dono (ou o admin da plataforma) gera a fatura do ciclo
-- atual, usando o mesmo cálculo já existente (calculate_subscription_amount,
-- B9.2) — nunca duas faturas pendentes ao mesmo tempo para a mesma empresa.
create function public.create_invoice(p_company_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_cycle record;
  v_row public.invoices;
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso à assinatura desta empresa';
  end if;

  if exists (select 1 from public.invoices where company_id = p_company_id and status = 'pendente') then
    raise exception 'Já existe uma fatura pendente para este ciclo — pague ou aguarde ela expirar antes de gerar outra.';
  end if;

  v_summary := public.calculate_subscription_amount(p_company_id);
  if not (v_summary ->> 'priced')::boolean then
    raise exception 'O preço do plano ainda não foi definido pela administração — não é possível gerar cobrança.';
  end if;

  select * into v_cycle from private.company_billing_cycle(p_company_id);

  insert into public.invoices (company_id, cycle_start, cycle_end, amount)
  values (p_company_id, v_cycle.cycle_start, v_cycle.cycle_end, (v_summary ->> 'total')::numeric)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_invoice(uuid) from public, anon;
grant execute on function public.create_invoice(uuid) to authenticated;

create function public.list_invoices(p_company_id uuid)
returns setof public.invoices
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_company_role(p_company_id, array['owner']::public.member_role[]) or private.is_platform_admin()) then
    raise exception 'Sem acesso à assinatura desta empresa';
  end if;
  return query select * from public.invoices where company_id = p_company_id order by created_at desc;
end;
$$;
revoke all on function public.list_invoices(uuid) from public, anon;
grant execute on function public.list_invoices(uuid) to authenticated;

-- Chamada pela Edge Function mercadopago-create-checkout depois de criar a
-- preferência no Mercado Pago, para gravar onde o cliente vai pagar.
create function public.set_invoice_checkout(p_invoice_id uuid, p_preference_id text, p_checkout_url text)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  if not exists (
    select 1 from public.invoices i where i.id = p_invoice_id
      and (private.has_company_role(i.company_id, array['owner']::public.member_role[]) or private.is_platform_admin())
  ) then
    raise exception 'Fatura não encontrada ou sem permissão';
  end if;

  update public.invoices
  set gateway_preference_id = p_preference_id, checkout_url = p_checkout_url
  where id = p_invoice_id and status = 'pendente'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Fatura não está mais pendente';
  end if;

  return v_row;
end;
$$;
revoke all on function public.set_invoice_checkout(uuid, text, text) from public, anon;
grant execute on function public.set_invoice_checkout(uuid, text, text) to authenticated;

-- Única forma de uma fatura virar paga/falha — chamada só pelo webhook do
-- Mercado Pago (Edge Function com a service role key, nunca pelo usuário
-- final). Pagamento aprovado reativa sozinho uma assinatura em
-- atraso/suspensa (RN-BILL-07); recusado/cancelado marca atraso sozinho
-- numa assinatura ativa — o que o B9.5 fazia manualmente (admin_mark_past_due)
-- passa a acontecer de verdade.
create function public.register_invoice_payment(
  p_invoice_id uuid,
  p_status public.invoice_status,
  p_gateway_payment_id text,
  p_payment_method text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_row public.invoices;
  v_company public.companies;
begin
  if p_status not in ('pago', 'falhou', 'cancelado') then
    raise exception 'Status de pagamento inválido para registro: %', p_status;
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Fatura não encontrada';
  end if;
  if v_invoice.status <> 'pendente' then
    raise exception 'Esta fatura já foi processada (status atual: %)', v_invoice.status;
  end if;

  update public.invoices
  set status = p_status,
      gateway_payment_id = p_gateway_payment_id,
      payment_method = coalesce(p_payment_method, payment_method),
      paid_at = case when p_status = 'pago' then now() else paid_at end
  where id = p_invoice_id
  returning * into v_row;

  select * into v_company from public.companies where id = v_row.company_id;

  if p_status = 'pago' and v_company.subscription_status in ('past_due', 'suspended') then
    perform set_config('app.justification', 'Pagamento aprovado via Mercado Pago (automático).', true);
    update public.companies set subscription_status = 'active', past_due_since = null where id = v_company.id;
  elsif p_status in ('falhou', 'cancelado') and v_company.subscription_status = 'active' then
    perform set_config('app.justification', 'Pagamento recusado ou cancelado pelo Mercado Pago (automático).', true);
    update public.companies set subscription_status = 'past_due', past_due_since = now() where id = v_company.id;
  end if;

  return v_row;
end;
$$;
revoke all on function public.register_invoice_payment(uuid, public.invoice_status, text, text) from public, anon, authenticated;
grant execute on function public.register_invoice_payment(uuid, public.invoice_status, text, text) to service_role;

-- Auditoria genérica (B0.2) — mais um `elsif` para a tabela nova.
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
  elsif entity = 'invoices' then
    return query select (row_data ->> 'company_id')::uuid, null::uuid;
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger invoices_audit
  after insert or update on public.invoices
  for each row execute function private.audit_trigger();
