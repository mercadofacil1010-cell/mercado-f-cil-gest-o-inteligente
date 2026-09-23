-- B1.1 — Bloqueio temporário de login por tentativas erradas (DEC-B1-01).
-- Regra decidida: mínimo 8 caracteres com letra e número (aplicado no cadastro, B1.2)
-- e bloqueio temporário após 5 tentativas erradas seguidas.
--
-- O bloqueio é decidido pelo banco, não pelo aplicativo: um contador no aparelho
-- do usuário não impede um ataque que tenta de novo sem ele. As duas funções
-- abaixo são chamáveis por quem ainda não está logado (é o momento do login).

create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

comment on table public.login_attempts is 'Tentativas de login (sucesso/falha) para aplicar o bloqueio temporário (DEC-B1-01). Sem leitura direta: só via check_login_lock.';

create index login_attempts_email_idx on public.login_attempts (lower(email), attempted_at desc);

-- Ninguém lê ou escreve direto: só as funções abaixo, com security definer.
revoke all on public.login_attempts from anon, authenticated;

-- Diz se o e-mail está bloqueado agora e por quantos segundos ainda.
-- Conta falhas seguidas desde o último sucesso; 5 falhas bloqueiam por 15 minutos
-- a partir da última falha (cada nova tentativa durante o bloqueio o renova).
create function public.check_login_lock(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_success timestamptz;
  v_fail_count int;
  v_last_fail timestamptz;
  v_locked_until timestamptz;
begin
  if p_email is null or btrim(p_email) = '' then
    return jsonb_build_object('locked', false);
  end if;

  select max(attempted_at) into v_last_success
  from public.login_attempts
  where lower(email) = lower(p_email) and success;

  select count(*), max(attempted_at) into v_fail_count, v_last_fail
  from public.login_attempts
  where lower(email) = lower(p_email)
    and not success
    and attempted_at > coalesce(v_last_success, '-infinity'::timestamptz);

  if v_fail_count >= 5 then
    v_locked_until := v_last_fail + interval '15 minutes';
    if v_locked_until > now() then
      return jsonb_build_object(
        'locked', true,
        'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_locked_until - now())))::int)
      );
    end if;
  end if;

  return jsonb_build_object('locked', false);
end;
$$;

comment on function public.check_login_lock(text) is 'Consulta se o e-mail está temporariamente bloqueado por tentativas erradas (DEC-B1-01). Chamável antes do login.';

revoke execute on function public.check_login_lock(text) from public;
grant execute on function public.check_login_lock(text) to anon, authenticated;

-- Registra o resultado de uma tentativa de login. O app chama isso depois de
-- toda tentativa (sucesso ou falha) contra o Supabase Auth.
create function public.register_login_attempt(p_email text, p_success boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.login_attempts (email, success)
  select lower(p_email), coalesce(p_success, false)
  where p_email is not null and btrim(p_email) <> '';
$$;

comment on function public.register_login_attempt(text, boolean) is 'Registra uma tentativa de login para o bloqueio temporário (DEC-B1-01). Chamável antes e depois do login.';

revoke execute on function public.register_login_attempt(text, boolean) from public;
grant execute on function public.register_login_attempt(text, boolean) to anon, authenticated;
