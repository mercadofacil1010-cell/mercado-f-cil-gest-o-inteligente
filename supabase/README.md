# Banco de dados (Supabase)

Projeto: `mercado_facil1010` (região São Paulo, `sa-east-1`).

## Migrações

As migrações ficam em `supabase/migrations/` e são aplicadas **em ordem**. Cada arquivo
já aplicado no projeto não deve ser editado: mudanças novas entram em um arquivo novo.

| Arquivo | O que faz |
|---|---|
| `20260923000100_foundation.sql` | Empresas, mercados, perfis, membros com papéis, administradores da plataforma e regras de acesso (RLS) por empresa |
| `20260923000200_harden_foundation.sql` | Move as funções auxiliares para o schema `private` (fora da API), bloqueia a chamada direta da função do cadastro e adiciona índice |

Depois de aplicar uma migração, gere novamente `src/integrations/supabase/types.ts`
com o gerador de tipos do Supabase.

## Papéis

| Papel (`member_role`) | Quem é | Acesso |
|---|---|---|
| `owner` | Dono da rede | Toda a empresa; cria mercados e gerencia a equipe |
| `manager` | Gerente | Mercados vinculados; edita o mercado e vê a equipe |
| `receiver` | Conferente | Mercados vinculados |
| `stocker` | Repositor | Mercados vinculados |

Um vínculo com `market_id` vazio dá acesso a todos os mercados da empresa.

## Administrador da plataforma

Por segurança, não existe tela para virar administrador. Depois de criar sua conta no app,
rode no SQL Editor do Supabase (trocando o e-mail):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com';
```

## Chaves

O app usa apenas a URL e a chave **publicável** (`sb_publishable_...`), que podem ficar
no código. Nunca coloque a chave `service_role`/secreta no front-end ou no repositório.
