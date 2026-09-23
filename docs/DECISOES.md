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
| PA-15 | Estoque negativo é permitido? | não por padrão; integrar venda e criar ocorrência quando inevitável. | _pendente_ |

### B3.3 — Lotes, validade, FEFO/FIFO e bloqueio

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-18 | FEFO será obrigatório? | obrigatório para produtos com validade, permitindo exceção autorizada. | _pendente_ |
| PA-19 | Produto vencido bloqueia venda automaticamente? | bloquear disponibilidade e gerar tarefa de retirada; integração com PDV depende de capacidade. | _pendente_ |

### B3.4 — Perdas, ajustes e estornos com aprovação

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-21 | Como aprovar perdas e ajustes? | limites por quantidade e valor, com foto acima do limite. | _pendente_ |

### B3.5 — Transferências internas e entre mercados

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-22 | Transferência entre mercados faz parte do MVP? | incluir depois da movimentação interna estar estável, salvo necessidade do piloto. | _pendente_ |


## Bloco B4

### B4.1 — Recebimento e itens esperados (manual e XML)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-07 | A nota fiscal é obrigatória para receber? | permitir recebimento por pedido/autorização excepcional, sempre auditado. | _pendente_ |

### B4.2 — Conferência cega protegida no servidor

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-08 | O conferente vê quantidade de volumes esperada? | mostrar apenas volumes físicos informados na chegada, não os esperados por documento. | _pendente_ |

### B4.3 — Decisão, entrada no estoque e finalização

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-05 | Quem aprova divergência de recebimento? | gerente até um limite e dono acima dele. | _pendente_ |
| PA-06 | Quais tolerâncias de recebimento? | começar sem tolerância automática; todas as diferenças ficam visíveis. | _pendente_ |
| PA-20 | Qual prazo mínimo de validade no recebimento? | configurável por categoria/produto/fornecedor. | _pendente_ |

### B4.4 — Recontagem, recusa e histórico

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-09 | Há limite de recontagens no recebimento? | configurar separadamente da regra de três tentativas da reposição. | _pendente_ |


## Bloco B5

### B5.1 — Geração automática de tarefas de reposição

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-10 | Reposição completa até ideal ou máximo? | até ideal; máximo funciona como limite. | _pendente_ |
| PA-11 | Como calcular prioridade da reposição? | ruptura, vendas recentes, tempo aguardando, validade e criticidade. | _pendente_ |
| PA-13 | Pode haver tarefa duplicada? | impedir para mesmo produto/posição enquanto existir tarefa ativa. | _pendente_ |

### B5.2 — Fluxo do repositor gravado no banco

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-12 | Como atribuir tarefa ao repositor? | fila do mercado com aceite; gerente pode atribuir manualmente. | _pendente_ |

### B5.3 — Contagem cega da gôndola (3 tentativas)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-14 | O que acontece após a terceira contagem divergente? | bloquear conclusão automática e exigir decisão do gerente. | _pendente_ |

### B5.4 — Câmera e leitor de código de barras reais

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-47 | Quais dispositivos e scanners serão suportados? | validar câmera do celular e leitores usados no piloto. | _pendente_ |

### B5.5 — App instalável e funcionamento sem internet

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-39 | Funcionamento offline no celular? | permitir tarefas já baixadas e contagens; bloquear decisões que dependem de saldo atualizado. | _pendente_ |
| PA-40 | Como resolver conflito offline? | nunca sobrescrever silenciosamente; criar pendência para conciliação. | _pendente_ |


## Bloco B6

### B6.2 — Motor de alertas e notificações

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-37 | Quais canais de notificação? | sistema e push para operação; e-mail para conta/cobrança; WhatsApp opcional com consentimento. | _pendente_ |
| PA-38 | Quais alertas chegam ao dono? | permitir preferências, mantendo críticos obrigatórios. | _pendente_ |


## Bloco B7

### B7.1 — Recepção de vendas do PDV (idempotente)

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-25 | Como o PDV enviará dados e com que frequência? | eventos próximos do tempo real, com reconciliação periódica. | _pendente_ |

### B7.3 — Baixa de estoque, cancelamento e devolução

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-16 | Qual endereço sofre a baixa da venda? | gôndola principal configurada para o produto; falta de mapeamento vira pendência. | _pendente_ |
| PA-17 | Como tratar várias posições do mesmo produto? | regra explícita de prioridade ou distribuição proporcional, nunca escolha silenciosa. | _pendente_ |
| PA-26 | Como tratar devolução e cancelamento de venda? | evento reverso vinculado à venda original; produto devolvido vai para endereço de inspeção. | _pendente_ |

### B7.4 — Conector do PDV do mercado piloto

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-24 | Qual PDV será integrado primeiro? | escolher o PDV real do mercado piloto. | _pendente_ |


## Bloco B8

### B8.1 — Indicadores reais da rede e do mercado

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-48 | Quais dados financeiros serão exibidos? | faturamento e vendas do PDV; custos e margem somente se a origem estiver definida. | _pendente_ |

### B8.2 — Relatórios e exportação

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-50 | Quais formatos de relatório e exportação? | tela e CSV no MVP; PDF/planilha conforme prioridade. | _pendente_ |


## Bloco B9

### B9.1 — Planos, teste gratuito e cupons no banco

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-28 | Quais planos, preços e limites? | validar comercialmente antes da integração do pagamento. | _pendente_ |
| PA-29 | Existe valor base além do valor por mercado? | permitir configuração; não obrigar fórmula única. | _pendente_ |
| PA-31 | Teste exige cartão? | parâmetro por plano/campanha. | _pendente_ |
| PA-32 | Quantos testes uma empresa pode usar? | um por CNPJ, com exceção manual auditada. | _pendente_ |
| PA-33 | Como funcionam cupons? | percentual ou valor fixo, vigência, limite de uso, elegibilidade e não cumulativo por padrão. | _pendente_ |

### B9.2 — Assinatura, cálculo e proporcional

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-30 | Como calcular proporcional? | dias restantes/dias do ciclo, respeitando regra do gateway. | _pendente_ |

### B9.3 — Gateway de pagamento

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-27 | Qual gateway de pagamento? | comparar Pix, boleto, cartão recorrente, cobrança proporcional e eventos de inadimplência. | _pendente_ |

### B9.5 — Inadimplência, suspensão e cancelamento

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-34 | Prazos de inadimplência? | definir sequência de aviso, tolerância, suspensão e cancelamento com assessoria comercial/jurídica. | _pendente_ |
| PA-35 | O que fica disponível durante suspensão? | leitura e exportação por prazo limitado; bloquear novas operações. | _pendente_ |


## Bloco B10

### B10.1 — LGPD

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-36 | Retenção de dados após cancelamento? | prazo contratual e legal, com exportação antes da eliminação. | _pendente_ |

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

