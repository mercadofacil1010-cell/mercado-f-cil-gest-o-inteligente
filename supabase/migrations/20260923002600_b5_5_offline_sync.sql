-- B5.5 — App instalável e funcionamento sem internet.
--
-- Escopo decidido em DECISOES.md: offline só continua o que já estava
-- baixado antes de perder internet (PA-39) — dentro de uma tarefa de
-- reposição já aceita (retirada, devolução, impedimento) e de uma
-- conferência de recebimento já iniciada (contagem de item). Ficam de fora
-- (exigem internet) as ações que dependem de saldo/estado atualizado do
-- servidor para dar uma resposta imediata: aceitar tarefa, começar
-- conferência, e a contagem cega da gôndola em si — o próprio ponto da
-- contagem cega é o servidor dizer na hora se bateu ou não (RF-REP-07), o
-- que não dá para responder sem estar online.
--
-- Quando o celular volta a ficar online, a fila de ações guardada localmente
-- (fora do banco — IndexedDB do navegador) é reaplicada chamando as mesmas
-- funções de sempre. Se o servidor rejeitar (ex.: tarefa já foi decidida por
-- outra pessoa, saldo mudou), a ação NUNCA sobrescreve silenciosamente
-- (PA-40): ela vira uma pendência de conciliação nesta tabela, visível para
-- dono/gerente, com o payload original para decidir manualmente o que fazer
-- — mesmo padrão de fila usado em pending_stock_adjustments (B3.4) e
-- com_inconsistencia (B5.2/B5.3).

create table public.offline_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete restrict,
  action_type text not null check (action_type in (
    'replenishment_withdrawal',
    'replenishment_return',
    'replenishment_impediment',
    'receiving_count'
  )),
  payload jsonb not null,
  error_message text not null check (char_length(btrim(error_message)) > 0),
  submitted_by uuid not null references auth.users (id),
  resolved_by uuid references auth.users (id),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.offline_sync_conflicts is 'Pendências de conciliação (B5.5, PA-40): ações feitas offline que o servidor recusou ao sincronizar. Nunca sobrescreve — dono/gerente decide manualmente.';

create index offline_sync_conflicts_market_idx on public.offline_sync_conflicts (market_id, resolved_at);

alter table public.offline_sync_conflicts enable row level security;

-- Mesmo padrão de pending_stock_adjustments (B3.4): só dono/gerente com
-- acesso ao mercado enxergam a fila — quem submeteu não vê de volta.
create policy "offline_sync_conflicts_select" on public.offline_sync_conflicts for select to authenticated
  using (
    private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['owner']::public.member_role[])
    or (
      private.has_company_role((select m.company_id from public.markets m where m.id = market_id), array['manager']::public.member_role[])
      and private.can_access_market(market_id)
    )
  );

revoke insert, update, delete on public.offline_sync_conflicts from authenticated, anon;

-- Registrado pelo próprio celular do repositor/conferente ao tentar
-- sincronizar e o servidor recusar — qualquer membro ativo com acesso ao
-- mercado pode registrar (é o dono da ação offline, não uma decisão).
create function public.record_sync_conflict(
  p_market_id uuid,
  p_action_type text,
  p_payload jsonb,
  p_error_message text
)
returns public.offline_sync_conflicts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.offline_sync_conflicts;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar uma pendência de sincronização';
  end if;
  if p_error_message is null or btrim(p_error_message) = '' then
    raise exception 'Informe o motivo da falha de sincronização';
  end if;
  if not exists (select 1 from public.markets where id = p_market_id) then
    raise exception 'Mercado não encontrado';
  end if;
  if not private.can_access_market(p_market_id) then
    raise exception 'Sem acesso a este mercado';
  end if;

  insert into public.offline_sync_conflicts (market_id, action_type, payload, error_message, submitted_by)
  values (p_market_id, p_action_type, p_payload, p_error_message, v_user)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_sync_conflict(uuid, text, jsonb, text) from public, anon;
grant execute on function public.record_sync_conflict(uuid, text, jsonb, text) to authenticated;

-- Dono/gerente marca como resolvida depois de decidir manualmente o que
-- fazer com a ação original (ex.: refazer o movimento, avisar o repositor).
create function public.resolve_sync_conflict(p_id uuid, p_note text)
returns public.offline_sync_conflicts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_conflict public.offline_sync_conflicts;
  v_company_id uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para resolver uma pendência';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Informe o que foi feito para resolver';
  end if;

  select * into v_conflict from public.offline_sync_conflicts where id = p_id;
  if v_conflict.id is null then
    raise exception 'Pendência de sincronização não encontrada';
  end if;
  if v_conflict.resolved_at is not null then
    raise exception 'Esta pendência já foi resolvida';
  end if;

  select m.company_id into v_company_id from public.markets m where m.id = v_conflict.market_id;

  if not (
    private.has_company_role(v_company_id, array['owner']::public.member_role[])
    or (private.has_company_role(v_company_id, array['manager']::public.member_role[]) and private.can_access_market(v_conflict.market_id))
  ) then
    raise exception 'Sem permissão para resolver pendências neste mercado';
  end if;

  update public.offline_sync_conflicts
  set resolved_by = v_user, resolution_note = p_note, resolved_at = now()
  where id = p_id
  returning * into v_conflict;

  return v_conflict;
end;
$$;

revoke all on function public.resolve_sync_conflict(uuid, text) from public, anon;
grant execute on function public.resolve_sync_conflict(uuid, text) to authenticated;

-- Auditoria genérica (B0.2) — estendida com mais um `elsif` para a tabela
-- nova, corpo idêntico ao já publicado (B5.3) fora isso.
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
  else
    return query select null::uuid, null::uuid;
  end if;
end;
$$;

create trigger offline_sync_conflicts_audit
  after insert or update on public.offline_sync_conflicts
  for each row execute function private.audit_trigger();
