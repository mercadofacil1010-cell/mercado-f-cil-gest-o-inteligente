-- B3.2 — Livro de movimentos e saldos (RF-EST-01/02/03/07/08, RN-EST-01/02/03,
-- RN-CRT-EST-01/02/03, PA-15, AUD-07).
--
-- Escopo desta etapa (decidido em DECISOES.md): o saldo cobre só os
-- endereços de depósito (B3.1) — posição de gôndola e uma área de "em
-- trânsito" entram junto com reposição (B5) e transferências (B3.5). Sem
-- reserva de estoque ainda (só faz sentido com o PDV/vendas do B7). Por
-- isso, os tipos de movimento aqui são os que já fazem sentido de verdade
-- num depósito isolado: entrada, saída, ajuste, perda e devolução ao
-- fornecedor. "Venda", "reposição" e "transferência" entram nos blocos que
-- os tornam reais (B5/B7/B3.5) — tentar implementá-los antes disso seria
-- inventar regra de negócio sem necessidade real ainda.
--
-- O livro é um ledger imutável (RF-EST-07/RN-EST-03): nenhum UPDATE/DELETE é
-- permitido para usuários do sistema; a correção de um movimento é sempre
-- por estorno (reverse_stock_movement), que cria uma linha compensatória
-- apontando para o movimento original — o histórico nunca é reescrito.
--
-- Estoque negativo é bloqueado por padrão (PA-15/RN-EST-04/RN-CRT-EST-07):
-- se o movimento deixaria o saldo negativo, é recusado a menos que uma
-- justificativa seja informada — essa justificativa é a "ocorrência"
-- exigida pela decisão, gravada na auditoria via app.justification (mesmo
-- mecanismo do B3.1).

create type public.stock_movement_type as enum ('entrada', 'saida', 'ajuste', 'perda', 'devolucao_fornecedor');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_address_id uuid not null references public.warehouse_addresses (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  type public.stock_movement_type not null,
  -- Sinal já embutido: positivo aumenta o saldo, negativo diminui
  -- (RN-EST-01/RN-CRT-EST-01). "Ajuste" é o único tipo que aceita os dois
  -- sinais — os demais têm o sinal validado pela função register_stock_movement.
  quantity numeric(12, 3) not null check (quantity <> 0),
  -- RF-EST-08: rastrear a origem/motivo do movimento (texto livre por enquanto;
  -- ganha uma referência estruturada quando recebimento/reposição existirem).
  reference text check (reference is null or char_length(reference) <= 200),
  -- Não nulo só quando esta linha é o estorno de outra (RF-EST-07/RN-EST-03).
  reversal_of uuid references public.stock_movements (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
comment on table public.stock_movements is 'Livro de movimentos de estoque (B3.2): ledger imutável, saldo por endereço de depósito e produto (RN-CRT-EST-01). Correção só por estorno (reversal_of).';

create index stock_movements_address_product_idx on public.stock_movements (warehouse_address_id, product_id);
create index stock_movements_product_idx on public.stock_movements (product_id);
create index stock_movements_reversal_of_idx on public.stock_movements (reversal_of);

alter table public.stock_movements enable row level security;

-- Só leitura direta (RF-EST-03: extrato cronológico); toda escrita passa
-- pelas funções abaixo (mesmo padrão de invites/create_invite, B1.5).
create policy "stock_movements_select" on public.stock_movements for select to authenticated
  using (exists (
    select 1 from public.warehouse_addresses wa
    join public.markets m on m.id = wa.market_id
    where wa.id = warehouse_address_id
      and (
        private.has_company_role(m.company_id, array['owner']::public.member_role[])
        or (private.has_company_role(m.company_id, array['manager']::public.member_role[]) and private.can_access_market(m.id))
      )
  ));

-- Ledger imutável: ninguém insere/atualiza/apaga direto na tabela.
revoke insert, update, delete on public.stock_movements from authenticated, anon;

-- Saldo por endereço e produto (RN-CRT-EST-01). security_invoker: respeita a
-- RLS de stock_movements de quem consulta, não de quem criou a view.
create view public.stock_balances
with (security_invoker = true) as
  select warehouse_address_id, product_id, sum(quantity) as balance
  from public.stock_movements
  group by warehouse_address_id, product_id;

-- Saldo do mercado (RN-CRT-EST-02, decidido: soma dos endereços de depósito).
create view public.market_product_balances
with (security_invoker = true) as
  select wa.market_id, sm.product_id, sum(sm.quantity) as balance
  from public.stock_movements sm
  join public.warehouse_addresses wa on wa.id = sm.warehouse_address_id
  group by wa.market_id, sm.product_id;

-- Registra um movimento validando permissão, empresa do produto e saldo
-- negativo (PA-15). p_quantity já vem com o sinal esperado pelo tipo,
-- exceto 'ajuste', que aceita qualquer sinal não-zero.
create function public.register_stock_movement(
  p_warehouse_address_id uuid,
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_reference text default null,
  p_reason text default null
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
  v_current_balance numeric;
  v_new_balance numeric;
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

  if not exists (select 1 from public.products p where p.id = p_product_id and p.company_id = v_company_id) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  select coalesce(sum(quantity), 0) into v_current_balance
  from public.stock_movements
  where warehouse_address_id = p_warehouse_address_id and product_id = p_product_id;

  v_new_balance := v_current_balance + p_quantity;

  if v_new_balance < 0 then
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Esse movimento deixaria o saldo negativo (%). Informe uma justificativa para confirmar mesmo assim.', v_new_balance;
    end if;
    perform set_config('app.justification', p_reason, true);
  end if;

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, created_by)
  values (p_warehouse_address_id, p_product_id, p_type, p_quantity, nullif(btrim(coalesce(p_reference, '')), ''), v_user)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text) to authenticated;

-- Estorna um movimento (RF-EST-07/RN-EST-03): cria uma linha compensatória
-- com o sinal invertido, sem apagar nem alterar o movimento original.
create function public.reverse_stock_movement(p_movement_id uuid, p_reason text)
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

  insert into public.stock_movements (warehouse_address_id, product_id, type, quantity, reference, reversal_of, created_by)
  values (
    v_original.warehouse_address_id, v_original.product_id, v_original.type, -v_original.quantity,
    'Estorno do movimento ' || v_original.id, v_original.id, v_user
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.reverse_stock_movement(uuid, text) from public, anon;
grant execute on function public.reverse_stock_movement(uuid, text) to authenticated;

-- Auditoria (AUD-07): estende o mecanismo genérico do B0.2. Só INSERT existe
-- para stock_movements (ledger imutável), mas o gatilho cobre o padrão geral.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger audit_stock_movements after insert on public.stock_movements
  for each row execute function private.audit_trigger();
