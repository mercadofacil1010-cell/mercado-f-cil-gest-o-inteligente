-- Endurecimento apontado pelo verificador de segurança do Supabase.

-- 1. A função do gatilho de cadastro não deve ser chamada pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. Funções auxiliares das políticas saem do schema exposto pela API.
--    As políticas referenciam as funções pelo identificador interno e continuam funcionando.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.is_platform_admin() set schema private;
alter function public.has_company_role(uuid, public.member_role[]) set schema private;
alter function public.can_access_market(uuid) set schema private;
alter function public.manages_user(uuid) set schema private;

-- 3. Índice para a chave estrangeira de quem criou a empresa.
create index if not exists companies_created_by_idx on public.companies (created_by);
