-- B1.4 — Corrige RLS de "markets" para o padrão real do app (INSERT ... RETURNING).
--
-- Bug real encontrado testando a criação de mercado pela tela: o Supabase-js
-- sempre faz `.insert(...).select().single()`, que vira um INSERT ... RETURNING
-- no Postgres. O RETURNING reavalia a política de SELECT sobre a linha recém
-- criada, e "markets_select" dependia de private.can_access_market(id), que
-- reconsulta a própria tabela markets (join) — essa releitura não enxergava a
-- linha inserida no MESMO comando, e o Postgres recusava com "new row violates
-- row-level security policy for table markets", mesmo o dono tendo permissão.
--
-- Correção: adiciona um atalho que verifica o dono direto pela coluna
-- company_id da própria linha (sem reconsultar a tabela), igual ao que já
-- funciona na política de INSERT (markets_insert_owner). Gerente e
-- administrador continuam como antes, sem mudança de comportamento para eles.
drop policy "markets_select" on public.markets;
create policy "markets_select" on public.markets for select to authenticated
  using (
    private.has_company_role(company_id, array['owner']::public.member_role[])
    or private.can_access_market(id)
    or private.is_platform_admin()
  );
