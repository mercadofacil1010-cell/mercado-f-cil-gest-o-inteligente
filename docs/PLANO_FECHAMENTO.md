# Plano de fechamento — Mercado Fácil

Plano ponta a ponta para deixar o sistema funcional **conforme a Documentação Funcional Completa (v1.0)**.
Ele trabalha junto com dois arquivos:

- `docs/CONTRAPROVA.md`: todos os 426 itens rastreados (requisitos, regras, fluxos, indicadores, relatórios, auditoria, pontos em aberto e problemas da análise), cada um ligado a uma etapa.
- `docs/DECISOES.md`: registro das decisões dos itens marcados como [A DEFINIR].

---

## 1. Como vamos trabalhar

### Ciclo de cada etapa

1. **Decidir.** Antes de codificar, as decisões da etapa são respondidas e registradas em `DECISOES.md`.
2. **Construir.** Crio a etapa numa branch própria, com banco, telas e regras.
3. **Testar automaticamente.** Rodo checagem de tipos, build, testes das regras do banco (RLS e gatilhos) e testes de tela no navegador (computador e celular).
4. **Abrir o PR.** O Pull Request leva o resumo, o que mudou e o **roteiro de teste manual** da etapa.
5. **Mesclar.** Você mescla o PR, e o Lovable publica a versão na prévia.
6. **Testar manualmente.** Você segue o roteiro na prévia. Se algo falhar, corrijo na mesma etapa, antes de seguir.
7. **Atualizar a contraprova.** As linhas da etapa passam para **Feito**, com a evidência (PR e teste).

### Portão de cada bloco (só passa se tudo estiver certo)

Um bloco é considerado concluído somente quando:

- todas as etapas do bloco foram mescladas e testadas;
- todas as linhas do bloco na contraprova estão **Feito** ou **Adiado** (com decisão registrada);
- a suíte de testes automáticos está verde, **incluindo a dos blocos anteriores** (para não quebrar o que já funcionava);
- o **checklist do bloco** foi entregue e você o validou seguindo o passo a passo.

Enquanto um desses pontos não estiver cumprido, o próximo bloco não começa.

### Definição de "Feito" para um requisito

Uma tela bonita **não** conta como feita (seção 12 da documentação). O requisito precisa de:

- dados gravados no banco;
- permissão aplicada no servidor (não só escondida na tela);
- status e transições conforme a documentação;
- auditoria quando a documentação exigir;
- teste automático e roteiro manual executados.

---

## 2. Visão geral dos blocos

| Bloco | Tema | Etapas | Itens na contraprova | Depende de |
|---|---|---|---|---|
| B0 | Fundação e governança | 3 | 34 | — |
| B1 | Acesso, empresa e equipe | 7 | 38 | B0 |
| B2 | Catálogo (fornecedores, produtos, embalagens) | 4 | 25 | B1 |
| B3 | Estoque, localização, lotes e validade | 6 | 59 | B2 |
| B4 | Recebimento com conferência cega | 4 | 31 | B3 |
| B5 | Reposição e aplicativo móvel | 5 | 46 | B3 (B7 para o modo automático) |
| B6 | Inconsistências e alertas | 2 | 20 | B4, B5 |
| B7 | Vendas e integração com PDV | 4 | 28 | B3; escolha do PDV |
| B8 | Indicadores, relatórios e auditoria | 3 | 54 | B3 a B7 |
| B9 | Planos, assinatura, cobrança e administração | 5 | 62 | B1; escolha do gateway |
| B10 | LGPD, segurança, backup, desempenho e piloto | 5 | 29 | todos |

**Ordem de execução:** B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10.
B9 pode ser antecipado se for preciso começar a cobrar antes; ele depende apenas do B1.

---

## 3. Blocos e etapas

### B0 — Fundação e governança

Objetivo: corrigir o que já foi construído para bater com a documentação e criar a base de auditoria e testes.

| Etapa | Entrega |
|---|---|
| **B0.1** Correções da fundação | Gerente com vários mercados (tabela de vínculos por mercado); inativar em vez de excluir mercados e membros; ciclo de vida do mercado separado de "aberto/fechado"; código interno opcional e único; nome do mercado único na empresa; validação dos dígitos de CPF e CNPJ no banco; garantia de ao menos um dono ativo; separar situação da conta e situação da assinatura; administrador sem acesso a CPF e dados operacionais |
| **B0.2** Trilha de auditoria | Tabela de auditoria que não pode ser editada; registro automático de quem, quando, empresa, mercado, ação, antes/depois e justificativa; definição de "dispositivo" |
| **B0.3** Testes automáticos | Testes das regras do banco com usuários simulados; testes de tela (Playwright) em computador e celular; roteiro de teste manual padrão; decisão do MVP (PA-01) |

**Testes do bloco:** isolamento entre empresas, gerente com 2 mercados, tentativa de apagar histórico, CPF/CNPJ inválidos, remoção do último dono e auditoria de cada alteração.

### B1 — Acesso, empresa e equipe

| Etapa | Entrega |
|---|---|
| **B1.1** Login e sessão | Login com e-mail e senha, sair, recuperar senha, confirmação de e-mail, sessão persistente e bloqueio por tentativas |
| **B1.2** Cadastro real | O cadastro em 4 etapas grava o dono e a empresa (`create_company`); aceites legais com versão, data e hora; inscrição estadual opcional; período de teste aplicado |
| **B1.3** Login social | Google e Facebook, com associação ao mesmo usuário quando o e-mail já existir |
| **B1.4** Mercados reais | Criar, editar, inativar e consultar mercados; cards e troca entre visão da rede e da unidade com dados reais (a cobrança continua simulada até o B9) |
| **B1.5** Convites e equipe | Convite por e-mail com prazo; aceite; vínculo com um ou mais mercados; o gerente não pode conceder mais acesso do que tem |
| **B1.6** Permissões nas telas | Menus e ações conforme a matriz de permissões (seção 2.2); tela de "sem acesso" |
| **B1.7** Administrador da plataforma | Área `/admin` protegida; como criar o administrador; sem acesso silencioso a dados do cliente |

**Testes do bloco:**
- criar uma conta real, cadastrar a empresa, sair e entrar de novo;
- recuperar a senha;
- convidar um gerente para 2 mercados e confirmar que ele vê só esses 2;
- um conferente não vê a equipe;
- um usuário comum não abre o `/admin`.

### B2 — Catálogo

| Etapa | Entrega |
|---|---|
| **B2.1** Fornecedores, categorias e marcas | Cadastros de apoio (lacuna G-01) |
| **B2.2** Produtos e embalagens | Produto, códigos de barras, unidade base, embalagens em cadeia com vigência da conversão, pesável, controle por lote e validade, origem do custo (G-05) |
| **B2.3** Parâmetros por mercado | Mínimo, ideal e máximo, ponto de pedido e situação por mercado; ciclo ativo, inativo e bloqueado |
| **B2.4** Importar e exportar | Planilha modelo, relatório de erros e exportação CSV |

**Testes do bloco:** as conversões dos exemplos da seção 4.2 (27 e 52 unidades, 7,5 kg); alterar uma conversão sem mudar o histórico; código de barras duplicado; importar uma planilha com erros.

### B3 — Estoque, localização, lotes e validade

| Etapa | Entrega |
|---|---|
| **B3.1** Endereços | Depósito e gôndola com hierarquia, código único, capacidade, limites e visual da gôndola com dados reais |
| **B3.2** Livro de movimentos | Movimentos imutáveis; saldo por mercado, endereço, produto e lote; estorno; política de estoque negativo |
| **B3.3** Lotes e validade | FEFO/FIFO; alertas de 90, 60 e 30 dias; bloqueio e vencimento |
| **B3.4** Perdas e ajustes | Motivo, evidência e aprovação por limite |
| **B3.5** Transferências | Entre endereços e entre mercados (saída, trânsito e entrada confirmada) |
| **B3.6** Inventário | Contagem cega geral; saldo teórico × contado; acuracidade (G-04) |

**Testes do bloco:**
- o exemplo de saldo da seção 4.1 (100 + 24 − 30 − 2 + 1 = 93);
- o exemplo de FEFO da seção 4.3;
- tentar editar um movimento confirmado;
- transferência com divergência;
- perda sem aprovação.

### B4 — Recebimento com conferência cega

| Etapa | Entrega |
|---|---|
| **B4.1** Recebimento e esperado | Criar o recebimento; itens esperados digitados ou importados do XML da NF-e (G-02) |
| **B4.2** Conferência cega no servidor | O banco não entrega o esperado ao conferente; leitura e digitação de códigos; conversão para a unidade base |
| **B4.3** Decisão e entrada | Aprovar, aprovar com divergência ou finalizar; entrada por lote e endereço; tolerâncias; aprovador |
| **B4.4** Recontagem e recusa | Nova tentativa preservando a anterior; recusa de item ou de carga; saída do status "Em recontagem" (E-04) |

**Testes do bloco:**
- o exemplo da seção 4.4 (120 esperados, 114 contados, entram 114);
- um conferente tentando ler o esperado direto pela API: precisa ser bloqueado;
- recontagem preservando a tentativa anterior;
- recusa de item.

### B5 — Reposição e aplicativo móvel

| Etapa | Entrega |
|---|---|
| **B5.1** Geração de tarefas | Tarefa quando a gôndola chega ao mínimo; sem tarefas duplicadas; prioridade; quantidade até o ideal ou o máximo; modo manual até o PDV existir (G-03) |
| **B5.2** Fluxo gravado | Aceite, entrada no depósito, retirada, local "em trânsito" (G-09), reposição e sobra, com horário de cada passo |
| **B5.3** Contagem cega da gôndola | Até 3 tentativas; inconsistência automática; decisão do gerente e saída do status "Com inconsistência" (E-05) |
| **B5.4** Câmera e scanner reais | Leitura de código de barras e de endereço pela câmera do celular e por leitor externo; fotos de evidência |
| **B5.5** App instalável e sem internet | Instalação no celular (PWA); contagens e tarefas continuam sem internet e sincronizam depois, sem duplicar nem sobrescrever |

**Testes do bloco:** uma tarefa completa no celular real; 3 contagens divergentes; uma tarefa duplicada; tirar a internet no meio da tarefa e reconectar.

### B6 — Inconsistências e alertas

| Etapa | Entrega |
|---|---|
| **B6.1** Central de inconsistências | Abrir, reconhecer, investigar, corrigir (com movimento de ajuste), descartar com justificativa e reabrir |
| **B6.2** Alertas e notificações | Motor de alertas (estoque, validade, divergência, integração); canais (sistema, e-mail, push); preferências do dono |

**Testes do bloco:** gerar cada tipo de alerta; encerrar sem justificativa (precisa ser bloqueado); verificar que encerrar não mexe no estoque.

### B7 — Vendas e integração com PDV

| Etapa | Entrega |
|---|---|
| **B7.1** Recepção de vendas | Ponto de entrada seguro; não processa o mesmo evento duas vezes; fila e estados |
| **B7.2** Mapeamento | Produto e caixa do PDV ligados ao Mercado Fácil; pendências e reprocessamento |
| **B7.3** Baixa de estoque | De qual gôndola a venda baixa; cancelamento e devolução; ligação com a reposição automática |
| **B7.4** Conector do piloto | Integração com o PDV real do mercado piloto |

**Testes do bloco:** enviar a mesma venda 2 vezes (baixa só 1); o exemplo da seção 4.7 (vende 7, a gôndola vai de 10 para 3 e gera reposição); uma venda de produto sem mapeamento vira pendência.

### B8 — Indicadores, relatórios e auditoria

| Etapa | Entrega |
|---|---|
| **B8.1** Indicadores | Os 15 indicadores do cliente com as fórmulas da seção 6.1; última atualização; detalhar até a origem |
| **B8.2** Relatórios | Os 14 relatórios da seção 6.3, com filtros e CSV |
| **B8.3** Auditoria | Consulta pesquisável; registro de exportações sensíveis |

**Testes do bloco:** conferir cada indicador contra uma massa de dados montada com o resultado já conhecido.

### B9 — Planos, assinatura, cobrança e administração

| Etapa | Entrega |
|---|---|
| **B9.1** Planos, teste e cupons | Cadastros no banco; teste com 7, 15, 20 ou 30 dias ou personalizado (E-06); regras de cupom |
| **B9.2** Assinatura e cálculo | Valor base + mercados × valor por mercado; proporcional; aceite obrigatório ao adicionar mercado |
| **B9.3** Gateway de pagamento | Cobrança recorrente, Pix, boleto e cartão; eventos e conciliação |
| **B9.4** Painel administrativo real | Os 9 indicadores da seção 6.2; ações com motivo e registro de antes/depois |
| **B9.5** Inadimplência | Atraso → suspensão → cancelamento; o que fica disponível em cada fase |

**Testes do bloco:** o exemplo da seção 4.8 (R$ 100 × 12/30 = R$ 40); pagamento aprovado e recusado no ambiente de testes do gateway; ciclo completo da assinatura.

### B10 — Não funcionais e piloto

| Etapa | Entrega |
|---|---|
| **B10.1** LGPD | Política de privacidade; exportação e eliminação a pedido; retenção |
| **B10.2** Segurança | Confirmação extra em ações críticas; verificação em duas etapas para administradores; limites de tentativa |
| **B10.3** Backup e monitoramento | Backup com restauração testada; registro de falhas; meta de disponibilidade |
| **B10.4** Desempenho | Paginação; volume de teste; tempos-alvo |
| **B10.5** Piloto e homologação | Checklist final da seção 11 executado num mercado real |

---

## 4. Modelo do checklist de bloco

Ao terminar cada bloco, envio este checklist preenchido (um arquivo em `docs/checklists/`):

```
Checklist do Bloco Bx — <nome>
Data: __/__/____   PRs: #__, #__

1. Contraprova
   [ ] Todas as linhas do bloco estão Feito ou Adiado (com decisão)

2. Testes automáticos (eu executo e anexo o resultado)
   [ ] Tipos e build
   [ ] Regras do banco (acesso por empresa, mercado e perfil)
   [ ] Telas no computador e no celular
   [ ] Testes dos blocos anteriores continuam passando

3. Testes manuais (você executa na prévia)
   Para cada item: Passo a passo → Resultado esperado → [ ] OK  [ ] Falhou (descrever)

4. Pendências e riscos conhecidos
5. Liberação para o próximo bloco:  [ ] Sim  [ ] Não
```

---

## 5. Decisões necessárias por bloco

A lista completa, com as sugestões da própria documentação, está em `docs/DECISOES.md`. Cada bloco só começa com as decisões dele respondidas.
