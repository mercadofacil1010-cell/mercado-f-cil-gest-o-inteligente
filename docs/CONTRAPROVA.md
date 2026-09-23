# Contraprova — Mercado Fácil

Lista de verificação de **todos** os itens da *Documentação Funcional Completa* (v1.0, 23/09/2026) e dos problemas encontrados na análise.
Cada linha aponta a etapa do plano (`docs/PLANO_FECHAMENTO.md`) em que o item é entregue. Um bloco só é concluído quando **todas** as linhas dele estão como **Feito**.

**Status:** `Pendente` → `Em andamento` → `Feito` (com evidência). `Parcial` = começou, falta completar. `Adiado` = decisão formal de tirar da versão.  
**Decisão?** `Sim` = o item tem [A DEFINIR]; a decisão precisa estar registrada em `docs/DECISOES.md` antes de codificar.

Total de itens rastreados: **426** · Feito: **38** · Parcial: **4**

| Bloco | Itens |
|---|---|
| B0 — Fundação e governança | 34 |
| B1 — Acesso, empresa e equipe | 38 |
| B2 — Catálogo | 25 |
| B3 — Estoque e localização | 59 |
| B4 — Recebimento | 31 |
| B5 — Reposição e app móvel | 46 |
| B6 — Inconsistências e alertas | 20 |
| B7 — Vendas e PDV | 28 |
| B8 — Indicadores e relatórios | 54 |
| B9 — Comercial e administração | 62 |
| B10 — Não funcionais e piloto | 29 |

## B0.1 — Correções da fundação (multimercado, inativar em vez de excluir, ciclo do mercado, CPF/CNPJ)

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-ACL-01 | Todo usuário de cliente pertence a uma empresa e só pode acessar dados dessa empresa. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — isolamento entre empresas (6 testes) |
| RN-ACL-02 | Dono da rede acessa a empresa inteira e todos os mercados dela. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — dono vê/gerencia todos os mercados |
| RN-ACL-03 | Gerente, conferente e repositor acessam apenas os mercados aos quais estão vinculados. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — gerente/conferente/repositor só nos mercados vinculados |
| RN-ACL-04 | Uma pessoa pode ser vinculada a mais de um mercado; os limites por perfil ainda exigem decisão. [A DEFINIR] | Sim | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — tabela member_markets; limites por perfil no B1.5 |
| RN-ACL-06 | Exclusões que alterem histórico de estoque, recebimento, cobrança ou auditoria não devem apagar a evidência; devem cancelar, inativar ou estornar. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — DELETE revogado; FKs restrict |
| RN-ACC-02 | Uma empresa deve possuir ao menos um dono ativo. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — gatilho ensure_active_owner |
| RN-ORG-03 | Inativar mercado não apaga histórico de estoque, vendas, usuários ou auditoria. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — mercado só inativa (ciclo de vida) |
| RN-ORG-05 | O gerente pode ser responsável por mais de um mercado [A DEFINIR]. | Sim | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — gerente com 2 mercados testado |
| RN-ADM-05 | Dados de um cliente não podem ser expostos a outro cliente. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — isolamento testado; administrador sem CPF |
| RNF-SEC-01 | Autenticar usuários e aplicar autorização por empresa, mercado, perfil e ação. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — autorização por empresa/mercado/perfil (autenticação: ver RNF-SEC-01b no B1.1) |
| RNF-MULTI-01 | Isolar integralmente os dados de cada cliente em consultas, relatórios, arquivos, integrações e notificações. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — camada de dados isolada; relatórios/integrações serão reverificados no B7/B8 |
| RNF-MULTI-02 | Impedir que identificadores manipulados concedam acesso a outra empresa ou mercado. |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — IDs de outra empresa não dão acesso (testado) |
| PA-03 | Gerente pode administrar mais de um mercado? — Sugestão do documento: sim, por vínculos explícitos. | Sim | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — decisão aceita e aplicada |
| PA-49 | Qual fuso horário será usado? — Sugestão do documento: fuso configurado no mercado e horário absoluto preservado na auditoria. | Sim | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — coluna markets.timezone (padrão America/Sao_Paulo) |
| E-03 | Incoerência: 3 ciclos de status do cliente (conta 3.1, assinatura 3.12, cliente 3.13) — separar situação da conta e da assinatura |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — account_status + subscription_status |
| D-01 | Divergência construída: gerente só com 1 mercado ou todos (precisa de vários) |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — member_markets |
| D-02 | Divergência construída: exclusão real de mercado/membro (deve inativar) |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — DELETE revogado |
| D-03 | Divergência construída: status do mercado mistura aberto/fechado com ciclo de vida |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — markets.status (ciclo) + is_open |
| D-04 | Divergência construída: código interno do mercado obrigatório (deve ser opcional e único) |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — internal_code opcional, único por empresa |
| D-05 | Divergência construída: nome do mercado pode repetir na empresa |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — índice único do nome |
| D-06 | Divergência construída: CPF/CNPJ validam só o formato (faltam dígitos verificadores) |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — is_valid_cpf / is_valid_cnpj |
| D-08 | Divergência construída: garantir sempre ao menos um dono ativo |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — gatilho ensure_active_owner |
| D-09 | Divergência construída: administrador vê perfis com CPF (restringir a dados comerciais) |  | Feito | PR B0.1 · teste `supabase/tests/10_access_test.sql` — política profiles_select sem administrador |

## B0.2 — Trilha de auditoria no banco

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-ACL-05 | Ações sensíveis devem registrar usuário, data, horário, mercado, dispositivo e valores anteriores e posteriores. |  | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — gatilhos em 6 tabelas gravam usuário, papel, data/hora, empresa, mercado, dispositivo, antes/depois |
| RN-RPT-02 | Auditoria não pode ser editada por usuários comuns. |  | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — UPDATE/DELETE revogados e bloqueados por gatilho |
| RN-RPT-03 | Correções geram novos eventos; não substituem silenciosamente o histórico. |  | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — cada correção gera novo registro; nada é sobrescrito |
| RNF-AUD-01 | Registrar usuário, perfil, empresa, mercado, ação, entidade, identificador, data/hora, dispositivo/origem, antes/depois e justificativa. |  | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — campos completos, incluindo justificativa e fuso do mercado |
| RNF-AUD-02 | Logs não devem ser editáveis por usuários comuns; retenção [A DEFINIR]. | Sim | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — imutável; retenção de 5 anos documentada (limpeza automática no B10.3) |
| PA-43 | Tempo de retenção da auditoria? — Sugestão do documento: alinhar a requisitos legais, contratuais e de investigação. | Sim | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — decisão aceita: 5 anos |
| G-07 | Lacuna: definição de 'dispositivo' na auditoria |  | Feito | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — dispositivo = navegador + IP + identificador do app (DEC-B0-03) |
| D-10 | Divergência construída: faltam convites, aceites legais e auditoria |  | Parcial | PR B0.2 · teste `supabase/tests/20_audit_test.sql` — auditoria feita; convites no B1.5 e aceites legais no B1.2 |

## B0.3 — Testes automáticos e verificação contínua

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| PA-01 | Qual é o MVP exato? — Sugestão do documento: acesso, empresa/mercados, produtos, localizações, recebimento, estoque, reposição, alertas, PDV inicial e administração de assinatura. | Sim | Feito | PR B0.3 — MVP aceito conforme a sugestão do documento (acesso, empresa/mercados, produtos, localizações, recebimento, estoque, reposição, alertas, PDV inicial e assinatura) |
| QA-01 | Suíte de testes automáticos (tipos, build, regras do banco, telas) rodando a cada mudança |  | Feito | PR B0.3 — `.github/workflows/verificacao.yml`: tipos, lint, build e testes do banco a cada mudança |
| QA-02 | Roteiro de teste manual por etapa e checklist por bloco |  | Feito | PR B0.3 — `docs/COMO_TESTAR.md` e `docs/checklists/MODELO.md` |

## B1.1 — Login, sessão, logout e recuperação de senha

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-SEC-01b | Autenticação de usuários (parte de RNF-SEC-01) |  | Feito | PR B1.1 · `supabase.auth.signInWithPassword`, sessão persistente e `src/lib/auth-context.tsx` |
| RF-ACC-01 | Permitir login por e-mail e senha. |  | Feito | PR B1.1 · `src/routes/index.tsx` (tela de login real) |
| RF-ACC-03 | Permitir recuperação de senha. |  | Feito | PR B1.1 · `resetPasswordForEmail` + `src/routes/redefinir-senha.tsx` |
| RF-ACC-08 | Validar e-mail e telefone antes da ativação. Método [A DEFINIR]. | Sim | Parcial | Decisão (DEC-B1-02): confirmar por e-mail, telefone fica para depois. Falta **ação manual do proprietário**: ligar "Confirm email" no painel do Supabase (Authentication → Sign In / Providers) — não há API para isso |
| INT-MAIL | Integração e-mail |  | Feito | PR B1.1 — envio padrão do Supabase Auth (DEC-B1-03), usado por recuperação de senha e confirmação |
| AUD-01 | Evento de auditoria: Login, logout, recuperação de senha, bloqueio e falha de acesso (seção 8.1) |  | Feito | PR B1.1 · `log_security_event` + teste `supabase/tests/40_login_audit_test.sql` |

## B1.2 — Cadastro real do dono e da empresa + aceites legais

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ACC-04 | Cadastrar responsável, empresa e configuração inicial. |  | Pendente |  |
| RF-ACC-05 | Apresentar resumo e aceite antes da criação da empresa. |  | Pendente |  |
| RF-ACC-07 | Permitir salvar e continuar depois. [A DEFINIR] | Sim | Pendente |  |
| RN-ACC-01 | O primeiro usuário cadastrado torna-se dono da rede. |  | Parcial | Banco: create_company cria o dono |
| RN-ACC-03 | CPF e CNPJ devem ser armazenados e exibidos com proteção adequada; mascaramento em telas [A DEFINIR]. | Sim | Pendente |  |
| RN-ACC-06 | Cadastro incompleto não libera funções operacionais; validade do rascunho [A DEFINIR]. | Sim | Pendente |  |
| RNF-LGPD-03 | Registrar aceites legais, versão, data, horário e origem. |  | Pendente |  |
| D-07 | Divergência construída: inscrição estadual obrigatória na tela (é opcional) |  | Pendente |  |
| F-5.1 | Fluxo: cadastro da empresa e primeiro acesso |  | Pendente |  |

## B1.3 — Login com Google e Facebook

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ACC-02 | Disponibilizar login com conta Google e Facebook. |  | Pendente |  |
| RN-ACC-04 | Login social deve associar a conta ao mesmo usuário quando o e-mail já existir; regra de confirmação [A DEFINIR]. | Sim | Pendente |  |

## B1.4 — Mercados reais (criar, editar, inativar, cards, troca de visão)

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ORG-01 | Exibir cards separados para cada mercado. |  | Pendente |  |
| RF-ORG-02 | Permitir adicionar, editar, inativar e consultar mercado. |  | Pendente |  |
| RF-ORG-03 | Mostrar no card nome, endereço, telefone, gerente, faturamento do dia e alertas. |  | Pendente |  |
| RF-ORG-04 | Abrir ambiente individual ao selecionar um card. |  | Pendente |  |
| RF-ORG-06 | Permitir que o dono troque entre visão consolidada e visão por unidade. |  | Pendente |  |
| RF-ORG-07 | Registrar estrutura da unidade, horários, caixas, depósitos e informações do PDV. |  | Pendente |  |
| RN-ORG-01 | Todo mercado pertence a exatamente uma empresa. |  | Parcial | Banco: mercado pertence a 1 empresa (gatilho) |

## B1.5 — Convites e vínculos da equipe

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ORG-05 | Permitir convidar gerente e funcionários por mercado. |  | Pendente |  |
| RN-ORG-04 | Funcionário só recebe permissões após aceitar convite e ser vinculado a mercado. |  | Pendente |  |
| PA-02 | Quais perfis adicionais existirão? — Sugestão do documento: comprador, estoquista/auditor, financeiro do cliente e suporte da plataforma somente quando houver necessidade real. | Sim | Pendente |  |
| G-06 | Lacuna: limites do gerente ao convidar/editar equipe (não pode dar mais acesso do que tem) |  | Pendente |  |
| F-5.2 | Fluxo: convite e entrada de funcionários |  | Pendente |  |
| AUD-02 | Evento de auditoria: Criação/edição/inativação/vínculo de empresa, mercado e usuário (seção 8.1) |  | Pendente |  |

## B1.6 — Permissões por perfil nas telas

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-ACC-01 | Interface deve ser legível, responsiva, com contraste e alvos adequados a uso móvel. |  | Pendente |  |
| AUD-03 | Evento de auditoria: Alteração de perfil e permissão (seção 8.1) |  | Pendente |  |

## B1.7 — Acesso do administrador da plataforma

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-ACL-07 | Administrador da plataforma não deve assumir silenciosamente a identidade de cliente. Suporte com acesso delegado e consentimento está [A DEFINIR]. | Sim | Pendente |  |
| RF-ACC-06 | Separar acesso de cliente do acesso administrativo da plataforma. |  | Pendente |  |
| RF-ADM-08 | Atender solicitações de suporte sem acesso irrestrito silencioso aos dados do cliente. |  | Pendente |  |
| RN-ADM-02 | Administrador não altera estoque do cliente por padrão; exceção de suporte está [A DEFINIR]. | Sim | Pendente |  |
| PA-44 | Administrador pode acessar dados do cliente para suporte? — Sugestão do documento: somente com consentimento, prazo, justificativa e auditoria. | Sim | Pendente |  |
| G-08 | Lacuna: como o administrador da plataforma é criado |  | Pendente |  |
| AUD-09 | Evento de auditoria: Acesso administrativo a dados do cliente (seção 8.1) |  | Pendente |  |

## B2.1 — Fornecedores, categorias e marcas

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| PA-23 | Haverá módulo completo de compras? — Sugestão do documento: primeira versão gera alerta e sugestão; pedido formal pode ser fase posterior. | Sim | Pendente |  |
| G-01 | Lacuna: cadastro de fornecedores (usado em lote, recebimento e ponto de pedido) |  | Pendente |  |

## B2.2 — Produtos, embalagens e conversões

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-PROD-01 | Cadastrar produto com código, descrição, marca, categoria e imagem. |  | Pendente |  |
| RF-PROD-02 | Cadastrar código de barras e SKU. |  | Pendente |  |
| RF-PROD-03 | Cadastrar unidade base e embalagens alternativas. |  | Pendente |  |
| RF-PROD-04 | Definir conversão de caixa, fardo e pacote para a unidade base. |  | Pendente |  |
| RF-PROD-05 | Suportar unidade, pacote, caixa, fardo, quilograma e litro. |  | Pendente |  |
| RF-PROD-06 | Identificar produtos pesáveis ou de medida fracionada. |  | Pendente |  |
| RF-PROD-07 | Configurar controle por lote e validade. |  | Pendente |  |
| RN-PROD-01 | Todo saldo deve ser normalizado para a unidade base do produto. |  | Pendente |  |
| RN-PROD-02 | A alteração do fator de conversão não pode modificar movimentos históricos; vigência da nova conversão [A DEFINIR]. | Sim | Pendente |  |
| RN-PROD-03 | Embalagem não pode possuir fator zero ou negativo. |  | Pendente |  |
| RN-PROD-06 | Precisão para kg e litro, arredondamento e quantidade de casas decimais estão [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-EMB-01 | Toda embalagem deve possuir fator em relação à unidade base. |  | Pendente |  |
| RN-CRT-EMB-02 | Movimentos e comparações usam unidade base, preservando a embalagem originalmente informada para auditoria. |  | Pendente |  |
| RN-CRT-EMB-03 | Fatores podem formar cadeia, mas o resultado final deve chegar à unidade base. |  | Pendente |  |
| RN-CRT-EMB-04 | Arredondamento de kg/litro e venda fracionada está [A DEFINIR]. | Sim | Pendente |  |
| RNF-PERF-02 | Listagens devem usar paginação e filtros para catálogos e históricos extensos. |  | Pendente |  |
| PA-04 | Quem pode cadastrar/alterar produto? — Sugestão do documento: dono e gerente; outros por permissão específica. | Sim | Pendente |  |
| G-05 | Lacuna: origem do custo do produto (perdas em R$, giro, divergências) |  | Pendente |  |
| AUD-04 | Evento de auditoria: Produto, embalagem, conversão, lote, validade e localização (seção 8.1) |  | Pendente |  |

## B2.3 — Parâmetros por mercado e ciclo do produto

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-PROD-04 | Produto inativado não pode receber novos movimentos, salvo estorno autorizado [A DEFINIR]. | Sim | Pendente |  |
| RN-PROD-05 | O mesmo produto pode ter parâmetros de estoque e gôndola diferentes em cada mercado. |  | Pendente |  |

## B2.4 — Importação e exportação do catálogo

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-PROD-08 | Importar e exportar catálogo [A DEFINIR]. | Sim | Pendente |  |
| PA-45 | Haverá importação inicial de produtos e estoque? — Sugestão do documento: sim, com modelo validado e relatório de erros. | Sim | Pendente |  |

## B3.1 — Endereços de depósito e gôndola

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-LOC-01 | Cadastrar depósito, setor, rua, corredor, estante, nível e posição. |  | Pendente |  |
| RF-LOC-02 | Cadastrar setor, corredor, gôndola, lado, módulo, prateleira e posição. |  | Pendente |  |
| RF-LOC-03 | Associar produto e lote a endereços. |  | Pendente |  |
| RF-LOC-04 | Definir capacidade e ocupação do endereço. |  | Pendente |  |
| RF-LOC-05 | Definir mínimo, ideal e máximo por posição de gôndola. |  | Pendente |  |
| RF-LOC-06 | Representar visualmente gôndolas e níveis de abastecimento. |  | Pendente |  |
| RF-LOC-07 | Permitir leitura do endereço por código ou scanner. |  | Pendente |  |
| RF-LOC-08 | Manter histórico de localização e movimentação. |  | Pendente |  |
| RN-LOC-01 | Deve valer mínimo &lt;= ideal &lt;= máximo. |  | Pendente |  |
| RN-LOC-02 | Um endereço inativo não recebe novos movimentos. |  | Pendente |  |
| RN-LOC-03 | O mesmo produto pode ocupar múltiplos endereços. |  | Pendente |  |
| RN-LOC-04 | Um endereço pode conter múltiplos produtos ou lotes [A DEFINIR]. | Sim | Pendente |  |
| RN-LOC-05 | Quantidade acima da capacidade deve ser bloqueada ou apenas alertada [A DEFINIR]. | Sim | Pendente |  |
| RN-LOC-06 | Mudança de limites deve registrar valor anterior, novo valor, responsável e justificativa [A DEFINIR]. | Sim | Pendente |  |

## B3.2 — Livro de movimentos e saldos

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-EST-01 | Consultar saldo consolidado e detalhado por endereço e lote. |  | Pendente |  |
| RF-EST-02 | Registrar entrada, saída, transferência, reposição, venda, ajuste, perda e devolução. |  | Pendente |  |
| RF-EST-03 | Exibir extrato cronológico de movimentos. |  | Pendente |  |
| RF-EST-07 | Impedir alteração direta de movimento finalizado; usar estorno ou compensação. |  | Pendente |  |
| RF-EST-08 | Rastrear origem de cada movimento. |  | Pendente |  |
| RN-EST-01 | Saldo = saldo anterior + entradas + transferências recebidas + ajustes positivos - saídas - transferências enviadas - vendas - perdas - devoluções ao fornecedor + ajustes negativos/positivos conforme sinal. |  | Pendente |  |
| RN-EST-02 | O saldo deve existir por mercado, endereço, produto e lote quando aplicável. |  | Pendente |  |
| RN-EST-03 | Movimento confirmado é imutável; correção ocorre por estorno ou movimento compensatório. |  | Pendente |  |
| RN-EST-04 | Permitir ou bloquear estoque negativo está [A DEFINIR]. | Sim | Pendente |  |
| RN-EST-08 | Toda inconsistência deve guardar valores esperados, contados e diferença. |  | Pendente |  |
| RN-CRT-EST-01 | Saldo por endereço = saldo anterior + entradas confirmadas + transferências recebidas + ajustes positivos - saídas confirmadas - transferências enviadas - vendas atribuídas ao endereço - perdas - devoluções ao fornecedor - ajustes negativos. |  | Pendente |  |
| RN-CRT-EST-02 | Saldo total do mercado = soma dos saldos de todos os endereços ativos, incluindo áreas de recebimento, depósito, gôndola e trânsito conforme política [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-EST-03 | Saldo disponível = saldo físico/teórico - reservado - bloqueado. Reserva e estoque em trânsito estão [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-EST-07 | Estoque negativo não pode ser aceito silenciosamente. Bloqueio ou aceitação com ocorrência está [A DEFINIR]. | Sim | Pendente |  |
| PA-15 | Estoque negativo é permitido? — Sugestão do documento: não por padrão; integrar venda e criar ocorrência quando inevitável. | Sim | Pendente |  |
| E-02 | Erro no documento: RN-EST-01 soma ajustes duas vezes (usar RN-CRT-EST-01) |  | Pendente |  |
| AUD-07 | Evento de auditoria: Movimentos de estoque, ajuste, perda, transferência, estorno e inventário (seção 8.1) |  | Pendente |  |

## B3.3 — Lotes, validade, FEFO/FIFO e bloqueio

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-LOT-01 | Registrar lote, fabricação, validade, quantidade, fornecedor e localização. |  | Pendente |  |
| RF-LOT-02 | Listar produtos vencendo em 30, 60 e 90 dias. |  | Pendente |  |
| RF-LOT-03 | Sinalizar e bloquear lote vencido conforme política. |  | Pendente |  |
| RF-LOT-04 | Priorizar lote para saída conforme FEFO ou FIFO. |  | Pendente |  |
| RF-LOT-06 | Permitir ação comercial sobre produto próximo do vencimento [A DEFINIR]. | Sim | Pendente |  |
| RF-LOT-07 | Rastrear lote do recebimento até saída, perda ou transferência. |  | Pendente |  |
| RN-LOT-01 | Produtos com validade devem usar FEFO como política sugerida; adoção obrigatória [A DEFINIR]. | Sim | Pendente |  |
| RN-LOT-02 | Produtos sem validade podem usar FIFO; política definitiva [A DEFINIR]. | Sim | Pendente |  |
| RN-LOT-03 | Alertas padrão solicitados são 90, 60 e 30 dias antes da validade. |  | Pendente |  |
| RN-LOT-04 | A ação automática ao vencer - bloquear venda, bloquear movimentação ou somente alertar - está [A DEFINIR]. | Sim | Pendente |  |
| RN-LOT-06 | Alterar validade depois do recebimento exige justificativa e auditoria; perfis permitidos [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-VAL-01 | FEFO: para produto com validade, sugerir primeiro o lote que vence antes, desde que esteja liberado. |  | Pendente |  |
| RN-CRT-VAL-02 | FIFO: para produto sem validade, sugerir primeiro a entrada mais antiga. Política obrigatória está [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-VAL-03 | Alertar em 90, 60 e 30 dias antes do vencimento. |  | Pendente |  |
| RN-CRT-VAL-04 | No vencimento, o produto deve sair da disponibilidade. Bloqueio automático de venda/movimentação está [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-VAL-05 | Descarte exige movimento de perda, quantidade, motivo, responsável e aprovação conforme política. |  | Pendente |  |
| PA-18 | FEFO será obrigatório? — Sugestão do documento: obrigatório para produtos com validade, permitindo exceção autorizada. | Sim | Pendente |  |
| PA-19 | Produto vencido bloqueia venda automaticamente? — Sugestão do documento: bloquear disponibilidade e gerar tarefa de retirada; integração com PDV depende de capacidade. | Sim | Pendente |  |

## B3.4 — Perdas, ajustes e estornos com aprovação

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-LOT-05 | Registrar perda, motivo, quantidade, evidência e aprovação. |  | Pendente |  |
| RN-LOT-05 | Perda aprovada reduz o saldo do lote e gera movimento imutável de saída por perda. |  | Pendente |  |
| RN-EST-06 | Ajuste exige justificativa e aprovação conforme limite [A DEFINIR]. | Sim | Pendente |  |
| PA-21 | Como aprovar perdas e ajustes? — Sugestão do documento: limites por quantidade e valor, com foto acima do limite. | Sim | Pendente |  |

## B3.5 — Transferências internas e entre mercados

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-ORG-06 | Transferência de produto entre mercados exige origem, destino, responsável e confirmação de recebimento [A DEFINIR]. | Sim | Pendente |  |
| RN-EST-05 | Transferência entre mercados deve possuir saída da origem e entrada confirmada no destino; responsabilidade durante trânsito [A DEFINIR]. | Sim | Pendente |  |
| PA-22 | Transferência entre mercados faz parte do MVP? — Sugestão do documento: incluir depois da movimentação interna estar estável, salvo necessidade do piloto. | Sim | Pendente |  |

## B3.6 — Inventário e contagem

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-EST-04 | Permitir inventário e contagem cega [A DEFINIR]. | Sim | Pendente |  |
| RF-EST-05 | Calcular saldo teórico e comparar com saldo contado. |  | Pendente |  |
| G-04 | Lacuna: fluxo de inventário e contagem geral |  | Pendente |  |

## B4.1 — Recebimento e itens esperados (manual e XML)

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REC-01 | Criar recebimento por fornecedor, pedido e nota fiscal. |  | Pendente |  |
| PA-07 | A nota fiscal é obrigatória para receber? — Sugestão do documento: permitir recebimento por pedido/autorização excepcional, sempre auditado. | Sim | Pendente |  |
| G-02 | Lacuna: quem registra os itens esperados do recebimento e quando (manual e/ou XML) |  | Pendente |  |
| INT-NFE | Integração NF-e/XML |  | Pendente |  |

## B4.2 — Conferência cega protegida no servidor

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REC-02 | Registrar início, término, conferente, dispositivo e duração. |  | Pendente |  |
| RF-REC-03 | Ler produto por scanner ou permitir digitação manual. |  | Pendente |  |
| RF-REC-04 | Contar por unidade, pacote, caixa, fardo, kg ou litro. |  | Pendente |  |
| RF-REC-05 | Registrar lote, fabricação, validade, condição, foto e observação. |  | Pendente |  |
| RF-REC-06 | Ocultar quantidades esperadas durante a conferência. |  | Pendente |  |
| RF-REC-07 | Comparar esperado e contado somente após finalização. |  | Pendente |  |
| RN-REC-01 | O conferente não visualiza quantidade esperada, diferença ou percentual durante a contagem cega. |  | Pendente |  |
| RN-REC-02 | O conferente pode visualizar identificação do recebimento e dados necessários para reconhecer a carga; exibição de volumes esperados [A DEFINIR]. | Sim | Pendente |  |
| RN-REC-03 | A conferência converte todas as embalagens para a unidade base antes da comparação. |  | Pendente |  |
| RN-REC-04 | Tolerância de quantidade, peso, preço, validade e prazo mínimo está [A DEFINIR]. | Sim | Pendente |  |
| PA-08 | O conferente vê quantidade de volumes esperada? — Sugestão do documento: mostrar apenas volumes físicos informados na chegada, não os esperados por documento. | Sim | Pendente |  |

## B4.3 — Decisão, entrada no estoque e finalização

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REC-08 | Permitir aprovar divergência, solicitar recontagem, recusar item ou finalizar. |  | Pendente |  |
| RF-REC-09 | Gerar entrada de estoque apenas conforme decisão aprovada. |  | Pendente |  |
| RN-REC-05 | Aprovação de divergência cabe ao gerente ou dono; limites por valor/percentual [A DEFINIR]. | Sim | Pendente |  |
| RN-REC-08 | Finalizar sem divergência gera entrada dos itens aceitos por lote e localização de recebimento ou depósito. |  | Pendente |  |
| RN-REC-09 | Aprovar com divergência gera entrada da quantidade física aceita, nunca da quantidade apenas documental. |  | Pendente |  |
| PA-05 | Quem aprova divergência de recebimento? — Sugestão do documento: gerente até um limite e dono acima dele. | Sim | Pendente |  |
| PA-06 | Quais tolerâncias de recebimento? — Sugestão do documento: começar sem tolerância automática; todas as diferenças ficam visíveis. | Sim | Pendente |  |
| PA-20 | Qual prazo mínimo de validade no recebimento? — Sugestão do documento: configurável por categoria/produto/fornecedor. | Sim | Pendente |  |
| F-5.4 | Fluxo: recebimento de mercadoria ponta a ponta |  | Pendente |  |
| AUD-05 | Evento de auditoria: Recebimento: início, contagem, recontagem, aprovação, recusa, finalização (seção 8.1) |  | Pendente |  |

## B4.4 — Recontagem, recusa e histórico

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REC-10 | Manter histórico de recontagens e decisões. |  | Pendente |  |
| RN-REC-06 | Solicitar recontagem preserva a primeira contagem, oculta o esperado e cria nova tentativa. |  | Pendente |  |
| RN-REC-07 | Recusar item não gera entrada para a quantidade recusada e registra motivo e evidência. |  | Pendente |  |
| RN-REC-10 | Edição depois da finalização deve ocorrer por estorno/ajuste autorizado, sem apagar o recebimento. |  | Pendente |  |
| PA-09 | Há limite de recontagens no recebimento? — Sugestão do documento: configurar separadamente da regra de três tentativas da reposição. | Sim | Pendente |  |
| E-04 | Incoerência: recebimento sem saída do status 'Em recontagem' |  | Pendente |  |

## B5.1 — Geração automática de tarefas de reposição

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REP-01 | Criar tarefa quando a gôndola atingir ou ficar abaixo do mínimo. |  | Pendente |  |
| RN-REP-01 | A tarefa é criada quando o saldo estimado da posição fica menor ou igual ao mínimo. |  | Pendente |  |
| RN-REP-02 | O destino da reposição - ideal ou máximo - está [A DEFINIR]. | Sim | Pendente |  |
| RN-REP-09 | Prioridade considera ruptura, tempo, vendas e validade, mas fórmula definitiva está [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-EST-04 | Ao atingir mínimo, o sistema alerta; para gôndola, também cria ou sugere tarefa de reposição. |  | Pendente |  |
| RN-CRT-EST-05 | Ideal é o alvo operacional. Máximo é o limite planejado ou físico. A reposição até ideal ou máximo está [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-REP-01 | Criar ou sugerir tarefa quando o saldo estimado da posição ficar menor ou igual ao mínimo. |  | Pendente |  |
| RN-CRT-REP-02 | Evitar tarefa duplicada aberta para a mesma posição e produto, salvo reposição parcial [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-REP-06 | Prioridade exata está [A DEFINIR]. Sugestão: ruptura completa &gt; produto de alto giro &gt; maior tempo aguardando &gt; validade mais curta. | Sim | Pendente |  |
| PA-10 | Reposição completa até ideal ou máximo? — Sugestão do documento: até ideal; máximo funciona como limite. | Sim | Pendente |  |
| PA-11 | Como calcular prioridade da reposição? — Sugestão do documento: ruptura, vendas recentes, tempo aguardando, validade e criticidade. | Sim | Pendente |  |
| PA-13 | Pode haver tarefa duplicada? — Sugestão do documento: impedir para mesmo produto/posição enquanto existir tarefa ativa. | Sim | Pendente |  |
| G-03 | Lacuna: reposição depende do saldo teórico da gôndola, que depende das vendas do PDV — modo manual até o PDV |  | Pendente |  |

## B5.2 — Fluxo do repositor gravado no banco

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REP-02 | Exibir produto, foto, endereços, prioridade e quantidade sugerida. |  | Pendente |  |
| RF-REP-03 | Permitir ao repositor aceitar ou iniciar a tarefa. |  | Pendente |  |
| RF-REP-04 | Registrar entrada no depósito e horários automaticamente. |  | Pendente |  |
| RF-REP-06 | Registrar quantidade retirada, contada, reposta e devolvida. |  | Pendente |  |
| RF-REP-08 | Registrar foto, observação e impedimentos. |  | Pendente |  |
| RF-REP-10 | Calcular duração e manter trilha completa da tarefa. |  | Pendente |  |
| RN-REP-07 | Retirada reduz depósito; reposição aumenta gôndola; sobra devolvida retorna ao endereço informado. |  | Pendente |  |
| RN-REP-08 | A tarefa só conclui quando as quantidades fecham ou quando responsável autorizado decide sobre a inconsistência. |  | Pendente |  |
| RN-CRT-REP-03 | Registrar horários de aceite, entrada no depósito, retirada, chegada à gôndola e conclusão. |  | Pendente |  |
| PA-12 | Como atribuir tarefa ao repositor? — Sugestão do documento: fila do mercado com aceite; gerente pode atribuir manualmente. | Sim | Pendente |  |
| G-09 | Lacuna: local 'em trânsito' do produto nas mãos do repositor |  | Pendente |  |
| AUD-06 | Evento de auditoria: Reposição: criação, aceite, retirada, tentativas, inconsistência, conclusão (seção 8.1) |  | Pendente |  |

## B5.3 — Contagem cega da gôndola (3 tentativas)

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REP-07 | Aplicar contagem cega da gôndola com até três tentativas. |  | Pendente |  |
| RF-REP-09 | Gerar inconsistência quando as contagens não fecharem. |  | Pendente |  |
| RN-REP-03 | O repositor não visualiza a quantidade teórica existente antes de contar. |  | Pendente |  |
| RN-REP-04 | Cada tentativa registra valor, data, horário e dispositivo; a tentativa anterior não é apagada. |  | Pendente |  |
| RN-REP-05 | Após uma contagem divergente, o sistema permite no máximo três tentativas. |  | Pendente |  |
| RN-REP-06 | Persistindo divergência na terceira tentativa, a tarefa gera ocorrência e notifica dono/gerente. |  | Pendente |  |
| RN-CRT-REP-04 | Contagem é cega e aceita no máximo três tentativas. |  | Pendente |  |
| RN-CRT-REP-05 | Na terceira divergência, abrir inconsistência e alertar gerente/dono. |  | Pendente |  |
| PA-14 | O que acontece após a terceira contagem divergente? — Sugestão do documento: bloquear conclusão automática e exigir decisão do gerente. | Sim | Pendente |  |
| E-01 | Erro no documento: exemplo da reposição (4.5) — contagem 4 bateria com o esperado 4 |  | Pendente |  |
| E-05 | Incoerência: reposição sem saída do status 'Com inconsistência' |  | Pendente |  |
| F-5.5 | Fluxo: tarefa de reposição ponta a ponta |  | Pendente |  |

## B5.4 — Câmera e leitor de código de barras reais

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-REP-05 | Escanear endereço e produto no depósito e na gôndola. |  | Pendente |  |
| PA-47 | Quais dispositivos e scanners serão suportados? — Sugestão do documento: validar câmera do celular e leitores usados no piloto. | Sim | Pendente |  |
| INT-SCAN | Leitor de código de barras |  | Pendente |  |
| INT-CAM | Câmera (código, fotos, evidências) |  | Pendente |  |

## B5.5 — App instalável e funcionamento sem internet

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-OFF-01 | Aplicativo deve lidar com perda de conexão sem perder contagens e tarefas em andamento. |  | Pendente |  |
| RNF-OFF-02 | Funções permitidas offline e resolução de conflitos estão [A DEFINIR]. | Sim | Pendente |  |
| RNF-OFF-03 | Exibir claramente quando dado é local, pendente ou sincronizado. |  | Pendente |  |
| PA-39 | Funcionamento offline no celular? — Sugestão do documento: permitir tarefas já baixadas e contagens; bloquear decisões que dependem de saldo atualizado. | Sim | Pendente |  |
| PA-40 | Como resolver conflito offline? — Sugestão do documento: nunca sobrescrever silenciosamente; criar pendência para conciliação. | Sim | Pendente |  |

## B6.1 — Central de inconsistências

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-INC-01 | Criar ocorrência por recebimento, reposição, inventário, transferência, venda ou validade. |  | Pendente |  |
| RF-INC-02 | Classificar gravidade e prioridade. |  | Pendente |  |
| RF-INC-03 | Atribuir responsável e prazo. |  | Pendente |  |
| RF-INC-04 | Exibir esperado, contado, diferença, histórico e evidências. |  | Pendente |  |
| RF-INC-05 | Permitir reconhecer, investigar, corrigir, justificar e encerrar. |  | Pendente |  |
| RF-INC-07 | Manter vínculo com movimentos corretivos. |  | Pendente |  |
| RF-INC-08 | Impedir encerramento sem justificativa. |  | Pendente |  |
| RN-INC-01 | Inconsistência automática não pode ser apagada; pode ser resolvida, descartada com justificativa ou vinculada a correção. |  | Pendente |  |
| RN-INC-02 | Encerrar não altera estoque sozinho; qualquer correção exige movimento de ajuste. |  | Pendente |  |
| RN-INC-03 | Gravidade por valor, quantidade, recorrência e produto crítico está [A DEFINIR]. | Sim | Pendente |  |
| RN-INC-04 | Ocorrências repetidas por produto, endereço ou usuário devem ser agrupadas ou sinalizadas [A DEFINIR]. | Sim | Pendente |  |
| RN-INC-05 | Apenas dono/gerente encerra ocorrência; limites [A DEFINIR]. | Sim | Pendente |  |

## B6.2 — Motor de alertas e notificações

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-DSH-05 | Um alerta não desaparece apenas porque o usuário abriu o painel; exige resolução ou descarte autorizado. |  | Pendente |  |
| RF-EST-06 | Gerar alertas de mínimo, ponto de pedido, negativo e divergência. |  | Pendente |  |
| RF-INC-06 | Notificar dono e gerente conforme tipo e limite. |  | Pendente |  |
| RN-CRT-EST-06 | Ponto de pedido do depósito gera alerta ou sugestão de compra; fórmula por consumo e prazo do fornecedor está [A DEFINIR]. | Sim | Pendente |  |
| PA-37 | Quais canais de notificação? — Sugestão do documento: sistema e push para operação; e-mail para conta/cobrança; WhatsApp opcional com consentimento. | Sim | Pendente |  |
| PA-38 | Quais alertas chegam ao dono? — Sugestão do documento: permitir preferências, mantendo críticos obrigatórios. | Sim | Pendente |  |
| G-10 | Lacuna: perfil 'comprador' citado em alertas mas não definido |  | Pendente |  |
| INT-WPP | Integração WhatsApp (opcional) |  | Pendente |  |

## B7.1 — Recepção de vendas do PDV (idempotente)

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-PDV-01 | Receber venda identificada por mercado, caixa, data, itens e quantidades. |  | Pendente |  |
| RF-PDV-05 | Evitar duplicidade de eventos. |  | Pendente |  |
| RN-PDV-01 | O mesmo evento externo não pode gerar dois movimentos. |  | Pendente |  |
| RN-PDV-02 | Venda confirmada reduz saldo teórico uma única vez. |  | Pendente |  |
| RN-PDV-06 | Falha de integração não deve perder eventos; recuperação e janela de retenção [A DEFINIR]. | Sim | Pendente |  |
| RN-INT-01 | Toda integração deve identificar origem, evento e horário para evitar duplicidade. |  | Pendente |  |
| RN-INT-02 | Falha não pode apagar dados recebidos nem gerar movimentação parcial silenciosa. |  | Pendente |  |
| RN-INT-03 | Eventos devem possuir estado de processamento e possibilidade de reprocessamento seguro. |  | Pendente |  |
| RN-INT-04 | Credenciais e responsáveis pela configuração estão [A DEFINIR]. | Sim | Pendente |  |
| RN-INT-06 | Integrações devem respeitar o escopo da empresa e do mercado. |  | Pendente |  |
| PA-25 | Como o PDV enviará dados e com que frequência? — Sugestão do documento: eventos próximos do tempo real, com reconciliação periódica. | Sim | Pendente |  |

## B7.2 — Mapeamento de produtos e pendências

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-PDV-02 | Converter unidade de venda para unidade base. |  | Pendente |  |
| RF-PDV-06 | Exibir fila e falhas de sincronização. |  | Pendente |  |
| RF-PDV-07 | Reprocessar eventos falhos sem duplicar movimentos. |  | Pendente |  |
| RN-PDV-07 | Evento não mapeado cria pendência e não deve baixar produto incorreto. |  | Pendente |  |

## B7.3 — Baixa de estoque, cancelamento e devolução

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-EST-07 | Saldo de gôndola pode ser teórico entre contagens; venda do PDV reduz o local definido pela regra de baixa [A DEFINIR]. | Sim | Pendente |  |
| RF-PDV-03 | Baixar o estoque conforme regra de localização. |  | Pendente |  |
| RF-PDV-04 | Processar cancelamento, devolução e estorno quando enviados pelo PDV [A DEFINIR]. | Sim | Pendente |  |
| RF-PDV-08 | Atualizar dashboards e avaliar necessidade de reposição. |  | Pendente |  |
| RN-PDV-03 | A localização de baixa - gôndola principal, posição específica ou saldo consolidado - está [A DEFINIR]. | Sim | Pendente |  |
| RN-PDV-04 | Venda de quantidade superior ao saldo segue política de estoque negativo [A DEFINIR]. | Sim | Pendente |  |
| RN-PDV-05 | Cancelamento ou devolução deve vincular-se à venda original e gerar movimento inverso conforme condição do produto [A DEFINIR]. | Sim | Pendente |  |
| PA-16 | Qual endereço sofre a baixa da venda? — Sugestão do documento: gôndola principal configurada para o produto; falta de mapeamento vira pendência. | Sim | Pendente |  |
| PA-17 | Como tratar várias posições do mesmo produto? — Sugestão do documento: regra explícita de prioridade ou distribuição proporcional, nunca escolha silenciosa. | Sim | Pendente |  |
| PA-26 | Como tratar devolução e cancelamento de venda? — Sugestão do documento: evento reverso vinculado à venda original; produto devolvido vai para endereço de inspeção. | Sim | Pendente |  |

## B7.4 — Conector do PDV do mercado piloto

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-INT-05 | Sistemas/fornecedores iniciais de PDV, pagamento, e-mail e WhatsApp estão [A DEFINIR]. | Sim | Pendente |  |
| PA-24 | Qual PDV será integrado primeiro? — Sugestão do documento: escolher o PDV real do mercado piloto. | Sim | Pendente |  |
| INT-PDV | Integração PDV |  | Pendente |  |

## B8.1 — Indicadores reais da rede e do mercado

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-DSH-01 | Exibir cards de faturamento, vendas, ticket médio, estoque baixo, validade, reposições e inconsistências. |  | Pendente |  |
| RF-DSH-02 | Comparar mercados e períodos. |  | Pendente |  |
| RF-DSH-03 | Exibir produtos mais vendidos e sem giro. |  | Pendente |  |
| RF-DSH-04 | Exibir feed de operação com vendas, entradas, retiradas, reposições e divergências. |  | Pendente |  |
| RF-DSH-05 | Filtrar por empresa, mercado, período, categoria e produto [A DEFINIR]. | Sim | Pendente |  |
| RF-DSH-06 | Informar data e horário da última atualização. |  | Pendente |  |
| RF-DSH-07 | Abrir detalhes a partir de cada indicador ou alerta. |  | Pendente |  |
| RF-DSH-08 | Adaptar a visualização ao celular do dono e gerente. |  | Pendente |  |
| RN-DSH-01 | Indicadores consolidados somam apenas mercados visíveis e válidos no período. |  | Pendente |  |
| RN-DSH-02 | Dados atrasados devem exibir a última sincronização, sem aparentar tempo real. |  | Pendente |  |
| RN-DSH-03 | Indicadores devem permitir rastrear a origem dos dados. |  | Pendente |  |
| RN-DSH-04 | Cancelamentos, devoluções e estornos nas vendas dependem da integração do PDV [A DEFINIR]. | Sim | Pendente |  |
| PA-48 | Quais dados financeiros serão exibidos? — Sugestão do documento: faturamento e vendas do PDV; custos e margem somente se a origem estiver definida. | Sim | Pendente |  |
| IND-01 | Indicador do cliente: Faturamento do dia (fórmula da seção 6.1) |  | Pendente |  |
| IND-02 | Indicador do cliente: Vendas realizadas (fórmula da seção 6.1) |  | Pendente |  |
| IND-03 | Indicador do cliente: Ticket médio (fórmula da seção 6.1) |  | Pendente |  |
| IND-04 | Indicador do cliente: Itens vendidos (fórmula da seção 6.1) |  | Pendente |  |
| IND-05 | Indicador do cliente: Estoque baixo (fórmula da seção 6.1) |  | Pendente |  |
| IND-06 | Indicador do cliente: Ruptura (fórmula da seção 6.1) |  | Pendente |  |
| IND-07 | Indicador do cliente: Reposições pendentes (fórmula da seção 6.1) |  | Pendente |  |
| IND-08 | Indicador do cliente: Tempo médio de reposição (fórmula da seção 6.1) |  | Pendente |  |
| IND-09 | Indicador do cliente: Produtos próximos do vencimento (fórmula da seção 6.1) |  | Pendente |  |
| IND-10 | Indicador do cliente: Perdas (fórmula da seção 6.1) |  | Pendente |  |
| IND-11 | Indicador do cliente: Inconsistências abertas (fórmula da seção 6.1) |  | Pendente |  |
| IND-12 | Indicador do cliente: Acuracidade de estoque (fórmula da seção 6.1) |  | Pendente |  |
| IND-13 | Indicador do cliente: Giro do estoque (fórmula da seção 6.1) |  | Pendente |  |
| IND-14 | Indicador do cliente: Produto sem giro (fórmula da seção 6.1) |  | Pendente |  |
| IND-15 | Indicador do cliente: Cobertura de estoque (fórmula da seção 6.1) |  | Pendente |  |

## B8.2 — Relatórios e exportação

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-RPT-01 | Gerar relatórios por empresa, mercado, período, produto, lote, endereço e responsável. |  | Pendente |  |
| RF-RPT-02 | Permitir exportação [A DEFINIR]. | Sim | Pendente |  |
| RF-RPT-03 | Mostrar origem e horário de atualização dos dados. |  | Pendente |  |
| RF-RPT-05 | Permitir detalhamento do indicador até os eventos de origem. |  | Pendente |  |
| RF-RPT-06 | Restringir conteúdo conforme perfil e mercado. |  | Pendente |  |
| RN-RPT-01 | Relatórios respeitam o mesmo isolamento e as mesmas permissões das telas operacionais. |  | Pendente |  |
| RN-RPT-04 | Prazo de retenção dos relatórios e logs está [A DEFINIR]. | Sim | Pendente |  |
| RN-RPT-05 | Horário deve ser apresentado no fuso do mercado ou do usuário [A DEFINIR]. | Sim | Pendente |  |
| PA-50 | Quais formatos de relatório e exportação? — Sugestão do documento: tela e CSV no MVP; PDF/planilha conforme prioridade. | Sim | Pendente |  |
| REL-01 | Relatório: Estoque atual (seção 6.3) |  | Pendente |  |
| REL-02 | Relatório: Extrato de movimentações (seção 6.3) |  | Pendente |  |
| REL-03 | Relatório: Recebimentos (seção 6.3) |  | Pendente |  |
| REL-04 | Relatório: Divergências de recebimento (seção 6.3) |  | Pendente |  |
| REL-05 | Relatório: Reposições (seção 6.3) |  | Pendente |  |
| REL-06 | Relatório: Rupturas (seção 6.3) |  | Pendente |  |
| REL-07 | Relatório: Validade (seção 6.3) |  | Pendente |  |
| REL-08 | Relatório: Perdas (seção 6.3) |  | Pendente |  |
| REL-09 | Relatório: Vendas (seção 6.3) |  | Pendente |  |
| REL-10 | Relatório: Produtos sem giro (seção 6.3) |  | Pendente |  |
| REL-11 | Relatório: Inconsistências (seção 6.3) |  | Pendente |  |
| REL-12 | Relatório: Transferências (seção 6.3) |  | Pendente |  |
| REL-13 | Relatório: Assinaturas e cobrança (seção 6.3) |  | Pendente |  |
| REL-14 | Relatório: Auditoria (seção 6.3) |  | Pendente |  |
| AUD-10 | Evento de auditoria: Exportação de relatório ou dados pessoais (seção 8.1) |  | Pendente |  |

## B8.3 — Consulta de auditoria

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-RPT-04 | Manter trilha de auditoria pesquisável. |  | Pendente |  |
| RF-RPT-07 | Registrar geração e exportação de relatório sensível [A DEFINIR]. | Sim | Pendente |  |

## B9.1 — Planos, teste gratuito e cupons no banco

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RN-ACC-05 | O período de teste aplicado deve ser o configurado pela administração no momento do cadastro. |  | Pendente |  |
| RF-BILL-01 | Cadastrar planos, recursos, limites, valor base e valor por mercado. |  | Pendente |  |
| RF-BILL-02 | Configurar teste gratuito de 7, 15, 20 dias ou período personalizado. |  | Pendente |  |
| RF-BILL-03 | Definir se teste exige meio de pagamento [A DEFINIR]. | Sim | Pendente |  |
| RF-BILL-06 | Cadastrar cupons e aplicar regras de desconto. |  | Pendente |  |
| RN-BILL-03 | O período de teste é configurável pela administração. |  | Pendente |  |
| RN-BILL-04 | Quantidade de testes por CNPJ, CPF, e-mail ou meio de pagamento está [A DEFINIR]. | Sim | Pendente |  |
| RN-BILL-05 | Cupom pode alterar valor base, valor por mercado ou total [A DEFINIR]. | Sim | Pendente |  |
| RN-BILL-06 | Ordem de aplicação e combinação de cupons está [A DEFINIR]. | Sim | Pendente |  |
| RF-ADM-03 | Configurar testes gratuitos. |  | Pendente |  |
| RF-ADM-04 | Criar e administrar cupons. |  | Pendente |  |
| RN-CRT-BIL-03 | Teste gratuito configurável; duração e exigência de meio de pagamento dependem da configuração vigente. |  | Pendente |  |
| RN-CRT-BIL-04 | Cupom deve guardar tipo, valor, vigência, limite, elegibilidade e regra de combinação [A DEFINIR]. | Sim | Pendente |  |
| PA-28 | Quais planos, preços e limites? — Sugestão do documento: validar comercialmente antes da integração do pagamento. | Sim | Pendente |  |
| PA-29 | Existe valor base além do valor por mercado? — Sugestão do documento: permitir configuração; não obrigar fórmula única. | Sim | Pendente |  |
| PA-31 | Teste exige cartão? — Sugestão do documento: parâmetro por plano/campanha. | Sim | Pendente |  |
| PA-32 | Quantos testes uma empresa pode usar? — Sugestão do documento: um por CNPJ, com exceção manual auditada. | Sim | Pendente |  |
| PA-33 | Como funcionam cupons? — Sugestão do documento: percentual ou valor fixo, vigência, limite de uso, elegibilidade e não cumulativo por padrão. | Sim | Pendente |  |
| E-06 | Incoerência: teste gratuito sem a opção de 30 dias pedida no Prompt 10 |  | Pendente |  |

## B9.2 — Assinatura, cálculo e proporcional

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ORG-08 | Simular e confirmar impacto financeiro ao adicionar mercado. |  | Pendente |  |
| RN-ORG-02 | A inclusão de mercado deve passar pelo resumo de cobrança antes da ativação. |  | Pendente |  |
| RF-BILL-04 | Simular valor proporcional ao adicionar mercado no meio do ciclo. |  | Pendente |  |
| RF-BILL-08 | Registrar histórico de alterações comerciais. |  | Pendente |  |
| RF-BILL-09 | Permitir concessão administrativa de dias adicionais. |  | Pendente |  |
| RF-BILL-10 | Exibir ao cliente plano, mercados cobrados, próxima cobrança e valor estimado. |  | Pendente |  |
| RN-BILL-01 | O preço considera valor base + quantidade de mercados cobrados x valor por mercado, salvo regras do plano [A DEFINIR]. | Sim | Pendente |  |
| RN-BILL-02 | Mercado adicional pode gerar cobrança proporcional entre ativação e próxima renovação; fórmula e arredondamento [A DEFINIR]. | Sim | Pendente |  |
| RN-BILL-09 | Adicionar mercado exige aceite do novo valor antes da ativação. |  | Pendente |  |
| RN-BILL-10 | Remoção de mercado e efeito na cobrança imediata ou próxima renovação estão [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-BIL-01 | Fórmula sugerida [A DEFINIR]: mensalidade = valor base + mercados cobrados x valor por mercado - descontos válidos. | Sim | Pendente |  |
| RN-CRT-BIL-02 | Proporcional sugerido [A DEFINIR]: valor adicional mensal x dias restantes do ciclo / dias do ciclo, conforme regra do gateway e arredondamento. | Sim | Pendente |  |
| PA-30 | Como calcular proporcional? — Sugestão do documento: dias restantes/dias do ciclo, respeitando regra do gateway. | Sim | Pendente |  |
| F-5.3 | Fluxo: adicionar mercado (com cobrança) |  | Pendente |  |
| AUD-08 | Evento de auditoria: Plano, teste, preço, cupom, assinatura, pagamento, suspensão, cancelamento (seção 8.1) |  | Pendente |  |

## B9.3 — Gateway de pagamento

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-BILL-05 | Gerenciar assinatura, cobranças, pagamentos e falhas. |  | Pendente |  |
| PA-27 | Qual gateway de pagamento? — Sugestão do documento: comparar Pix, boleto, cartão recorrente, cobrança proporcional e eventos de inadimplência. | Sim | Pendente |  |
| INT-PAY | Integração gateway de pagamento |  | Pendente |  |

## B9.4 — Painel administrativo real

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-ADM-01 | Visualizar empresas, mercados, testes, assinaturas e receita recorrente. |  | Pendente |  |
| RF-ADM-02 | Gerenciar planos, valores, recursos e limites. |  | Pendente |  |
| RF-ADM-05 | Consultar pagamentos e inadimplência. |  | Pendente |  |
| RF-ADM-06 | Conceder dias adicionais, desconto, suspensão, reativação e cancelamento. |  | Pendente |  |
| RF-ADM-07 | Consultar auditoria e histórico comercial. |  | Pendente |  |
| RF-ADM-09 | Configurar integrações e mensagens gerais [A DEFINIR]. | Sim | Pendente |  |
| RN-ADM-01 | Toda alteração comercial manual deve registrar administrador, motivo e antes/depois. |  | Pendente |  |
| RN-ADM-03 | Alterar preço de plano não deve mudar retroativamente cobranças concluídas. |  | Pendente |  |
| RN-ADM-04 | Aplicação de novo preço a clientes existentes, aviso e antecedência estão [A DEFINIR]. | Sim | Pendente |  |
| IND-ADM-01 | Indicador da plataforma: Empresas cadastradas (seção 6.2) |  | Pendente |  |
| IND-ADM-02 | Indicador da plataforma: Mercados ativos (seção 6.2) |  | Pendente |  |
| IND-ADM-03 | Indicador da plataforma: Assinaturas ativas (seção 6.2) |  | Pendente |  |
| IND-ADM-04 | Indicador da plataforma: Assinaturas em teste (seção 6.2) |  | Pendente |  |
| IND-ADM-05 | Indicador da plataforma: MRR (seção 6.2) |  | Pendente |  |
| IND-ADM-06 | Indicador da plataforma: Previsão de receita (seção 6.2) |  | Pendente |  |
| IND-ADM-07 | Indicador da plataforma: Conversão do teste (seção 6.2) |  | Pendente |  |
| IND-ADM-08 | Indicador da plataforma: Cancelamento (seção 6.2) |  | Pendente |  |
| IND-ADM-09 | Indicador da plataforma: Inadimplência (seção 6.2) |  | Pendente |  |

## B9.5 — Inadimplência, suspensão e cancelamento

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RF-BILL-07 | Suspender ou reativar conforme política de inadimplência. |  | Pendente |  |
| RN-BILL-07 | Prazos para atraso, bloqueio, suspensão e cancelamento estão [A DEFINIR]. | Sim | Pendente |  |
| RN-BILL-08 | Suspensão deve preservar dados; retenção após cancelamento está [A DEFINIR]. | Sim | Pendente |  |
| RN-CRT-BIL-05 | Prazos de inadimplência, bloqueio, suspensão, cancelamento e retenção estão [A DEFINIR]. | Sim | Pendente |  |
| PA-34 | Prazos de inadimplência? — Sugestão do documento: definir sequência de aviso, tolerância, suspensão e cancelamento com assessoria comercial/jurídica. | Sim | Pendente |  |
| PA-35 | O que fica disponível durante suspensão? — Sugestão do documento: leitura e exportação por prazo limitado; bloquear novas operações. | Sim | Pendente |  |
| F-5.6 | Fluxo: ciclo de vida da assinatura |  | Pendente |  |

## B10.1 — LGPD

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-LGPD-01 | Tratar CPF, telefone, e-mail, imagens e registros de uso somente para finalidades documentadas. |  | Pendente |  |
| RNF-LGPD-02 | Permitir atendimento a solicitações de acesso, correção, portabilidade e eliminação conforme obrigação legal e retenção [A DEFINIR]. | Sim | Pendente |  |
| RNF-LGPD-04 | Definir controlador, operador, encarregado, política de privacidade e prazos [A DEFINIR]. | Sim | Pendente |  |
| PA-36 | Retenção de dados após cancelamento? — Sugestão do documento: prazo contratual e legal, com exportação antes da eliminação. | Sim | Pendente |  |

## B10.2 — Segurança reforçada

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-SEC-02 | Proteger sessões, senhas, tokens e integrações; política detalhada [A DEFINIR]. | Sim | Pendente |  |
| RNF-SEC-03 | Exigir confirmação adicional para ações críticas [A DEFINIR]. | Sim | Pendente |  |

## B10.3 — Backup, monitoramento e disponibilidade

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-BKP-01 | Realizar cópias e testar restauração; frequência, retenção, RPO e RTO [A DEFINIR]. | Sim | Pendente |  |
| RNF-AVL-01 | Meta de disponibilidade, manutenção e comunicação de incidente [A DEFINIR]. | Sim | Pendente |  |
| RNF-OBS-01 | Registrar falhas de integração, sincronização, processamento e tarefas sem expor dados pessoais desnecessários. |  | Pendente |  |
| PA-42 | Frequência e retenção de backup? — Sugestão do documento: definir RPO/RTO e testar restauração regularmente. | Sim | Pendente |  |

## B10.4 — Desempenho

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| RNF-PERF-01 | Tempos máximos de carregamento, sincronização e volume suportado estão [A DEFINIR]. | Sim | Pendente |  |
| PA-41 | Quais metas de desempenho e disponibilidade? — Sugestão do documento: definir a partir do piloto e do volume esperado. | Sim | Pendente |  |

## B10.5 — Piloto e homologação final

| ID | Item | Decisão? | Status | Evidência |
|---|---|---|---|---|
| PA-46 | Qual mercado será o piloto? — Sugestão do documento: uma unidade real com PDV conhecido, equipe disponível e volume controlável. | Sim | Pendente |  |
| CHK-01 | Checklist final (seção 11): Três áreas separadas e navegação coerente |  | Pendente |  |
| CHK-02 | Checklist final (seção 11): Usuário de uma empresa não acessa dados de outra |  | Pendente |  |
| CHK-03 | Checklist final (seção 11): Cada card abre só dados da própria unidade |  | Pendente |  |
| CHK-04 | Checklist final (seção 11): Todas as ações respeitam perfil e vínculo |  | Pendente |  |
| CHK-05 | Checklist final (seção 11): Embalagens e conversões preservam unidade base e histórico |  | Pendente |  |
| CHK-06 | Checklist final (seção 11): Depósito e gôndola com endereçamento e limites coerentes |  | Pendente |  |
| CHK-07 | Checklist final (seção 11): Contagem realmente cega e decisões alteram estoque corretamente |  | Pendente |  |
| CHK-08 | Checklist final (seção 11): Cada movimento com origem, destino, referência e auditoria |  | Pendente |  |
| CHK-09 | Checklist final (seção 11): Reposição registra horários, retirada, 3 tentativas, reposição e sobra |  | Pendente |  |
| CHK-10 | Checklist final (seção 11): Eventos duplicados do PDV não baixam estoque duas vezes |  | Pendente |  |
| CHK-11 | Checklist final (seção 11): Alertas 90/60/30, bloqueio e perdas rastreáveis |  | Pendente |  |
| CHK-12 | Checklist final (seção 11): Inclusão de mercado exige aceite e gera cálculo conferível |  | Pendente |  |
| CHK-13 | Checklist final (seção 11): Planos, testes, cupons, pagamentos e ações manuais com histórico |  | Pendente |  |
| CHK-14 | Checklist final (seção 11): Auditoria com antes/depois, usuário, mercado, dispositivo, horário e justificativa |  | Pendente |  |
| CHK-15 | Checklist final (seção 11): Perda de conexão não perde dados nem duplica |  | Pendente |  |
| CHK-16 | Checklist final (seção 11): Cada divergência entre sistema e documento registrada como item de trabalho |  | Pendente |  |
