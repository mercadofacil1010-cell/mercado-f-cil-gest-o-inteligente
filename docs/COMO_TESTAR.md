# Como testar cada etapa

Guia prático para você conferir o sistema depois de cada merge. Nenhum passo exige conhecimento técnico.

## Onde testar

| O quê | Onde | Link |
|---|---|---|
| Telas do sistema | Prévia do Lovable | editor do projeto → botão de prévia |
| Banco de dados | Painel do Supabase | https://supabase.com/dashboard → projeto `mercado_facil1010` |
| Código e planilhas de controle | GitHub | repositório do projeto |

## Teste rápido de sempre (3 minutos)

Faça isso depois de **todo** merge, mesmo quando a etapa mexeu só no banco:

1. Abra a prévia. A tela de login precisa aparecer completa (logo, textos e formulário).
2. Entre com o login de demonstração. O dashboard precisa carregar com os cards dos mercados.
3. Abra um mercado pelo card e passe por 2 ou 3 abas.
4. Volte, abra o endereço `/admin` e navegue por 2 ou 3 seções.
5. Repita o passo 2 no celular (ou estreitando a janela do navegador).

Se qualquer passo falhar, pare e me avise. Não seguimos para a próxima etapa com o teste rápido falhando.

## Como conferir o banco de dados

**Ver as tabelas:** painel do Supabase → menu lateral **Table Editor**. Cada tabela precisa mostrar
um cadeado, que indica a proteção por empresa ativa (RLS).

**Rodar uma consulta:** menu lateral **SQL Editor** → cole o comando → botão **Run**.
As consultas de cada etapa vêm prontas na descrição do PR; é só copiar e colar.

**Ver o histórico de alterações:** em **Table Editor**, abra a tabela `audit_log`. Cada linha mostra
quem fez, o que fez, quando, em qual empresa e mercado, e os valores antes e depois.

## Como ler o resultado dos testes automáticos

No GitHub, na aba **Actions** (ou no próprio PR), aparece a verificação chamada **Verificação**:

- **bolinha verde:** tipos, formato, build e as regras do banco passaram;
- **bolinha vermelha:** algo falhou. Clique para ver qual teste quebrou. Eu corrijo antes do merge.

Para rodar os testes do banco por conta própria (opcional, exige um computador com Postgres):

```bash
supabase/tests/run.sh
```

Ele cria um banco temporário, aplica todas as migrações e mostra `OK` ou `FALHA` para cada verificação.

## O que fazer quando algo falha

Me diga três coisas:

1. **Qual passo** falhou (o número do roteiro).
2. **O que apareceu** na tela: a mensagem de erro ou o que aconteceu de diferente.
3. **Onde:** computador ou celular, e qual navegador.

Eu corrijo dentro da mesma etapa. Só seguimos para a próxima quando o teste passar.
