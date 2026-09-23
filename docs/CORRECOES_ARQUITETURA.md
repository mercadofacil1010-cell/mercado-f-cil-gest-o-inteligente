# Correções oficiais de arquitetura — Mercado Fácil

Este arquivo registra correções que o proprietário fez à arquitetura descrita na
*Documentação Funcional Completa* original. São regras oficiais do projeto a
partir da data indicada, mesmo antes de a documentação completa ser reescrita.
Quando a documentação for atualizada, cada item aqui deve ser incorporado a ela
e então pode ser arquivado.

## Correção 1 — Cinco superfícies do sistema (23/09/2026)

**Anula:** qualquer trecho da documentação anterior que tratou repositor e
conferente como abas/funções internas do painel administrativo do dono.

**Regra oficial:** o sistema deve ter, obrigatoriamente, **cinco experiências
distintas**, não três:

1. **App do Dono** — visualizar todos os mercados da rede, selecionar um
   mercado individualmente e acompanhar informações consolidadas da rede.
2. **App do Repositor** — experiência própria e operacional (não uma tela
   dentro do painel do dono).
3. **App do Conferente** — experiência própria e operacional (idem).
4. **Painel Web do dono/gestão** — a mesma visão de mercados do App do Dono,
   com experiência adequada para computador (não é só o app "esticado").
5. **Painel Administrativo da plataforma SaaS** — já existe (`/admin`),
   separado dos demais.

**Implicações a avaliar quando a documentação for revisada:**
- O que hoje é `stocker-app.tsx` (uma tela dentro do mesmo site, pensada para
  celular) não cumpre por si só nem o App do Repositor nem o App do
  Conferente — são dois papéis com uma experiência cada, não uma tela genérica
  de "funcionário".
- Definir se "App" aqui significa app nativo/instalável (loja ou PWA) ou uma
  experiência web dedicada por papel — meu entendimento é que isso ainda
  precisa de uma decisão explícita do proprietário (ver pergunta feita em
  conversa: PWA vs. loja de apps).
- O Bloco B5 do plano (`docs/PLANO_FECHAMENTO.md`), que hoje fala em
  "reposição e aplicativo móvel" no singular, provavelmente precisa virar dois
  blocos (ou duas etapas bem separadas): um para o App do Repositor, outro
  para o App do Conferente — a conferência cega (B4.2) também é afetada, já
  que ela é a operação central do Conferente.
- O App do Dono e o Painel Web do dono compartilham a mesma visão de dados,
  mas são duas superfícies (mobile e desktop) — decidir se isso significa dois
  códigos de tela distintos ou um layout responsivo único; ainda não decidido.

**Status:** registrado como regra oficial. Aguardando os demais prompts do
proprietário antes de reavaliar o impacto completo no plano e na
documentação.

## Correção 2 — Padrão de experiência dos apps mobile (23/09/2026)

**Regra oficial:** App do Dono, App do Repositor e App do Conferente devem
parecer e se comportar como um aplicativo nativo de celular, não como um
site "espremido" na tela pequena.

- **Navegação principal em menu inferior** (barra fixa na parte de baixo da
  tela), com ícone + nome simples para cada área principal do app.
- **Prioridades de experiência, nesta ordem de importância implícita no
  pedido:**
  1. poucos passos para concluir uma tarefa;
  2. botões grandes e fáceis de identificar;
  3. textos simples;
  4. telas limpas, sem excesso de informação;
  5. menus simples (nada de submenus complicados);
  6. funções importantes sempre fáceis de encontrar;
  7. feedback claro depois de qualquer ação;
  8. uso confortável com uma mão só;
  9. adequado para quem não tem familiaridade com tecnologia.
- **Princípio geral:** a complexidade do sistema fica nas regras internas
  (backend/banco), nunca na tela. Muitas funções não é desculpa para uma
  interface complicada.

**Implicações a avaliar quando a documentação for revisada:**
- `stocker-app.tsx` (tela atual de demonstração) usa navegação por abas no
  topo, não menu inferior — não segue esta regra e precisa ser refeita
  quando o App do Repositor/Conferente forem construídos de verdade (B5 e
  B4, respectivamente).
- Essa regra vale só para os 3 apps mobile; o Painel Web (dono/gestão) e o
  Painel Admin continuam com navegação lateral (padrão desktop), como já
  estão hoje.

**Status:** registrado como regra oficial. Aguardando os demais prompts do
proprietário antes de reavaliar o impacto completo no plano e na
documentação.

## Correção 3 — Fluxos do Conferente e do Repositor, integrados ao mesmo sistema (23/09/2026)

**Regra oficial:**

**App do Conferente** — aplicativo operacional próprio, usado no recebimento
de mercadorias, parte do fluxo real de entrada de produtos. A documentação
completa (a ser escrita depois) precisa detalhar: recebimento, conferência
cega, leitura/identificação dos produtos, quantidades, lotes, validade,
divergências, confirmação da conferência e entrada correta no estoque.

**App do Repositor** — aplicativo operacional próprio, usado no trabalho
físico de reposição, parte do fluxo depósito → gôndola. A documentação
completa precisa detalhar: tarefas de reposição, identificação do produto,
localização no depósito, retirada, destino na gôndola, quantidade
movimentada, confirmação da reposição, inconsistências e atualização dos
estoques.

**Integração obrigatória (um único sistema central, não telas isoladas):**
- O que o conferente recebe → reflete no estoque.
- O que acontece no estoque → pode gerar necessidade de reposição.
- O que o repositor movimenta → atualiza depósito e gôndola.
- O dono acompanha tudo isso pelo App do Dono e pelo Painel Web.

**Implicações a avaliar quando a documentação for revisada:**
- Isso confirma que B4 (recebimento/conferência cega) e B5 (reposição) não
  são só "módulos com tela própria dentro do painel do dono" — cada um
  precisa nascer já como o App do Conferente e o App do Repositor,
  respectivamente, seguindo o padrão da Correção 2 (menu inferior, apps
  simples).
- A cadeia recebimento → estoque → reposição → depósito/gôndola precisa
  estar clara na documentação como um fluxo único de dados, com o App do
  Dono/Painel Web lendo o mesmo estado (não uma cópia ou resumo separado).
- `docs/PLANO_FECHAMENTO.md` provavelmente precisa reordenar/renomear B4 e
  B5 para deixar explícito que cada um entrega um app completo, não só
  regras de banco com uma tela de exemplo.

**Status:** registrado como regra oficial. Aguardando os demais prompts do
proprietário antes de reavaliar o impacto completo no plano e na
documentação.

## Correção 4 — Regra de conduta obrigatória para toda a construção (23/09/2026)

Esta correção não é sobre a arquitetura do produto — é sobre **como eu (Claude)
devo trabalhar** neste projeto a partir de agora. Vale para todo o resto do
plano, não só para o que já foi decidido.

**Proibido, sem autorização explícita do proprietário:**
- Redesenhar o produto por conta própria.
- Substituir uma função definida por uma alternativa que eu considere melhor.
- Eliminar uma função por considerar desnecessária.
- Inventar regra de negócio que não foi definida.
- Simplificar um fluxo sem autorização.
- Transformar o App do Repositor, o App do Conferente ou o App do Dono em
  telas do painel administrativo (reforça a Correção 1).

**Obrigatório:**
- Quando faltar uma definição, marcar claramente como
  **PENDÊNCIA DE DEFINIÇÃO** e não decidir sozinho — nem como "sugestão
  aplicada automaticamente" (esse padrão usado em algumas decisões do B1,
  como DEC-B1-08 e DEC-B1-09, fica descontinuado a partir de agora: essas
  duas ficam valendo como estão, mas nenhuma decisão nova entra assim).
- A futura Documentação Mestre é a fonte oficial de verdade do Mercado
  Fácil. Toda implementação deve ser comparada com ela.
- Construir o sistema exatamente como o proprietário definiu, não como um
  modelo genérico de sistema de supermercado.

**Efeito prático imediato:** em `docs/DECISOES.md`, itens sem decisão do
proprietário continuam com sugestão registrada (para agilizar quando ele for
decidir), mas passam a exigir resposta explícita antes de qualquer código —
nunca mais "aplicada automaticamente". O mesmo vale para qualquer ponto novo
que aparecer nas próximas etapas do plano.

**Status:** registrado como regra de conduta oficial, em vigor imediatamente.
