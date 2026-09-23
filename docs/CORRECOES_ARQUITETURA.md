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
