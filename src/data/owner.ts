// Dados fictícios das seções gerais do painel do dono da rede.

export const purchaseOrders = [
  {
    id: "PC-1208",
    supplier: "Distribuidora Bom Preço",
    market: "Mercado Central",
    items: 18,
    value: 12480,
    expected: "24/09/2026",
    status: "Enviado",
  },
  {
    id: "PC-1207",
    supplier: "Laticínios Serra Azul",
    market: "Mercado Jardim",
    items: 9,
    value: 6320,
    expected: "23/09/2026",
    status: "Confirmado",
  },
  {
    id: "PC-1205",
    supplier: "Bebidas Sul",
    market: "Mercado Avenida",
    items: 6,
    value: 8910,
    expected: "22/09/2026",
    status: "Recebido",
  },
  {
    id: "PC-1204",
    supplier: "Hortifrúti Vale Verde",
    market: "Mercado Central",
    items: 22,
    value: 3150,
    expected: "22/09/2026",
    status: "Recebido",
  },
  {
    id: "PC-1201",
    supplier: "Limpa Tudo Atacado",
    market: "Mercado Jardim",
    items: 12,
    value: 2740,
    expected: "26/09/2026",
    status: "Rascunho",
  },
];

export const supplierList = [
  {
    name: "Distribuidora Bom Preço",
    cnpj: "11.222.333/0001-44",
    contact: "(11) 4002-1000",
    leadTime: "2 dias",
    rating: 4.6,
    deliveries: 38,
  },
  {
    name: "Laticínios Serra Azul",
    cnpj: "22.333.444/0001-55",
    contact: "(11) 4002-2000",
    leadTime: "1 dia",
    rating: 4.8,
    deliveries: 52,
  },
  {
    name: "Bebidas Sul",
    cnpj: "33.444.555/0001-66",
    contact: "(11) 4002-3000",
    leadTime: "3 dias",
    rating: 4.2,
    deliveries: 21,
  },
  {
    name: "Hortifrúti Vale Verde",
    cnpj: "44.555.666/0001-77",
    contact: "(11) 4002-4000",
    leadTime: "Diário",
    rating: 4.5,
    deliveries: 88,
  },
  {
    name: "Limpa Tudo Atacado",
    cnpj: "55.666.777/0001-88",
    contact: "(11) 4002-5000",
    leadTime: "4 dias",
    rating: 3.9,
    deliveries: 14,
  },
];

export const reports = [
  { title: "Vendas por mercado", description: "Faturamento, cupons e ticket médio por unidade." },
  { title: "Curva ABC de produtos", description: "Participação de cada produto no faturamento." },
  { title: "Perdas e quebras", description: "Vencimentos, avarias e divergências por categoria." },
  { title: "Ruptura de gôndola", description: "Tempo médio sem produto na área de vendas." },
  {
    title: "Desempenho da reposição",
    description: "Tarefas, tempo de execução e divergências por repositor.",
  },
  { title: "Recebimentos", description: "Divergências e tempo de conferência por fornecedor." },
];

export const helpTopics = [
  {
    question: "Como adicionar um novo mercado?",
    answer:
      "Na visão geral, clique em “Adicionar novo mercado” e siga as cinco etapas do cadastro.",
  },
  {
    question: "Como funciona a conferência cega?",
    answer:
      "O conferente registra o que contou sem ver a nota fiscal. O resultado só aparece para usuários autorizados.",
  },
  {
    question: "Como o repositor recebe as tarefas?",
    answer:
      "Pelo aplicativo do repositor, que organiza as reposições por prioridade e tempo de espera.",
  },
  {
    question: "Posso cancelar a assinatura?",
    answer:
      "Sim. A cobrança é por mercado e pode ser cancelada a qualquer momento na área Assinatura.",
  },
];
