# Registro de decisões — Mercado Fácil

Cada item [A DEFINIR] da documentação que bloqueia uma etapa aparece aqui. **Nenhuma etapa é codificada antes das suas decisões estarem preenchidas.**
A coluna *Sugestão* traz a recomendação da própria documentação (ou minha, quando o documento não sugere). Para aceitar, basta responder "aceito a sugestão"; para mudar, escreva a decisão.

Formato do registro: `Decisão:` + data + quem decidiu.


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

### B1.7 — Acesso do administrador da plataforma

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-44 | Administrador pode acessar dados do cliente para suporte? | somente com consentimento, prazo, justificativa e auditoria. | _pendente_ |


## Bloco B2

### B2.1 — Fornecedores, categorias e marcas

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-23 | Haverá módulo completo de compras? | primeira versão gera alerta e sugestão; pedido formal pode ser fase posterior. | _pendente_ |

### B2.2 — Produtos, embalagens e conversões

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-04 | Quem pode cadastrar/alterar produto? | dono e gerente; outros por permissão específica. | _pendente_ |

### B2.4 — Importação e exportação do catálogo

| ID | Pergunta | Sugestão | Decisão |
|---|---|---|---|
| PA-45 | Haverá importação inicial de produtos e estoque? | sim, com modelo validado e relatório de erros. | _pendente_ |


## Bloco B3

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

