#!/usr/bin/env bash
# Roda os testes das regras do banco num Postgres local descartável.
# Uso: supabase/tests/run.sh   (requer psql e um servidor Postgres local acessível pelo usuário postgres)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="mf_test_$$"
tmp="$(mktemp -d)"; chmod 755 "$tmp"
cp "$here"/*.sql "$tmp"/; cp "$here"/../migrations/*.sql "$tmp"/; chmod 644 "$tmp"/*.sql
# Usa o servidor indicado por PGHOST/PGUSER quando existir (ex.: GitHub Actions);
# caso contrário, cai no Postgres local pelo usuário do sistema.
if [ -z "${PGHOST:-}" ] && [ "$(id -u)" = "0" ]; then
  # Sem servidor indicado e rodando como root: usa o Postgres local pelo usuário postgres.
  # Os argumentos são reaspados com %q porque passam por um shell a mais (su -c).
  psql_run() { su postgres -c "psql -q -v ON_ERROR_STOP=1$(printf ' %q' "$@")"; }
else
  psql_run() { psql -q -v ON_ERROR_STOP=1 "$@"; }
fi
cleanup() { psql_run -d postgres -c "drop database if exists $db" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
psql_run -d postgres -c "create database $db" >/dev/null
psql_run -d "$db" -f "$tmp/00_supabase_shim.sql" >/dev/null
for m in $(ls "$here"/../migrations/*.sql | sort); do psql_run -d "$db" -f "$tmp/$(basename "$m")" >/dev/null; done
for t in $(ls "$here"/[1-9]*_test.sql | sort); do psql_run -d "$db" -f "$tmp/$(basename "$t")" >/dev/null; done
psql_run -d "$db" -At -c "select case when ok then 'OK   ' else 'FALHA' end || ' ' || name || coalesce(' — ' || detail, '') from test.results order by id"
failed=$(psql_run -d "$db" -At -c "select count(*) from test.results where not ok")
total=$(psql_run -d "$db" -At -c "select count(*) from test.results")
echo "----"; echo "$total testes, $failed falhas"
[ "$failed" = "0" ]
