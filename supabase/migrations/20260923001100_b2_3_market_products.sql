-- B2.3 — Parâmetros por mercado e ciclo do produto (RN-PROD-05, PA-04, AUD-04).
--
-- O mesmo produto pode ter mínimo, ideal, máximo, ponto de pedido e situação
-- diferentes em cada mercado da rede (RN-PROD-05): a loja do Centro pode ter
-- mínimo 10 e a loja do Bairro mínimo 3 do mesmo item. Isso é separado do
-- catálogo em si (B2.2), que é único e compartilhado pela rede.
--
-- Decisões (DECISOES.md, bloco B2.3):
-- - Ponto de pedido é um campo próprio, não é sempre igual ao mínimo — mas
--   nasce com o mesmo valor do mínimo e o usuário pode divergir depois.
-- - "Bloqueado" é uma pausa reversível: mantém estoque e histórico, mas não
--   gera alerta/tarefa de reposição nem permite reabastecer. "Inativo" é o
--   desligamento mais definitivo do produto naquele mercado.
-- - Mesma permissão do cadastro de produto (PA-04): dono e gerente.

create type public.market_product_status as enum ('active', 'blocked', 'inactive');

create table public.market_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  min_quantity numeric(12, 3) not null default 0 check (min_quantity >= 0),
  ideal_quantity numeric(12, 3) not null check (ideal_quantity >= 0),
  max_quantity numeric(12, 3) not null check (max_quantity >= 0),
  reorder_point numeric(12, 3) not null default 0 check (reorder_point >= 0),
  status public.market_product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_quantity <= ideal_quantity and ideal_quantity <= max_quantity)
);
comment on table public.market_products is 'Parâmetros de estoque do produto por mercado (B2.3): mínimo, ideal, máximo, ponto de pedido e situação (ativo/bloqueado/inativo) — RN-PROD-05.';

create unique index market_products_product_market_key on public.market_products (product_id, market_id);
create index market_products_market_idx on public.market_products (market_id);

create trigger market_products_updated_at before update on public.market_products
  for each row execute function public.set_updated_at();

alter table public.market_products enable row level security;

-- Visível e editável por dono (todos os mercados) e gerente só nos mercados a
-- que tem acesso (mesmo padrão de "markets_update", B0.1: dono tem acesso
-- geral; gerente precisa de private.can_access_market, ligado ao B1.5). Além
-- disso, produto e mercado precisam pertencer à mesma empresa (impede ligar
-- produto de uma rede a mercado de outra).
create policy "market_products_select" on public.market_products for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id
      and (
        private.has_company_role(p.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(p.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));
create policy "market_products_insert" on public.market_products for insert to authenticated
  with check (exists (
    select 1 from public.products p
    join public.markets m on m.company_id = p.company_id
    where p.id = product_id and m.id = market_id
      and (
        private.has_company_role(p.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(p.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));
create policy "market_products_update" on public.market_products for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id
      and (
        private.has_company_role(p.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(p.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ))
  with check (exists (
    select 1 from public.products p
    join public.markets m on m.company_id = p.company_id
    where p.id = product_id and m.id = market_id
      and (
        private.has_company_role(p.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(p.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));

-- Sem exclusão física (RN-ACL-06): usar status = 'inactive' em vez de apagar.
revoke delete on public.market_products from authenticated, anon;

-- Auditoria (AUD-04): estende o mesmo mecanismo genérico do B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_market_products after insert or update on public.market_products
  for each row execute function private.audit_trigger();
