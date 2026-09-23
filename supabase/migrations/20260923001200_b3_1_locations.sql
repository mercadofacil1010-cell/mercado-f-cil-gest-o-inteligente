-- B3.1 — Endereços de depósito e gôndola (RF-LOC-01..08, RN-LOC-01..06).
--
-- Endereçamento é operação de cada mercado, não do catálogo da rede (regra
-- fixada em DECISOES.md/CONTRAPROVA.md, análise "rede vs. mercado" de
-- 23/09/2026): cada loja tem seu próprio depósito e suas próprias gôndolas.
--
-- Duas hierarquias, com semânticas diferentes (RN-LOC-04, decidido):
-- - Endereço de depósito (warehouse_addresses): pode guardar vários produtos
--   e lotes ao mesmo tempo, como uma prateleira real de depósito. A
--   associação de produto/lote em si (RF-LOC-03) chega junto com o livro de
--   movimentos e os lotes (B3.2/B3.3) — aqui só existe a estrutura física.
-- - Posição de gôndola (gondola_positions): sempre um único produto-alvo por
--   posição, com mínimo/ideal/máximo próprios (RF-LOC-05, RN-LOC-01),
--   como um planograma.
--
-- RN-LOC-05 (decidido): capacidade excedida só gera alerta, nunca bloqueia.
-- Isso é responsabilidade da tela/relatório, não do banco — não há um check
-- de capacidade aqui.
--
-- RN-LOC-06 (decidido): mudar os limites (capacidade/mínimo/ideal/máximo)
-- exige justificativa. O "antes/depois" e o responsável já vêm de graça da
-- auditoria genérica (private.audit_trigger); a justificativa é gravada via
-- private.request_context(), que já sabia ler app.justification — só
-- faltava alguém preenchê-la, o que as funções update_*_limits abaixo fazem.

create table public.warehouse_addresses (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  warehouse_name text not null check (char_length(warehouse_name) between 1 and 60),
  sector text not null check (char_length(sector) between 1 and 40),
  street text not null check (char_length(street) between 1 and 20),
  aisle text not null check (char_length(aisle) between 1 and 20),
  shelf text not null check (char_length(shelf) between 1 and 20),
  level text not null check (char_length(level) between 1 and 20),
  position text not null check (char_length(position) between 1 and 20),
  -- RF-LOC-01: código único do endereço (dentro do mercado).
  code text not null check (char_length(code) between 1 and 30),
  capacity numeric(12, 3) not null check (capacity > 0),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.warehouse_addresses is 'Endereços físicos do depósito de cada mercado (B3.1). Pode guardar vários produtos/lotes por endereço (RN-LOC-04).';

create unique index warehouse_addresses_market_code_key on public.warehouse_addresses (market_id, lower(code));
create index warehouse_addresses_market_idx on public.warehouse_addresses (market_id);

create trigger warehouse_addresses_updated_at before update on public.warehouse_addresses
  for each row execute function public.set_updated_at();

create table public.gondola_positions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  sector text not null check (char_length(sector) between 1 and 40),
  aisle text not null check (char_length(aisle) between 1 and 20),
  gondola_number text not null check (char_length(gondola_number) between 1 and 20),
  side text not null check (side in ('A', 'B')),
  module_number integer not null check (module_number >= 1),
  shelf_number integer not null check (shelf_number >= 1),
  position_number integer not null check (position_number >= 1),
  -- RF-LOC-01/02: código único da posição (dentro do mercado).
  code text not null check (char_length(code) between 1 and 30),
  -- Produto-alvo desta posição (planograma). Nula = posição ainda livre.
  product_id uuid references public.products (id) on delete set null,
  min_quantity numeric(12, 3) not null default 0 check (min_quantity >= 0),
  ideal_quantity numeric(12, 3) not null default 0 check (ideal_quantity >= 0),
  max_quantity numeric(12, 3) not null default 0 check (max_quantity >= 0),
  capacity numeric(12, 3) not null check (capacity > 0),
  status public.support_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_quantity <= ideal_quantity and ideal_quantity <= max_quantity)
);
comment on table public.gondola_positions is 'Posições de gôndola de cada mercado (B3.1): um único produto-alvo por posição, com mínimo/ideal/máximo (RN-LOC-04, RF-LOC-05).';

create unique index gondola_positions_market_code_key on public.gondola_positions (market_id, lower(code));
create index gondola_positions_market_idx on public.gondola_positions (market_id);
create index gondola_positions_product_idx on public.gondola_positions (product_id);

create trigger gondola_positions_updated_at before update on public.gondola_positions
  for each row execute function public.set_updated_at();

alter table public.warehouse_addresses enable row level security;
alter table public.gondola_positions enable row level security;

-- Mesmo padrão de acesso do B2.3 (market_products): dono acessa todos os
-- mercados da empresa; gerente só os mercados a que tem vínculo
-- (private.can_access_market, B1.5).
create policy "warehouse_addresses_select" on public.warehouse_addresses for select to authenticated
  using (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));
create policy "warehouse_addresses_insert" on public.warehouse_addresses for insert to authenticated
  with check (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));
create policy "warehouse_addresses_update" on public.warehouse_addresses for update to authenticated
  using (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ))
  with check (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));

create policy "gondola_positions_select" on public.gondola_positions for select to authenticated
  using (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ));
-- Insert/update também exigem, quando um produto é atribuído à posição, que
-- o produto pertença à mesma empresa do mercado (impede ligar produto de uma
-- rede à gôndola de outra).
create policy "gondola_positions_insert" on public.gondola_positions for insert to authenticated
  with check (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
      and (
        product_id is null
        or exists (select 1 from public.products p where p.id = product_id and p.company_id = m.company_id)
      )
  ));
create policy "gondola_positions_update" on public.gondola_positions for update to authenticated
  using (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
  ))
  with check (exists (
    select 1 from public.markets m
    where m.id = market_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(market_id))
      )
      and (
        product_id is null
        or exists (select 1 from public.products p where p.id = product_id and p.company_id = m.company_id)
      )
  ));

-- Sem exclusão física (RN-ACL-06): inativar em vez de apagar.
revoke delete on public.warehouse_addresses, public.gondola_positions from authenticated, anon;

-- RN-LOC-06: alterar capacidade/limites exige justificativa. O antes/depois
-- e o responsável já vêm da auditoria genérica; aqui só gravamos o motivo no
-- contexto (private.request_context() já sabe ler app.justification).
create function public.update_warehouse_address_capacity(p_id uuid, p_capacity numeric, p_reason text)
returns public.warehouse_addresses
language plpgsql
set search_path = ''
as $$
declare
  v_row public.warehouse_addresses;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe uma justificativa para alterar a capacidade deste endereço.';
  end if;
  if p_capacity <= 0 then
    raise exception 'A capacidade precisa ser maior que zero.';
  end if;
  perform set_config('app.justification', p_reason, true);
  update public.warehouse_addresses set capacity = p_capacity where id = p_id
    returning * into v_row;
  if v_row.id is null then
    raise exception 'Endereço não encontrado ou sem permissão para alterar.';
  end if;
  return v_row;
end;
$$;
revoke all on function public.update_warehouse_address_capacity(uuid, numeric, text) from public, anon;
grant execute on function public.update_warehouse_address_capacity(uuid, numeric, text) to authenticated;

create function public.update_gondola_position_limits(
  p_id uuid, p_min numeric, p_ideal numeric, p_max numeric, p_capacity numeric, p_reason text
)
returns public.gondola_positions
language plpgsql
set search_path = ''
as $$
declare
  v_row public.gondola_positions;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe uma justificativa para alterar os limites desta posição.';
  end if;
  if p_capacity <= 0 then
    raise exception 'A capacidade precisa ser maior que zero.';
  end if;
  if not (p_min >= 0 and p_min <= p_ideal and p_ideal <= p_max) then
    raise exception 'O mínimo precisa ser ≤ ideal, e o ideal ≤ máximo (e nenhum valor negativo).';
  end if;
  perform set_config('app.justification', p_reason, true);
  update public.gondola_positions
    set min_quantity = p_min, ideal_quantity = p_ideal, max_quantity = p_max, capacity = p_capacity
    where id = p_id
    returning * into v_row;
  if v_row.id is null then
    raise exception 'Posição não encontrada ou sem permissão para alterar.';
  end if;
  return v_row;
end;
$$;
revoke all on function public.update_gondola_position_limits(uuid, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.update_gondola_position_limits(uuid, numeric, numeric, numeric, numeric, text) to authenticated;

-- Auditoria (AUD-04): estende o mecanismo genérico do B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_warehouse_addresses after insert or update on public.warehouse_addresses
  for each row execute function private.audit_trigger();
create trigger audit_gondola_positions after insert or update on public.gondola_positions
  for each row execute function private.audit_trigger();
