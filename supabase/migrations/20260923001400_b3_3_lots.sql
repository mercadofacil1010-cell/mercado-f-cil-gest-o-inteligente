-- B3.3 — Lotes, validade, FEFO/FIFO e bloqueio (RF-LOT-01..04/07, RN-LOT-01/02/06,
-- RN-CRT-VAL-01..04, PA-18, PA-19).
--
-- Escopo (decidido em DECISOES.md): lote só existe para produtos com
-- "controla lote e validade" marcado (RF-PROD-07/B2.2, products.tracks_batch_expiry).
-- Um lote é sempre da mesma unidade que o movimento (endereço de depósito +
-- produto), igual ao resto do B3.2. A validade é opcional dentro do lote:
-- com validade, a ordem de saída é FEFO (vence primeiro, sai primeiro);
-- sem validade, é FIFO (entrou primeiro, sai primeiro) — as duas regras
-- decididas como obrigatórias por padrão, com exceção autorizada mediante
-- justificativa (mesmo mecanismo de app.justification já usado no B3.1/B3.2).
--
-- Lote vencido ou bloqueado não pode ser usado em saída (PA-19/RN-CRT-VAL-04):
-- a única forma de tirá-lo do saldo é um movimento de perda (descarte) — que
-- funciona como a "tarefa de retirada" exigida pela decisão: a view
-- `expiring_lots` lista os lotes vencidos com saldo, prontos para descarte.

create type public.lot_status as enum ('available', 'blocked');

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  warehouse_address_id uuid not null references public.warehouse_addresses (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  -- RF-LOT-01: registrar lote, fabricação/validade, quantidade (via movimentos), fornecedor (via reference dos movimentos) e localização (o próprio endereço).
  batch_number text not null check (char_length(batch_number) between 1 and 40),
  expires_at date,
  status public.lot_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.lots is 'Lotes de produtos com controle de validade (B3.3). Só existe para produtos com tracks_batch_expiry = true.';

create unique index lots_address_product_batch_key on public.lots (warehouse_address_id, product_id, lower(batch_number));
create index lots_product_idx on public.lots (product_id);
create index lots_expires_at_idx on public.lots (expires_at);

create trigger lots_updated_at before update on public.lots
  for each row execute function public.set_updated_at();

alter table public.lots enable row level security;

create policy "lots_select" on public.lots for select to authenticated
  using (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));
create policy "lots_insert" on public.lots for insert to authenticated
  with check (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));
create policy "lots_update" on public.lots for update to authenticated
  using (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ))
  with check (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

-- Sem exclusão física (RN-ACL-06).
revoke delete on public.lots from authenticated, anon;

-- Busca o lote pelo número (por endereço+produto) ou cria se ainda não existir
-- (evita duplicar o mesmo lote em recebimentos repetidos). security invoker:
-- respeita a RLS de quem chama.
create function public.get_or_create_lot(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_batch_number text,
  p_expires_at date default null
)
returns public.lots
language plpgsql
set search_path = ''
as $$
declare
  v_row public.lots;
begin
  insert into public.lots (warehouse_address_id, product_id, batch_number, expires_at)
  values (p_warehouse_address_id, p_product_id, btrim(p_batch_number), p_expires_at)
  on conflict (warehouse_address_id, product_id, lower(batch_number))
  do update set expires_at = coalesce(public.lots.expires_at, excluded.expires_at)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.get_or_create_lot(uuid, uuid, text, date) from public, anon;
grant execute on function public.get_or_create_lot(uuid, uuid, text, date) to authenticated;

-- RN-LOT-06: corrigir a validade de um lote já recebido exige justificativa
-- (mesmo padrão do RN-LOC-06).
create function public.update_lot_expiry(p_id uuid, p_expires_at date, p_reason text)
returns public.lots
language plpgsql
set search_path = ''
as $$
declare
  v_row public.lots;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe uma justificativa para corrigir a validade deste lote.';
  end if;
  perform set_config('app.justification', p_reason, true);
  update public.lots set expires_at = p_expires_at where id = p_id
    returning * into v_row;
  if v_row.id is null then
    raise exception 'Lote não encontrado ou sem permissão para alterar.';
  end if;
  return v_row;
end;
$$;
revoke all on function public.update_lot_expiry(uuid, date, text) from public, anon;
grant execute on function public.update_lot_expiry(uuid, date, text) to authenticated;

-- Livro de movimentos passa a poder apontar para um lote (nulo para produtos
-- que não controlam lote — comportamento do B3.2 inalterado para eles).
alter table public.stock_movements add column lot_id uuid references public.lots (id);
create index stock_movements_lot_idx on public.stock_movements (lot_id);

-- Saldo por lote (RF-LOT-01/RN-CRT-VAL-01).
create view public.lot_balances
with (security_invoker = true) as
  select lot_id, warehouse_address_id, product_id, sum(quantity) as balance
  from public.stock_movements
  where lot_id is not null
  group by lot_id, warehouse_address_id, product_id;

-- Lotes com validade e seu saldo, para os alertas de 90/60/30 dias
-- (RF-LOT-02/RN-CRT-VAL-03) e para achar os vencidos com saldo pendentes de
-- descarte (PA-19: a "tarefa de retirada" é simplesmente aparecer aqui com
-- expires_at no passado e balance > 0).
create view public.expiring_lots
with (security_invoker = true) as
  select
    l.id as lot_id,
    l.warehouse_address_id,
    l.product_id,
    l.batch_number,
    l.expires_at,
    l.status,
    coalesce(lb.balance, 0) as balance,
    (l.expires_at - current_date) as days_until_expiry
  from public.lots l
  left join public.lot_balances lb on lb.lot_id = l.id
  where l.expires_at is not null;

-- Substitui register_stock_movement (B3.2) para adicionar suporte a lote:
-- produto com tracks_batch_expiry exige lote; saída de um lote bloqueado ou
-- vencido é sempre recusada (PA-19); saída que pula a ordem FEFO/FIFO
-- (RN-LOT-01/02) exige justificativa, assim como deixar o saldo (geral ou do
-- lote) negativo (PA-15, já existente).
drop function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text);

create function public.register_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null,
  p_lot_id uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_company_id uuid;
  v_market_id uuid;
  v_tracks_lot boolean;
  v_lot public.lots;
  v_current_balance numeric;
  v_new_balance numeric;
  v_lot_balance numeric;
  v_lot_new_balance numeric;
  v_suggested_lot_id uuid;
  v_needs_reason boolean := false;
  v_row public.stock_movements;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar um movimento';
  end if;
  if p_quantity = 0 then
    raise exception 'A quantidade não pode ser zero';
  end if;
  if p_type = 'entrada' and p_quantity <= 0 then
    raise exception 'Entrada precisa ter quantidade positiva';
  end if;
  if p_type in ('saida', 'perda', 'devolucao_fornecedor') and p_quantity >= 0 then
    raise exception 'Saída, perda e devolução ao fornecedor precisam ter quantidade negativa';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = p_warehouse_address_id;

  if v_company_id is null then
    raise exception 'Endereço de depósito não encontrado';
  end if;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para registrar movimento neste mercado';
  end if;

  select p.tracks_batch_expiry into v_tracks_lot
  from public.products p
  where p.id = p_product_id and p.company_id = v_company_id;

  if v_tracks_lot is null then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  if v_tracks_lot then
    if p_lot_id is null then
      raise exception 'Este produto controla lote e validade — informe o lote do movimento.';
    end if;
    select * into v_lot from public.lots
    where id = p_lot_id and warehouse_address_id = p_warehouse_address_id and product_id = p_product_id;
    if v_lot.id is null then
      raise exception 'Lote não encontrado para este endereço e produto.';
    end if;

    if p_type = 'saida' then
      if v_lot.status = 'blocked' then
        raise exception 'Este lote está bloqueado e não pode ser usado em saídas.';
      end if;
      if v_lot.expires_at is not null and v_lot.expires_at < current_date then
        raise exception 'Este lote está vencido e não pode ser usado em saídas — registre uma perda para descartá-lo.';
      end if;

      -- FEFO (com validade) / FIFO (sem validade): RN-LOT-01/02, obrigatório
      -- com exceção justificada.
      select l.id into v_suggested_lot_id
      from public.lots l
      where l.warehouse_address_id = p_warehouse_address_id
        and l.product_id = p_product_id
        and l.status = 'available'
        and (l.expires_at is null or l.expires_at >= current_date)
        and coalesce((select sum(sm.quantity) from public.stock_movements sm where sm.lot_id = l.id), 0) > 0
      order by l.expires_at asc nulls last, l.created_at asc
      limit 1;

      if v_suggested_lot_id is not null and v_suggested_lot_id <> p_lot_id then
        v_needs_reason := true;
      end if;
    end if;
  elsif p_lot_id is not null then
    raise exception 'Este produto não controla lote e validade — não informe um lote.';
  end if;

  select coalesce(sum(quantity), 0) into v_current_balance
  from public.stock_movements
  where warehouse_address_id = p_warehouse_address_id and product_id = p_product_id;
  v_new_balance := v_current_balance + p_quantity;
  if v_new_balance < 0 then
    v_needs_reason := true;
  end if;

  if p_lot_id is not null then
    select coalesce(sum(quantity), 0) into v_lot_balance from public.stock_movements where lot_id = p_lot_id;
    v_lot_new_balance := v_lot_balance + p_quantity;
    if v_lot_new_balance < 0 then
      v_needs_reason := true;
    end if;
  end if;

  if v_needs_reason then
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Esse movimento deixaria o saldo negativo ou pula a ordem de saída do lote (%). Informe uma justificativa para confirmar mesmo assim.', v_new_balance;
    end if;
    perform set_config('app.justification', p_reason, true);
  end if;

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), p_lot_id, v_user)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid) to authenticated;

-- reverse_stock_movement (B3.2) passa a carregar o lote do movimento original
-- para o estorno.
create or replace function public.reverse_stock_movement(p_movement_id uuid, p_reason text)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_original public.stock_movements;
  v_company_id uuid;
  v_market_id uuid;
  v_row public.stock_movements;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para estornar um movimento';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe a justificativa do estorno';
  end if;

  select * into v_original from public.stock_movements where id = p_movement_id;
  if v_original.id is null then
    raise exception 'Movimento não encontrado';
  end if;
  if v_original.reversal_of is not null then
    raise exception 'Não é possível estornar um estorno';
  end if;
  if exists (select 1 from public.stock_movements where reversal_of = p_movement_id) then
    raise exception 'Este movimento já foi estornado';
  end if;

  select m.company_id, m.id into v_company_id, v_market_id
  from public.warehouse_addresses wa
  join public.markets m on m.id = wa.market_id
  where wa.id = v_original.warehouse_address_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_market_id))
  ) then
    raise exception 'Sem permissão para estornar movimento neste mercado';
  end if;

  -- Saldo negativo também no estorno (ex.: estornar uma entrada já parcialmente
  -- consumida) usa a justificativa do estorno, sempre obrigatória, como ocorrência (PA-15).
  perform set_config('app.justification', p_reason, true);

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, lot_id, reversal_of, created_by)
  values (
    v_original.warehouse_address_id, v_original.product_id, v_original.type, -v_original.quantity,
    'Estorno do movimento ' || v_original.id, v_original.lot_id, v_original.id, v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reverse_stock_movement(uuid, text) from public, anon;
grant execute on function public.reverse_stock_movement(uuid, text) to authenticated;

-- Auditoria (AUD-07): estende o mecanismo genérico do B0.2.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_lots after insert or update on public.lots
  for each row execute function private.audit_trigger();
