# Banco de dados (Supabase)

Projeto: `mercado_facil1010` (região São Paulo, `sa-east-1`).

## Migrações

As migrações ficam em `supabase/migrations/` e são aplicadas **em ordem**. Cada arquivo
já aplicado no projeto não deve ser editado: mudanças novas entram em um arquivo novo.

| Arquivo | O que faz |
|---|---|
| `20260923000100_foundation.sql` | Empresas, mercados, perfis, membros com papéis, administradores da plataforma e regras de acesso (RLS) por empresa |
| `20260923000200_harden_foundation.sql` | Move as funções auxiliares para o schema `private` (fora da API), bloqueia a chamada direta da função do cadastro e adiciona índice |
| `20260923000400_b0_2_audit_trail.sql` | B0.2: trilha de auditoria imutável (`audit_log`), gatilhos nas tabelas, função `log_audit_event` e regras de leitura |
| `20260923000300_b0_1_foundation_fixes.sql` | B0.1: vínculo com vários mercados (`member_markets`), nada é excluído (só inativado), ciclo de vida do mercado, CPF/CNPJ com dígito verificador, sempre um dono ativo, situação da conta separada da assinatura, fuso por mercado |

## Testes das regras do banco

`supabase/tests/run.sh` cria um banco Postgres local descartável, aplica todas as migrações em ordem
e executa os arquivos `*_test.sql`. Cada verificação aparece como `OK` ou `FALHA`; o script termina com
erro se qualquer teste falhar. Os testes simulam vários usuários (donos de empresas diferentes, gerente,
conferente, repositor, administrador e visitante sem login).

Depois de aplicar uma migração, gere novamente `src/integrations/supabase/types.ts`
com o gerador de tipos do Supabase.

## Papéis

| Papel (`member_role`) | Quem é | Acesso |
|---|---|---|
| `owner` | Dono da rede | Todos os mercados da empresa; cria mercados e gerencia a equipe |
| `manager` | Gerente | Mercados vinculados em `member_markets`; edita esses mercados e vê a equipe deles |
| `receiver` | Conferente | Mercados vinculados; não vê a equipe |
| `stocker` | Repositor | Mercados vinculados; não vê a equipe |

Nada é excluído: mercados passam para `inactive` e membros para `disabled`, preservando o histórico.

## Administrador da plataforma

Por segurança, não existe tela para virar administrador. Depois de criar sua conta no app,
rode no SQL Editor do Supabase (trocando o e-mail):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com';
```

## Auditoria

Toda alteração em empresas, mercados, membros, vínculos, perfis e administradores é gravada
automaticamente em `public.audit_log`, com usuário, papel, data e hora, empresa, mercado,
valores antes e depois, campos alterados, dispositivo e justificativa.

- **Imutável:** ninguém altera nem apaga registros (nem o próprio dono da empresa).
- **Quem lê:** o dono vê a auditoria da empresa; o gerente, a dos mercados vinculados;
  os demais, somente as próprias ações.
- **Retenção:** 5 anos (decisão PA-43). A limpeza automática entra no B10.3.

O app pode enriquecer o registro por requisição:

```sql
select set_config('app.device', 'Android 14 · app 1.2.0', false);
select set_config('app.ip', '200.0.0.1', false);
select set_config('app.justification', 'Motivo da ação sensível', false);
```

Eventos que não mudam linhas (login, exportação, acesso de suporte) usam:

```sql
select public.log_audit_event('session', 'login', '<id da empresa>', null, '{"metodo":"senha"}');
```

## Chaves

O app usa apenas a URL e a chave **publicável** (`sb_publishable_...`), que podem ficar
no código. Nunca coloque a chave `service_role`/secreta no front-end ou no repositório.
