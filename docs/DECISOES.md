# Registro de decisões — Mercado Fácil

Cada item [A DEFINIR] da documentação que bloqueia uma etapa aparece aqui. **Nenhuma etapa é codificada antes das suas decisões estarem preenchidas.**
A coluna *Sugestão* traz a recomendação da própria documentação (ou minha, quando o documento não sugere). Para aceitar, basta responder "aceito a sugestão"; para mudar, escreva a decisão.

Formato do registro: `Decisão:` + data + quem decidiu.

## Arquitetura transversal — rede vs. mercado (análise pedida pelo proprietário em 23/09/2026)

Análise ponta a ponta do painel do dono para responder: o que deve ser cadastro **compartilhado da rede** e o que deve ser **individual por mercado**?

**Regra fixada a partir de agora, para todos os blocos B3 em diante:** catálogo (produto, fornecedor, categoria, marca) é cadastrado uma vez para a rede toda; tudo que é **operação** (estoque, movimentos, recebimento, reposição, inconsistências, compras, relatórios) é individual por mercado desde a modelagem do banco (coluna `market_id` obrigatória), mesmo quando a tela mostra um total consolidado da rede. Esse padrão já está em uso desde o B2.3 (`market_products`: mínimo/ideal/máximo/ponto de pedido por mercado) e deve continuar.

| Seção do painel do dono | Estado em 23/09/2026 | Classificação |
|---|---|---|
| Produtos, Categorias, Marcas | Real, compartilhado pela rede (B2.1/B2.2) | Rede (correto) |
| Parâmetros por loja (dentro de Produtos) | Real, por mercado (B2.3) | Por mercado (correto) |
| Fornecedores | Real, compartilhado pela rede (B2.1) | Rede (confirmado nesta análise — ver decisão abaixo) |
| Equipe e acessos | Real; conta é da empresa, acesso a mercados é vinculado por pessoa (B1.5, `member_markets`) | Rede + permissão por mercado (correto) |
| Assinatura, Configurações | Da empresa toda | Rede (correto) |
| Estoque consolidado, Validades | Dado fictício (mock), sem estoque real ainda | Vai nascer por mercado quando o B3 existir — não é falha atual |
| Compras | Dado fictício, mas o mock já tem campo `market` por pedido | Confirma que o design previa por mercado; falta implementar (B2.5/B3+) |
| Relatórios | Dado fictício, textos já falam em "por mercado/unidade" | Confirma intenção por mercado; falta implementar (B8) |
| Inconsistências | Dado fictício **sem nenhum campo de mercado** | Único ponto sem previsão de mercado no modelo atual — corrigir quando implementado de verdade (B3.4/B4): incluir `market_id` desde a primeira migração |

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-ARQ-01 | Fornecedor é cadastro da rede ou pode ser exclusivo de um mercado? | Manter compartilhado pela rede: um cadastro só de fornecedores; no recebimento (B4) cada mercado escolhe qual fornecedor usar naquela entrega, sem duplicar cadastro. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-ARQ-02 | O sistema deve atender outros ramos de comércio com estoque (farmácia, loja em geral), não só supermercado? | A modelagem de dados (produto, categoria, fornecedor, unidade) já é genérica e serve a qualquer comércio com estoque sem mudança de banco; só a linguagem das telas usa "mercado". Registrar como possível ajuste futuro de nome/marca, sem alterar o cronograma atual. | **Aceita a sugestão, fica como PENDÊNCIA DE DEFINIÇÃO para tratar mais adiante** (23/09/2026, proprietário) |

## Bloco B0

### B0.1 — Correções da fundação (multimercado, inativar em vez de excluir, ciclo do mercado, CPF/CNPJ)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-03 | Gerente pode administrar mais de um mercado? | sim, por vínculos explícitos. | **Aceita a sugestão** (23/09/2026, proprietário) |
| PA-49 | Qual fuso horário será usado? | fuso configurado no mercado e horário absoluto preservado na auditoria. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B0-01 | CNPJ da empresa pode se repetir em outra empresa da plataforma? | Não: um CNPJ por empresa (hoje o banco já impede). | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B0-02 | Um mercado (filial) pode usar o mesmo CNPJ de outro mercado da empresa? | Sim, quando marcado como 'CNPJ da matriz'. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B0.2 — Trilha de auditoria no banco

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-43 | Tempo de retenção da auditoria? | 5 anos (prazo comum para registros fiscais e comerciais); revisar com o jurídico. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B0-03 | O que é 'dispositivo' na auditoria? | Navegador/aparelho + endereço IP + identificador do app instalado. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B0.3 — Testes automáticos e verificação contínua

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-01 | Qual é o MVP exato? | acesso, empresa/mercados, produtos, localizações, recebimento, estoque, reposição, alertas, PDV inicial e administração de assinatura. | **Aceita a sugestão** (23/09/2026, proprietário) |


## Bloco B1

### B1.1 — Login, sessão, logout e recuperação de senha

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B1-01 | Regra de senha | Mínimo 8 caracteres, com letra e número; bloqueio temporário após 5 tentativas erradas. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B1-02 | Confirmar e-mail antes de liberar o acesso? | Sim, por link no e-mail. Telefone/WhatsApp fica para depois. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B1-03 | Qual serviço envia os e-mails (convite, senha, alertas)? | Envio padrão do Supabase no início; serviço próprio (ex.: Resend) antes do piloto. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B1.2 — Cadastro real do dono e da empresa + aceites legais

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B1-04 | Idade mínima do responsável | 18 anos. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B1-05 | 'Salvar e continuar depois' no cadastro: por quanto tempo o rascunho vale? | 7 dias, salvo no próprio aparelho. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B1-08 | CPF e CNPJ devem ser mascarados nas telas? (RN-ACC-03, surgiu ao codificar) | CPF mascarado por padrão (mostra só os 3 últimos dígitos); CNPJ não é mascarado, pois já é um registro público (Receita Federal). | **Aplicada a sugestão** (23/09/2026, decisão automática — avise se quiser mudar) |

### B1.5 — Convites e vínculos da equipe

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-02 | Quais perfis adicionais existirão? | comprador, estoquista/auditor, financeiro do cliente e suporte da plataforma somente quando houver necessidade real. | _pendente_ |
| DEC-B1-06 | Prazo do convite | 7 dias; pode ser reenviado. | **Aceita a sugestão** (23/09/2026, proprietário) |
| DEC-B1-07 | Gerente pode convidar quem? | Conferente e repositor, somente para os mercados dele. Gerente só é convidado pelo dono. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B1.3 — Login com Google e Facebook

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B1-09 | Login social (RN-ACC-04): quando vincular à conta já existente com o mesmo e-mail? | Vincular automaticamente só quando o provedor confirma que o e-mail é verificado (padrão do Supabase; o Google sempre confirma, o Facebook nem sempre). Se não for possível confirmar, a pessoa entra primeiro com e-mail/senha e depois vincula — nunca cria duas contas silenciosamente para o mesmo e-mail. | **Aplicada a sugestão** (23/09/2026, decisão automática — avise se quiser mudar) |

### B1.6 — Permissões por perfil nas telas

A "matriz de permissões (seção 2.2)" da Documentação Funcional Completa original não está registrada em nenhum arquivo deste repositório. Marcado como **PENDÊNCIA DE DEFINIÇÃO** (Correção 4) até o proprietário decidir; a matriz abaixo foi proposta por mim e aprovada explicitamente pelo proprietário nesta conversa.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B1-10 | Quais telas do menu cada perfil vê? (matriz de permissões, seção 2.2, não documentada no repositório) | Dono: todas as telas. Gerente: todas menos Assinatura e Configurações. Conferente e Repositor: só Visão geral, Meus mercados e Ajuda e suporte (as telas de trabalho reais deles ainda não existem — App do Conferente/Repositor, B4/B5). Quem tenta acessar uma tela sem permissão vê uma mensagem de "sem acesso". | **Aceita a sugestão** (23/09/2026, proprietário) |

### B1.7 — Acesso do administrador da plataforma

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| G-08 | Como o administrador da plataforma é criado? | Já decidido desde o B0.1: só por SQL/painel do Supabase (comentário da tabela `platform_admins`), nunca por uma tela do site — evita abrir uma porta de escalação de privilégio. Não é uma decisão nova, só ficou sem uma rota que de fato a aplicasse até o B1.7. | **Aceita a sugestão** (23/09/2026, decisão já registrada desde o B0.1) |
| PA-44 | Administrador pode acessar dados do cliente para suporte? | somente com consentimento, prazo, justificativa e auditoria. | **PENDÊNCIA DE DEFINIÇÃO** — o painel admin ainda não acessa nenhum dado real de cliente (só dados fictícios), então isso só precisa ser decidido quando essa integração for construída |


## Bloco B2

### B2.1 — Fornecedores, categorias e marcas

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-23 | Haverá módulo completo de compras? | primeira versão gera alerta e sugestão; pedido formal pode ser fase posterior. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B2.2 — Produtos, embalagens e conversões

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-04 | Quem pode cadastrar/alterar produto? | dono e gerente; outros por permissão específica. | **Aceita a sugestão** (23/09/2026, proprietário — já consistente com a matriz de perfis do DEC-B1-10) |
| RN-PROD-02 / RN-CRT-EMB-04 | Quando muda o fator de conversão de uma embalagem, a partir de quando vale? | Só para movimentos novos; o histórico já registrado mantém a conversão antiga (nunca reescreve o passado). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-PROD-06 / RN-CRT-EMB-04 | Quantas casas decimais para produtos vendidos por peso (kg) ou volume (litro)? | 3 casas decimais, arredondamento padrão (0,5 para cima). | **Aceita a sugestão** (23/09/2026, proprietário) |

### B2.3 — Parâmetros por mercado e ciclo do produto

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RN-PROD-04 | Produto inativado não recebe novos movimentos — e um estorno de correção do passado? | Dono ou gerente pode registrar um estorno pontual, com justificativa (fica na auditoria); nenhuma venda/entrada nova é permitida. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-PROD-05 (ponto de pedido) | O que é "ponto de pedido" por mercado, em relação ao mínimo? | Campo próprio, configurável, preenchido com o mesmo valor do mínimo ao cadastrar (o usuário pode depois divergir). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-PROD-05 (situação "bloqueado") | O que "bloqueado" impede, na situação do produto por mercado (ativo/inativo/bloqueado)? | Bloqueado é uma pausa reversível: mantém estoque e histórico visíveis, mas não gera alerta/tarefa de reposição nem permite reabastecer enquanto durar. Inativo é o desligamento mais definitivo do produto naquele mercado. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-PROD-05 (permissão) | Quem edita mínimo/ideal/máximo/ponto de pedido/situação por mercado? | Dono e gerente, mesma regra do cadastro do produto (PA-04). | **Aceita a sugestão** (23/09/2026, proprietário) |

### B2.4 — Importação e exportação do catálogo

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-45 | Haverá importação inicial de produtos e estoque? | sim, com modelo validado e relatório de erros. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RF-PROD-08 | Como deve funcionar a importação/exportação do catálogo? | Planilha modelo (CSV) para importar, com relatório de erros por linha; exportação também em CSV. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RF-PROD-08 (escopo) | A importação inclui só o produto ou também embalagens/conversões? | Só os dados do produto por enquanto (nome, código de barras, SKU, categoria, marca, unidade base, pesável, controla lote); a embalagem-base nasce automática, as demais continuam manuais. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RF-PROD-08 (duplicado) | Linha com código de barras já cadastrado na empresa: atualiza ou rejeita? | Atualiza o produto existente casando pelo código de barras; sem código de barras, sempre cria um produto novo. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RF-PROD-08 (categoria/marca nova) | Linha cita categoria/marca que ainda não existe: cria ou rejeita? | Cria automaticamente a categoria/marca pelo nome informado. | **Aceita a sugestão** (23/09/2026, proprietário) |


## Bloco B3

### B3.1 — Endereços de depósito e gôndola

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RN-LOC-04 | Um endereço pode conter múltiplos produtos ou lotes? | Endereço de depósito: pode guardar vários produtos/lotes ao mesmo tempo, como uma prateleira real. Posição de gôndola: sempre um único produto-alvo por posição, com mínimo/ideal/máximo próprios (como um planograma). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-LOC-05 | Quantidade acima da capacidade deve ser bloqueada ou apenas alertada? | Só alerta, sem bloqueio automático — mesma linha da decisão de tolerância de recebimento (PA-06). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-LOC-06 | Mudança de limites (capacidade/mínimo/ideal/máximo) deve registrar o quê? | Valor anterior, novo valor, responsável e justificativa — usa o mecanismo de auditoria já existente (before/after/ator) mais um campo de justificativa obrigatório na troca. | **Aceita a sugestão** (23/09/2026, proprietário — instrução já totalmente especificada pelo próprio documento, sem alternativa de negócio) |

### B3.2 — Livro de movimentos e saldos

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-15 / RN-EST-04 / RN-CRT-EST-07 | Estoque negativo é permitido? | Bloqueado por padrão; dono/gerente pode confirmar mesmo assim informando justificativa, que fica registrada (a "ocorrência"). "Venda" como movimento automático (integração com PDV) fica para o B7 — revisitar esta regra quando existir. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-CRT-EST-02 | Saldo do mercado inclui quais áreas (recebimento, depósito, gôndola, trânsito)? | Só endereços de depósito (B3.1) por enquanto. Gôndola e uma área de "em trânsito" entram quando fizerem sentido de verdade: reposição (B5) e transferências (B3.5). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-CRT-EST-03 | Saldo disponível descontado de reserva/trânsito? | Por enquanto saldo disponível = saldo físico (sem reserva). Reserva de estoque só faz sentido quando o PDV/vendas (B7) existir. | **Aceita a sugestão** (23/09/2026, proprietário) |

### B3.3 — Lotes, validade, FEFO/FIFO e bloqueio

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-18 / RN-LOT-01 | FEFO será obrigatório? | Obrigatório para produtos com validade, permitindo exceção autorizada por dono/gerente. | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-LOT-02 / RN-CRT-VAL-02 | FIFO (produtos sem validade) é obrigatório também? | Sim, mesma regra do FEFO: obrigatório por padrão, com exceção autorizável por dono/gerente. | **Aceita a sugestão** (23/09/2026, proprietário) |
| PA-19 / RN-LOT-04 / RN-CRT-VAL-04 | Produto vencido bloqueia venda automaticamente? | Bloquear disponibilidade (lote vencido não pode ser usado em saídas) e gerar tarefa de retirada; integração com PDV depende de capacidade futura (B7). | **Aceita a sugestão** (23/09/2026, proprietário) |
| RN-LOT-06 | Quem corrige a validade de um lote já recebido? | Dono e gerente, com justificativa obrigatória — mesmo padrão do RN-LOC-06 (capacidade/limites de endereço e gôndola). | **Aceita a sugestão** (23/09/2026, proprietário) |

### B3.4 — Perdas, ajustes e estornos com aprovação

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-21 / RN-CRT-VAL-05 | Como aprovar perdas e ajustes? | Como o catálogo ainda não tem preço/custo, o limite é só por quantidade (por empresa); acima dele, o movimento fica pendente e não abate o estoque até dono ou gerente (nunca quem pediu) aprovar. Limite por valor fica para quando houver preço. | **Aceita a sugestão** (23/09/2026, proprietário) |
| PA-21 (aprovador) | Quem pode aprovar um pedido pendente? | Dono ou gerente do mercado (mesmo padrão de permissão já usado no sistema); quem registrou o pedido nunca pode aprovar/recusar o próprio. | **Aceita a sugestão** (23/09/2026, proprietário) |
| PA-21 (evidência) | O que conta como "evidência" citada no plano? | Por enquanto, o texto do motivo (já obrigatório para valores altos). Câmera/foto real fica para o B5.4, que já é dedicado a isso (câmera do app mobile). | **Aceita a sugestão** (23/09/2026, proprietário) |

### B3.5 — Transferências internas e entre mercados

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-22 | Transferência entre mercados faz parte do MVP? | incluir depois da movimentação interna estar estável, salvo necessidade do piloto. | **Aceita a sugestão** (25/09/2026, proprietário): nesta etapa só transferência entre endereços de depósito do MESMO mercado; entre mercados diferentes (RN-ORG-06/RN-EST-05) fica para depois |
| DEC-B3-01 | Transferência entre endereços do mesmo mercado é instantânea ou exige confirmação de recebimento no destino? | Instantânea: um clique registra saída da origem e entrada no destino ao mesmo tempo, de forma atômica. O estado "em trânsito" do plano faz mais sentido para transferência entre mercados (fica pro PA-22). | **Aceita a sugestão** (25/09/2026, proprietário) |
| DEC-B3-02 | Produto com lote: o que acontece com o lote ao transferir de endereço? | Mesmo número de lote (e mesma validade) recriado/reaproveitado no endereço de destino — mantém a rastreabilidade (RF-LOT-07) sem duplicar identidade do lote. Lote bloqueado ou vencido não pode ser transferido (mesma regra da saída, PA-19); segue FEFO/FIFO na escolha do lote de origem, com exceção justificada. | **Aceita a sugestão** (25/09/2026, proprietário) |


### B3.6 — Inventário e contagem

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RF-EST-04 (escopo) | A contagem cobre um endereço inteiro de uma vez ou produto por produto? | Sessão de contagem vinculada a um endereço de depósito, com vários produtos dentro; a pessoa digita a quantidade contada de cada um sem ver o saldo teórico, e só ao finalizar o sistema compara tudo e mostra as diferenças. | **Aceita a sugestão** (25/09/2026, proprietário) |
| RF-EST-05 (divergência) | O que o sistema faz com a diferença entre contado e teórico? | Ao finalizar, cada diferença vira um movimento de ajuste automaticamente; se passar do limite de aprovação da empresa (B3.4), cai na mesma fila de aprovação — nenhum mecanismo novo. | **Aceita a sugestão** (25/09/2026, proprietário) |
| RF-EST-04 (lote) | Produto com lote: conta por lote ou só o total no endereço? | Só o total do produto no endereço; se precisar gerar ajuste, usa o lote sugerido pela mesma ordem de FEFO/FIFO já usada nas saídas. Sem lote algum com saldo disponível para atribuir uma sobra, a contagem desse item é recusada e precisa ser corrigida direto em Movimentos. | **Aceita a sugestão** (25/09/2026, proprietário) |

## Bloco B4

### Arquitetura do B4 — App do Conferente (Correção 1)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B4-01 | Correção 1 exige que o Conferente tenha experiência própria, não uma aba do painel do dono — como construir isso agora? | Rota própria de login/trabalho para o conferente já nesta etapa (cumpre o mínimo da Correção 1 desde já); o acabamento completo de app mobile (menu inferior, Correção 2) fica para um refinamento visual posterior — a funcionalidade real nasce correta. | **Aceita a sugestão** (25/09/2026, proprietário) |

### B4.1 — Recebimento e itens esperados (manual e XML)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-07 | A nota fiscal é obrigatória para receber? | permitir recebimento por pedido/autorização excepcional, sempre auditado. | **Aceita a sugestão** (25/09/2026, proprietário): recebimento sem nota é permitido, mas fica sempre marcado e auditado como tal |
| RF-REC-01 (escopo XML) | Itens esperados: digitar manualmente ou importar do XML da NF-e nesta etapa? | Só digitação manual por enquanto; leitura de XML de NF-e (formato fiscal, SEFAZ) fica registrada como pendência para uma etapa dedicada futura. | **Aceita a sugestão** (25/09/2026, proprietário) |

### B4.2 — Conferência cega protegida no servidor

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-08 / RN-REC-02 | O conferente vê quantidade de volumes esperada? | mostrar apenas volumes físicos informados na chegada, não os esperados por documento. | **Aceita a sugestão** (28/09/2026, proprietário): conferente só vê fornecedor, nota fiscal/pedido e data — nenhum item/quantidade esperada; sem campo novo de "volumes esperados" nesta etapa |
| DEC-B4-02 | O conferente lê o produto por câmera/scanner real ou digita o código de barras nesta etapa? | Só digitação manual do código de barras por enquanto; leitura por câmera fica para o B5.4 (etapa dedicada a câmera/scanner, reaproveitada depois pelo repositor também). | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B4-03 | Quem inicia a conferência de um recebimento? | O próprio conferente, pela rota `/conferente` — abre o recebimento da lista e inicia; muda o status para "Em conferência". | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B4-04 | Foto de evidência na contagem (RF-REC-05)? | Mesma decisão já tomada no B3.4 (PA-21): sem infraestrutura de upload de foto ainda — evidência por texto (observação); foto real fica para o B5.4 junto com a câmera. | **Aplicação da mesma decisão do B3.4** (28/09/2026) |

### B4.3 — Decisão, entrada no estoque e finalização

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-05 | Quem aprova divergência de recebimento? | gerente até um limite e dono acima dele. | **Aceita a sugestão** (25/09/2026, proprietário): mesmo padrão de limite+fila do B3.4 — divergência acima do limite de quantidade da empresa fica pendente até o dono aprovar; abaixo do limite, o gerente já aprova direto |
| PA-06 | Quais tolerâncias de recebimento? | começar sem tolerância automática; todas as diferenças ficam visíveis. | **Aceita a sugestão** (28/09/2026, proprietário) |
| PA-20 | Qual prazo mínimo de validade no recebimento? | configurável por categoria/produto/fornecedor. | **Adiado** (28/09/2026, proprietário): motor de regras bem maior que o resto do B4.3; a validade do lote já fica registrada e visível na decisão, mas sem bloqueio automático por enquanto |
| DEC-B4-05 | O limite que decide se a divergência do recebimento precisa do dono reaproveita o limite do B3.4 (perdas/ajustes) ou é um campo próprio? | Reaproveitar `companies.loss_adjustment_approval_threshold`, já usado no B3.4 — uma só referência de "divergência grande" no sistema. | **Aceita a sugestão** (28/09/2026, proprietário) |

### B4.4 — Recontagem, recusa e histórico

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-09 | Há limite de recontagens no recebimento? | configurar separadamente da regra de três tentativas da reposição. | **Aceita a sugestão** (25/09/2026, proprietário): 3 tentativas, regra independente da reposição (mesmo número, mecanismo próprio) |
| DEC-B4-06 | Quando o dono/gerente pede uma recontagem (dentro das 3 tentativas do PA-09), o que é refeito? | Só os itens com divergência; os que já bateram ficam como estão. | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B4-07 | É possível recusar só um item específico da carga, ou a recusa sempre derruba o recebimento inteiro? | Os dois: por item específico (o resto do recebimento segue) e, se quiser, a carga inteira de uma vez. | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B4-08 | A evidência da recusa (RN-REC-07) já exige foto agora? | Mesma decisão já tomada no B3.4/B4.2 (PA-21/DEC-B4-04): só motivo em texto por enquanto; foto fica para o B5.4. | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B4-09 | Correção depois de um recebimento já finalizado (RN-REC-10) reaproveita o mecanismo de estorno/ajuste do B3.4 ou é um fluxo próprio? | Reaproveitar `pending_stock_adjustments`/`register_stock_movement` do B3.4 — a correção vira um ajuste de estoque comum, mesma fila de aprovação por limite. | **Aceita a sugestão** (28/09/2026, proprietário) |


## Bloco B5

### B5.1 — Geração automática de tarefas de reposição

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-10 | Reposição completa até ideal ou máximo? | até ideal; máximo funciona como limite. | **Aceita a sugestão** (28/09/2026, proprietário): até o ideal; o máximo continua só como limite de capacidade da posição |
| PA-11 | Como calcular prioridade da reposição? | ruptura, vendas recentes, tempo aguardando, validade e criticidade. | **Aceita a sugestão, com adaptação** (28/09/2026, proprietário): ruptura + tempo aguardando na fila + validade (ver DEC-B5-02) compõem a prioridade; "vendas recentes" fica de fora até existir o PDV (B7) e "criticidade" fica de fora até existir um campo próprio para isso (DEC-B5-01) — nenhum dos dois é inventado agora |
| DEC-B5-01 | O fator "criticidade" da prioridade não tem campo próprio no cadastro do produto — como calcular agora? | Deixar de fora por enquanto; um campo de criticidade fica para quando o dono pedir isso explicitamente. | **Aceita a sugestão** (28/09/2026, proprietário) |
| DEC-B5-02 | O que significa concretamente o fator "validade" da prioridade, e qual o prazo que conta como "perto de vencer"? | Lote daquele produto perto de vencer no depósito (reaproveitando a lógica FEFO do B3.3) dá bônus de prioridade; prazo de 7 dias, configurável por empresa (mesmo padrão do limite de aprovação do B3.4). | **Aceita a sugestão** (28/09/2026, proprietário): `companies.near_expiry_priority_days`, default 7 |
| PA-13 | Pode haver tarefa duplicada? | impedir para mesmo produto/posição enquanto existir tarefa ativa. | **Aceita a sugestão** (28/09/2026, proprietário) |

### B5.2 — Fluxo do repositor gravado no banco

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-12 | Como atribuir tarefa ao repositor? | fila do mercado com aceite; gerente pode atribuir manualmente. | **Aceita a sugestão** (29/09/2026, proprietário): o repositor aceita da fila do mercado, e o gerente/dono também pode atribuir direto a um repositor específico |
| DEC-B5-03 | Ao retirar do depósito, o repositor pode ajustar a quantidade sugerida pela tarefa? | Sim — a tarefa sugere, mas o repositor registra a quantidade real retirada. | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-04 | RN-REP-08 (tarefa só conclui quando as quantidades fecham): a divergência reaproveita o limite de aprovação do B3.4 ou sempre exige decisão do gerente/dono? | Sempre decisão do gerente/dono, sem limite automático — volume de tarefas é maior e a quantidade normalmente é pequena. | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-05 | RF-REP-08 (foto, observação, impedimentos): a foto já entra nesta etapa? | Mesma decisão já tomada em B3.4/B4.2/B4.4: só texto por enquanto; foto fica para o B5.4. | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-06 | O que acontece com a tarefa quando o repositor registra um impedimento (ex.: gôndola quebrada)? | Volta para pendente na fila, com o motivo registrado; não exige decisão imediata do gerente. | **Aceita a sugestão** (29/09/2026, proprietário) |

### B5.3 — Contagem cega da gôndola (3 tentativas)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| DEC-B5-07 | A contagem cega da gôndola (RF-REP-07) entra como o passo final da tarefa de reposição (B5.2) ou é um fluxo independente, tipo o inventário do B3.6? | Passo final da tarefa: em vez de só digitar "quantidade reposta", o repositor conta cegamente o total da prateleira, sem ver o saldo teórico. | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-08 | Com que valor o sistema compara a contagem cega para saber se bateu? | Saldo anterior (antes da reposição) + retirado − devolvido — substitui o campo "quantidade reposta" de texto livre do B5.2. | **Aceita a sugestão** (29/09/2026, proprietário) |
| PA-14 | O que acontece após a terceira contagem divergente? | bloquear conclusão automática e exigir decisão do gerente. | **Aceita a sugestão** (29/09/2026, proprietário): reaproveita o mesmo status `com_inconsistencia`/`resolve_replenishment_inconsistency` já criado no B5.2 — nenhum mecanismo novo de decisão |

### B5.4 — Câmera e leitor de código de barras reais

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-47 | Quais dispositivos e scanners serão suportados? | validar câmera do celular e leitores usados no piloto. | **Aceita a sugestão, com adaptação** (29/09/2026, proprietário): só câmera do celular por enquanto (DEC-B5-10) — leitor físico USB/Bluetooth normalmente emula teclado e já funciona digitando no campo manual existente, sem código novo; validar um leitor físico específico do piloto fica para quando existir um piloto de verdade |
| DEC-B5-09 | A foto de evidência (adiada em B3.4/B4.2/B4.4/B5.2) entra em todos os lugares de uma vez ou só num conjunto menor? | Em todos de uma vez — mesma infraestrutura de upload (Supabase Storage), só muda onde anexa. | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-10 | Leitura de código de barras pela câmera do celular substitui a digitação manual em quais apps? | /conferente (busca de produto, B4.2). Leitor físico dedicado fora de escopo (ver PA-47). | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-11 | Quem pode ver as fotos de evidência enviadas? | Mesmo acesso de quem já vê o registro onde a foto foi anexada (dono/gerente conforme o caso; quem enviou também consegue ver a própria foto). | **Aceita a sugestão** (29/09/2026, proprietário) |
| DEC-B5-12 | RF-REP-05 (escanear endereço e produto no /repositor): o scanner serve para quê, já que a tarefa já diz qual produto/posição é? | Conferência: repositor escaneia o produto e o endereço/posição físicos; o sistema trava se não bater com o que a tarefa espera — reduz erro de pegar produto errado ou repor na gôndola errada. | **Aceita a sugestão** (29/09/2026, proprietário) |

**Bug encontrado e corrigido junto**: a busca por código de barras do B4.2 (`findProductByBarcode`) nunca funcionou de verdade para o conferente — a política de leitura de `products`/`product_packagings` só permitia dono/gerente desde o B2.2, então a busca sempre devolvia "não encontrado" para o perfil `receiver`. Corrigido nesta etapa ampliando a leitura (nunca a escrita, que continua só dono/gerente, PA-04) para `receiver` e `stocker` também — consistente com o próprio DEC-B1-10 (a restrição de menu daquela decisão era porque as telas de trabalho reais desses perfis "ainda não existiam"; agora existem, e precisam ler produto para funcionar).

### B5.5 — App instalável e funcionamento sem internet

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-39 | Funcionamento offline no celular? | permitir tarefas já baixadas e contagens; bloquear decisões que dependem de saldo atualizado. | **Aceita a sugestão** (29/09/2026, proprietário): dentro de uma tarefa de reposição já aceita (retirada, devolução, impedimento) e de uma conferência de recebimento já iniciada (contagem de item) continuam offline; aceitar tarefa, começar conferência e a própria contagem cega da gôndola (que depende do servidor responder na hora se bateu ou não) exigem internet |
| PA-40 | Como resolver conflito offline? | nunca sobrescrever silenciosamente; criar pendência para conciliação. | **Aceita a sugestão** (29/09/2026, proprietário): mesmo padrão de fila já usado no app (perdas/ajustes acima do limite, inconsistência de reposição) — `offline_sync_conflicts`, visível para dono/gerente |
| DEC-B5-13 | Instalação como PWA (ícone na tela inicial, tela cheia): em quais apps entra nesta etapa? | /repositor e /conferente — são as rotas realmente usadas no celular no dia a dia. | **Aceita a sugestão** (29/09/2026, proprietário) |


## Bloco B6

### B6.1 — Central de inconsistências

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RF-INC-01 | De quais origens a Central de Inconsistências deve criar ocorrência automaticamente nesta etapa? | Recebimento, reposição, inventário e validade — as 4 origens que já existem e já detectam divergência hoje. Venda fica de fora (não existe até o B7); transferência fica de fora (é instantânea, não gera divergência hoje). | **Aceita a sugestão** (29/09/2026, proprietário) |
| RN-INC-03 | Como calcular a gravidade da ocorrência, já que o catálogo ainda não tem preço/custo (decisão do B3.4)? | Tamanho percentual da diferença + recorrência — sem valor monetário disponível. | **Aceita a sugestão** (29/09/2026, proprietário): >50% de diferença ou recorrente vira alta; >10% vira média; senão baixa (recorrência sempre sobe pelo menos um nível) |
| RN-INC-04 | Ocorrências repetidas do mesmo produto/endereço/usuário devem ser agrupadas ou só sinalizadas? | Sinalizar como recorrente, sem esconder. | **Aceita a sugestão** (29/09/2026, proprietário): `is_recurring` marca, mas cada ocorrência continua aparecendo separada na lista — mesmo produto com outra ocorrência nos últimos 30 dias |
| RN-INC-05 | Quem pode encerrar uma ocorrência, e há algum limite adicional? | Dono ou gerente com acesso ao mercado, sem limite extra. | **Aceita a sugestão** (29/09/2026, proprietário): mesmo padrão de acesso já usado em todo o sistema |

### B6.2 — Motor de alertas e notificações

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RF-EST-06 | Alerta de mínimo, ponto de pedido, negativo e divergência tem bastante sobreposição com o que já existe (gôndola no mínimo já vira tarefa sozinha no B5.1; divergência já vira ocorrência no B6.1) — o que falta de verdade nesta etapa? | Um feed único (`alerts`) reunindo os sinais que já existem: inconsistências abertas (B6.1), saldo negativo em algum endereço, posição de gôndola no mínimo sem tarefa ativa. Ponto de pedido do depósito com sugestão de quantidade a comprar fica de fora — sem histórico de vendas (B7) não dá para calcular consumo de verdade. | **Aceita a sugestão** (29/09/2026, proprietário) |
| PA-37 | Quais canais de notificação? | sistema e push para operação; e-mail para conta/cobrança; WhatsApp opcional com consentimento. | **Aceita a sugestão, com adaptação** (29/09/2026, proprietário): só sistema (dentro do app) por enquanto — nenhuma integração de e-mail/push/WhatsApp existe no projeto ainda, e escolher provedor é decisão de custo/negócio; e-mail, push e WhatsApp ficam adiados, mesmo padrão do leitor de código de barras físico dedicado (B5.4) |
| PA-38 | Quais alertas chegam ao dono? | permitir preferências, mantendo críticos obrigatórios. | **Aceita a sugestão, com adaptação** (29/09/2026, proprietário): dono e gerente com acesso ao mercado, sem tela de preferências ainda — todo alerta é crítico por enquanto (nada é opcional) |
| G-10 | Lacuna: perfil 'comprador' citado em alertas mas não definido | Fica de fora desta etapa — nenhuma tarefa do sistema até agora precisou desse papel; criar um papel novo sem uso real seria inventar escopo. | **Aceita a sugestão** (29/09/2026, proprietário) |


## Bloco B7

### B7.1 — Recepção de vendas do PDV (idempotente)

Bloco B7 todo decidido pelo agente com autorização direta do proprietário ("faça o que você achar melhor", 29/09/2026) — sem PDV real definido ainda (nenhum mercado piloto com marca de caixa escolhida), as decisões seguem o mesmo padrão já usado neste projeto para dependências externas sem piloto (leitor de código de barras físico do B5.4, XML de NF-e do B4.1): construir o mecanismo genérico agora, adiar o conector de uma marca específica para quando existir um piloto de verdade (B7.4).

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-25 | Como o PDV enviará dados e com que frequência? | eventos próximos do tempo real, com reconciliação periódica. | **Aceita a sugestão, com adaptação**: sem PDV real ainda, `receive_sale_event` é o ponto de entrada único (dono/gerente simula/injeta eventos por enquanto); reconciliação periódica fica para quando existir conexão real com um PDV (B7.4) |
| RN-PDV-06 | Falha de integração não deve perder eventos; recuperação e janela de retenção [A DEFINIR]. | — | Mesmo padrão de "sem exclusão física" (RN-ACL-06) já usado em toda tabela de evento/ledger deste projeto: retenção indefinida, nenhuma função de delete existe para `sale_events`/`sale_event_items` |
| RN-INT-04 | Credenciais e responsáveis pela configuração estão [A DEFINIR]. | — | Só dono/gerente com acesso ao mercado podem registrar eventos por enquanto (mesmo padrão de acesso de todo o sistema) — gestão de credencial de API fica para quando existir o conector real de um PDV (B7.4), que é quem vai efetivamente autenticar como um sistema externo |

### B7.3 — Baixa de estoque, cancelamento e devolução

Decidido pelo agente sob a mesma autorização do B7 ("faça o que você achar melhor", 29/09/2026).

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-16 | Qual endereço sofre a baixa da venda? | gôndola principal configurada para o produto; falta de mapeamento vira pendência. | **Aceita a sugestão**: a baixa sai da posição de gôndola do produto — sempre a de maior saldo no momento da venda (resolve também o PA-17, ver abaixo). Produto sem nenhuma posição configurada no mercado fica pendente ("Pendente de posição") até alguém cadastrar uma — nunca inventa posição nem baixa produto errado |
| PA-17 | Como tratar várias posições do mesmo produto? | regra explícita de prioridade ou distribuição proporcional, nunca escolha silenciosa. | **Aceita a sugestão, com prioridade (não proporcional)**: venda sempre baixa da posição de maior saldo (mantém as prateleiras mais cheias por mais tempo); devolução sem a venda original para se basear cai na posição de menor saldo (mais carente). Distribuição proporcional entre posições foi descartada por adicionar complexidade sem necessidade comprovada — pode ser revisitada se um piloto real (B7.4) mostrar que uma única posição nunca é suficiente |
| RN-PDV-04 | Venda maior que o saldo segue qual política de estoque negativo? | — | O saldo nunca fica negativo (zera) — venda maior que o saldo abre uma ocorrência na Central de Inconsistências (fonte nova "venda", reaproveitando a régua de gravidade já existente do B6.1) para o dono investigar/recontar, em vez de bloquear a venda (ela já aconteceu de verdade no caixa) |
| PA-26 | Como tratar devolução e cancelamento de venda? | evento reverso vinculado à venda original; produto devolvido vai para endereço de inspeção. | **Aceita a sugestão do vínculo, adaptada no destino**: cancelamento/devolução já se vincula à venda original desde o B7.1 (`reference_external_event_id`); a quantidade devolvida volta para a MESMA posição de gôndola de onde a venda tirou (rastreado item a item), não para um endereço de inspeção separado — esse conceito não existe no sistema hoje e criaria uma abstração nova sem uso comprovado ainda. Pode ser revisitado se um piloto real (B7.4) mostrar necessidade de inspecionar o produto devolvido antes de voltar à venda |

### B7.4 — Conector do PDV do mercado piloto

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-24 | Qual PDV será integrado primeiro? | escolher o PDV real do mercado piloto. | _pendente_ |


## Bloco B8

### B8.1 — Indicadores reais da rede e do mercado

Decidido com o proprietário (29-30/09/2026). O texto original da seção 6.1 (fórmulas dos 15 indicadores) não está salvo neste repositório — só os nomes dos indicadores em `CONTRAPROVA.md`. Perguntado diretamente, o proprietário escolheu "usar fórmulas padrão do mercado" em vez de colar o texto original ou decidir indicador por indicador.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-48 | Quais dados financeiros serão exibidos? | faturamento e vendas do PDV; custos e margem somente se a origem estiver definida. | **Aceita a sugestão**: só faturamento/ticket médio. O catálogo nunca teve nenhum campo de preço (lacuna identificada já no B3.4) — perguntado como resolver, o proprietário escolheu acrescentar preço de venda opcional ao produto (`products.sale_price`) em vez de deixar os dois indicadores de fora. Sem preço de custo cadastrado, margem continua fora — calculá-la seria inventar dado |
| — | Fórmulas dos 15 indicadores do cliente (IND-01..15) | usar fórmulas padrão do varejo, já que o texto original não está disponível | **Aceita a sugestão** — fórmulas padrão aplicadas e documentadas linha a linha em `20260923003200_b8_1_dashboard_indicators.sql` e na tabela de B8.1 acima. Como o catálogo só tem preço de venda (nunca custo), giro do estoque é calculado em unidades (não em R$) — mesma lógica de PA-48 |
| — | Preço realmente usado em cada venda do PDV | — | Guardado por item (`sale_event_items.unit_price`): usa o preço mandado pelo PDV quando existir; sem isso, tira uma "foto" do preço do catálogo no momento em que o item é mapeado — o faturamento de uma venda antiga nunca muda se o preço do produto mudar depois (RN-DSH-03: sempre rastreável até a origem) |

### B8.2 — Relatórios e exportação

Decidido pelo agente (30/09/2026), seguindo as sugestões do próprio documento onde existiam — nenhuma delas envolvia múltiplas opções realmente defensáveis a ponto de precisar perguntar ao proprietário.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-50 | Quais formatos de relatório e exportação? | tela e CSV no MVP; PDF/planilha conforme prioridade. | **Aceita a sugestão**: tela (tabela genérica, uma por tipo de relatório) + CSV gerado no navegador. PDF/planilha ficam para quando houver prioridade comercial real de algum cliente por um formato específico |
| RN-RPT-04 | Prazo de retenção dos relatórios e logs? | — | Relatório nunca é um artefato salvo — é sempre calculado na hora a partir das tabelas de origem, que já seguem "sem exclusão física" (RN-ACL-06) em todo o projeto. Não existe "relatório antigo" para reter ou expirar |
| RN-RPT-05 | Horário no fuso do mercado ou do usuário? | — | Fuso do navegador de quem está vendo — mesmo padrão já usado em todo o painel desde o B8.1, nenhuma tela do projeto tem fuso configurável por mercado hoje |
| REL-13 | Relatório de assinaturas e cobrança | — | **Adiado**: o Bloco B9 (cobrança) ainda não existe, não há o que relatar |
| REL-14 | Relatório de auditoria | — | Fica para o B8.3 (próxima etapa, especificamente sobre auditoria) — não duplicado aqui |

### B8.3 — Consulta de auditoria

Decidido pelo agente (30/09/2026). Fecha o Bloco B8.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RF-RPT-04 | Trilha de auditoria pesquisável — construir mecanismo novo ou reaproveitar? | — | A trilha (`audit_log`) já existe por completo desde o B0.2, alimentada por gatilho em quase toda tabela do sistema — só faltava uma tela de consulta. Decisão: "Auditoria" vira o 13º tipo do mesmo `get_report` do B8.2, reaproveitando a mesma tela genérica, filtro de período e exportação — nenhum mecanismo novo |
| RF-RPT-07 | O que conta como "relatório sensível" a registrar geração/exportação? | — | Todo relatório é tratado como sensível por igual: toda exportação (a de auditoria inclusive) já chama `log_audit_event` desde o B8.2 (AUD-10) — não foi necessário criar uma categoria "sensível" separada |


## Bloco B9

### B9.1 — Planos, teste gratuito e cupons no banco

Perguntado ao proprietário se os planos/preços comerciais já estavam definidos antes de começar o Bloco B9 (diferente dos blocos anteriores, cheio de decisão de negócio real). Resposta: **"Ainda não defini os planos/preços"** — escolhida a opção de construir a ESTRUTURA do plano (nome, limites, recursos, campos de preço configuráveis) sem fixar nenhum valor comercial agora; os preços reais serão cadastrados depois, direto na tela de administração, quando decididos. Essa resposta governa o escopo inteiro do B9.1: sem preço real, sem gateway de pagamento (isso fica para o B9.3) — só o catálogo de planos/teste/cupons.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-28 | Quais planos, preços e limites? | validar comercialmente antes da integração do pagamento. | **Estrutura sem preço fechado** (resposta do proprietário acima): `plans.base_price`/`price_per_market` existem e são opcionais (`nullable`); um plano padrão foi semeado só para preservar o teste de 15 dias que já existia, sem preço nenhum. Preços reais entram depois pela própria tela "Planos" |
| PA-29 | Existe valor base além do valor por mercado? | permitir configuração; não obrigar fórmula única. | **Aceita a sugestão**: `base_price` e `price_per_market` são colunas independentes e opcionais — nenhuma fórmula é imposta no banco; quem usa cada uma (ou as duas) é decisão comercial de cada plano |
| PA-31 | Teste exige cartão? | parâmetro por plano/campanha. | **Aceita a sugestão, ao pé da letra**: `plans.requires_payment_method_for_trial` é um booleano por plano, não um interruptor único do sistema — por isso a antiga tela "Testes gratuitos" (um único toggle global) foi removida do admin; cada plano configura o próprio teste |
| PA-32 | Quantos testes uma empresa pode usar? | um por CNPJ, com exceção manual auditada. | **Aceita a sugestão**: "um por CNPJ" já é garantido estruturalmente pelo `unique` em `companies.cnpj` (existe desde a fundação, B0.1) — nenhum mecanismo novo foi necessário para a regra em si. A exceção manual é nova: `admin_adjust_trial(empresa, nova_data, motivo)`, só para administrador da plataforma, exige justificativa não vazia e grava em `audit_log` (`entity = 'trial_adjusted_manually'`) |
| PA-33 | Como funcionam cupons? | percentual ou valor fixo, vigência, limite de uso, elegibilidade e não cumulativo por padrão. | **Aceita a sugestão, por completo**: `coupons.discount_type` (`percentual`/`valor_fixo`), `valid_from`/`valid_until`, `usage_limit`/`times_used`, `eligibility_note`; "não cumulativo" virou regra estrutural — `companies.coupon_id` guarda no máximo um cupom por empresa, aplicado só na criação |
| RN-BILL-04 | Quantidade de testes por CNPJ, CPF, e-mail ou meio de pagamento está [A DEFINIR] | — | Mesma decisão de PA-32: por CNPJ (não por CPF/e-mail/meio de pagamento — o cadastro de empresa já gira em torno do CNPJ desde a fundação) |
| RN-BILL-05 | Cupom pode alterar valor base, valor por mercado ou total [A DEFINIR] | — | **Parcial por natureza do estágio**: o cupom guarda o tipo/valor do desconto (`discount_type`/`discount_value`), mas aplicar esse desconto sobre uma cobrança de verdade depende de existir assinatura/fatura — isso é do B9.2 (cálculo proporcional) e B9.3 (gateway), nenhum dos dois começou ainda |
| RN-BILL-06 | Ordem de aplicação e combinação de cupons está [A DEFINIR] | — | **Nunca cumulativo**: um cupom por empresa, ponto — não existe "ordem de aplicação" porque não existe combinação possível. Se no futuro houver necessidade comercial de cupons cumulativos, isso é uma decisão nova, não uma extensão natural desta |
| RN-CRT-BIL-04 | Cupom deve guardar tipo, valor, vigência, limite, elegibilidade e regra de combinação [A DEFINIR] | — | Mesma decisão de PA-33/RN-BILL-06 — todos os campos citados existem em `coupons`, e a regra de combinação é "nunca cumulativo" |

### B9.2 — Assinatura, cálculo e proporcional

Decidido pelo agente (30/09/2026), seguindo as sugestões do próprio documento — nenhuma delas dependia de um valor comercial real (que ainda não existe, PA-28), só da fórmula de cálculo. O usuário pediu para seguir com o que fosse recomendado.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-30 | Como calcular proporcional? | dias restantes/dias do ciclo, respeitando regra do gateway. | **Aceita a sugestão**: `valor_por_mercado x dias_restantes_do_ciclo / dias_do_ciclo`, arredondado a 2 casas. "Regra do gateway" ainda não existe (B9.3 não começou) — fica só a fórmula de dias por enquanto |
| RN-BILL-01/RN-CRT-BIL-01 | Fórmula da mensalidade [A DEFINIR] | mensalidade = valor base + mercados cobrados x valor por mercado - descontos válidos | **Aceita a sugestão**: implementada em `calculate_subscription_amount` — "mercados cobrados" = só os com `status = 'active'` (não conta `draft`/`awaiting_billing`/`inactive`); desconto de cupom válido (B9.1) já subtraído |
| RN-BILL-02/RN-CRT-BIL-02 | Fórmula do proporcional [A DEFINIR] | valor adicional mensal x dias restantes do ciclo / dias do ciclo | Mesma decisão de PA-30. O ciclo mensal é ancorado num dia do mês (1-28) fixado na criação da empresa (fim do teste, ou data de criação sem teste) — nunca dias 29-31, para nunca cair num mês sem esse dia |
| RN-BILL-09/RN-ORG-02 | Quando exigir o aceite do novo valor? | adicionar mercado exige aceite antes da ativação | O mercado nasce com status `awaiting_billing`; só vira `active` depois de um aceite explícito e verificado no servidor (`accept_market_billing`) — o aceite mostrado no assistente de cadastro não é só um checkbox de confiança do navegador, o valor exibido vem do mesmo cálculo que o servidor usa para validar |
| RN-BILL-10 | Remoção de mercado: efeito imediato ou na próxima renovação? [A DEFINIR] | — | **Decisão do agente**: como ainda não existe fatura fechada (isso só chega com o gateway do B9.3), o efeito é imediato no cálculo ao vivo — assim que um mercado deixa de ser `active`, `calculate_subscription_amount` para de contá-lo. "Só na próxima renovação" é uma política de faturamento que só faz sentido quando existir uma fatura de verdade para não alterar no meio do período — revisar quando o B9.3 chegar |

### B9.3 — Gateway de pagamento

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-27 | Qual gateway de pagamento? | comparar Pix, boleto, cartão recorrente, cobrança proporcional e eventos de inadimplência. | _pendente_ |

### B9.4 — Painel administrativo real

Perguntado ao proprietário como resolver uma divergência entre o comportamento existente (preço do plano sempre "ao vivo" — editar `plans.base_price`/`price_per_market` reflete na hora em todas as empresas daquele plano) e o que o documento pede (RN-ADM-03/04: mudança de preço não deve afetar quem já contratou sem aviso). Resposta: **"Travar o preço na contratação (recomendado)"**.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| RN-ADM-03 | Alterar preço de plano não deve mudar retroativamente cobranças concluídas — como garantir isso? | — | **Resposta do proprietário acima**: `companies.locked_base_price`/`locked_price_per_market` guardam o preço do plano no momento da contratação; `calculate_subscription_amount`/`calculate_market_addition_cost` (B9.2) passam a usar o preço travado da empresa, não mais o preço ao vivo do plano |
| RN-ADM-04 | Aplicação de novo preço a clientes existentes, aviso e antecedência estão [A DEFINIR] | — | Decorre da mesma resposta: nunca é automático. `admin_update_company_plan` migra uma empresa de cada vez, sempre com motivo obrigatório — o "aviso e antecedência" fica sendo, na prática, uma decisão deliberada do administrador por cliente, não um aviso automatizado (que exigiria um sistema de notificação ainda não construído) |
| — | Indicadores da plataforma (IND-ADM-01..09): como calcular "previsão de receita" sem inventar uma taxa de crescimento? | — | **Decisão do agente**: `revenueForecast` = a própria MRR atual (assumindo base estável). Nenhuma decisão registrada define um modelo de previsão, e inventar uma taxa de crescimento fabricaria dado — mesma lógica já aplicada a indicadores financeiros desde o B8.1 (PA-48) |

### B9.5 — Inadimplência, suspensão e cancelamento

Perguntado ao proprietário diretamente (30/09/2026), já que o documento sugeria "assessoria comercial/jurídica" para PA-34 — sem essa assessoria disponível, o proprietário decidiu os prazos ele mesmo, como decisão de produto para poder avançar.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-34 | Prazos de inadimplência? | definir sequência de aviso, tolerância, suspensão e cancelamento com assessoria comercial/jurídica. | **Decisão do proprietário**: 7 dias em atraso suspende a assinatura; 30 dias corridos desde o início do atraso cancelam — mesmo que a empresa não tenha passado pela suspensão intermediária nesse meio tempo (ex.: processamento rodou só depois dos 30 dias). Prazos gravados no código (`process_subscription_delinquency`), fáceis de ajustar depois se a experiência real pedir outros números |
| PA-35 | O que fica disponível durante suspensão? | leitura e exportação por prazo limitado; bloquear novas operações. | **Decisão do proprietário**: somente leitura. Implementado para a operação mais diretamente ligada à própria assinatura — adicionar um mercado novo, bloqueado desde o atraso (`past_due`) até o cancelamento. Bloquear TODAS as operações do sistema (vender, receber, repor, etc.) exigiria revisar e alterar dezenas de funções de escrita já construídas desde o Bloco B1 — risco de regressão desproporcional para esta etapa. Registrado aqui como **próximo passo pendente**: quando o gateway de pagamento (B9.3) existir de verdade e a inadimplência passar a ser automática, vale revisitar e ampliar o bloqueio de forma mais abrangente |
| RN-BILL-08 | Retenção de dados após cancelamento está [A DEFINIR] | — | **Não decidido aqui de propósito**: essa pergunta é, na prática, a mesma do PA-36 (B10.1, LGPD) — retenção de dados é uma decisão legal, não uma decisão de engenharia de cobrança. Fica para quando o B10.1 for feito, para não duplicar a decisão |


## Bloco B10

### B10.1 — LGPD

Perguntado ao proprietário diretamente (30/09/2026): PA-36 exigia um prazo de verdade, e RNF-LGPD-04 exigia dados reais (controlador/encarregado) que ainda não existem no projeto.

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-36 | Retenção de dados após cancelamento? | prazo contratual e legal, com exportação antes da eliminação. | **Decisão do proprietário**: 90 dias corridos após o cancelamento. Antes disso, o dono ou o administrador podem exportar os dados via `export_company_data`; depois dos 90 dias, `process_data_retention` elimina e-mail e telefone de contato da empresa (o cadastro em si — razão social, CNPJ, histórico operacional — não é apagado, mesmo padrão de sempre, RN-ACL-06) |
| — | O que exatamente conta como "eliminado"? | — | **Decisão do agente**: só o contato pessoal (e-mail/telefone) da empresa. Dados de auditoria (`audit_log`) mantêm os registros históricos por 5 anos (PA-43, já decidido antes) — não é um conflito: retenção de trilha de auditoria por obrigação legal/interesse legítimo é uma exceção prevista na própria LGPD ao direito de eliminação |
| RNF-LGPD-04 | Definir controlador, operador e encarregado (DPO) — exige dados reais da empresa | — | **Decisão do proprietário**: registrar como placeholder por enquanto. Controlador = a empresa dona da plataforma (Mercado Fácil); operador = fornecedores de infraestrutura (ex.: Supabase); encarregado (DPO) = ainda não designado. Pendência explícita: falta o proprietário indicar um nome/contato real de encarregado antes de publicar uma política de privacidade de verdade |

### B10.3 — Backup, monitoramento e disponibilidade

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-42 | Frequência e retenção de backup? | definir RPO/RTO e testar restauração regularmente. | _pendente_ |

### B10.4 — Desempenho

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-41 | Quais metas de desempenho e disponibilidade? | definir a partir do piloto e do volume esperado. | _pendente_ |

### B10.5 — Piloto e homologação final

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-46 | Qual mercado será o piloto? | uma unidade real com PDV conhecido, equipe disponível e volume controlável. | _pendente_ |

