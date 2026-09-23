-- Simulação mínima do ambiente Supabase (auth, papéis e permissões padrão) para testes locais.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- Utilitários de teste
create schema test;
grant usage on schema test to anon, authenticated;
create table test.results (id serial, name text, ok boolean, detail text);
grant all on test.results to anon, authenticated;
grant usage on sequence test.results_id_seq to anon, authenticated;

create function test.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  execute 'set role ' || case when u is null then 'anon' else 'authenticated' end;
end $$;
grant execute on function test.as_user(text) to anon, authenticated;

create function test.ok(cond boolean, name text) returns void language plpgsql as $$
begin insert into test.results(name, ok, detail) values (name, coalesce(cond, false), null); end $$;

-- Executa o SQL e espera que ele FALHE (bloqueado por regra, permissão ou validação).
create function test.throws(sql text, name text) returns void language plpgsql as $$
begin
  execute sql;
  insert into test.results(name, ok, detail) values (name, false, 'não falhou');
exception when others then
  insert into test.results(name, ok, detail) values (name, true, sqlerrm);
end $$;

-- Executa o SQL e retorna quantas linhas foram afetadas.
create function test.rows(sql text) returns int language plpgsql as $$
declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
grant execute on all functions in schema test to anon, authenticated;
