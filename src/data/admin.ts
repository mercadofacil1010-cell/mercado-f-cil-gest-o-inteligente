// Dados fictícios da administração da plataforma Mercado Fácil (sem pagamento real).

export type SubscriptionStatus = "Ativa" | "Em teste" | "Atrasada" | "Suspensa" | "Cancelada";

export type Client = {
  id: string;
  company: string;
  owner: string;
  cnpj: string;
  plan: string;
  markets: number;
  status: SubscriptionStatus;
  nextBilling: string;
  monthly: number;
  trial: string;
  lastAccess: string;
  discount: number;
};

export const initialClients: Client[] = [
  { id: "c1", company: "Rede Alves Supermercados", owner: "Marina Alves", cnpj: "12.345.678/0001-90", plan: "Profissional", markets: 3, status: "Ativa", nextBilling: "10/10/2026", monthly: 747, trial: "Concluído", lastAccess: "Hoje, 18:20", discount: 0 },
  { id: "c2", company: "Mercados Bom Dia", owner: "Ricardo Nunes", cnpj: "23.456.789/0001-01", plan: "Essencial", markets: 1, status: "Em teste", nextBilling: "05/10/2026", monthly: 199, trial: "9 dias restantes", lastAccess: "Hoje, 16:02", discount: 0 },
  { id: "c3", company: "Atacarejo Vale Norte", owner: "Patrícia Gomes", cnpj: "34.567.890/0001-12", plan: "Rede", markets: 8, status: "Ativa", nextBilling: "15/10/2026", monthly: 1592, trial: "Concluído", lastAccess: "Hoje, 11:47", discount: 10 },
  { id: "c4", company: "Supermercado Família", owner: "José Carvalho", cnpj: "45.678.901/0001-23", plan: "Profissional", markets: 2, status: "Atrasada", nextBilling: "18/09/2026", monthly: 498, trial: "Concluído", lastAccess: "19/09, 09:15", discount: 0 },
  { id: "c5", company: "Empório Central", owner: "Luciana Prado", cnpj: "56.789.012/0001-34", plan: "Essencial", markets: 1, status: "Em teste", nextBilling: "28/09/2026", monthly: 199, trial: "3 dias restantes", lastAccess: "Ontem, 20:31", discount: 0 },
  { id: "c6", company: "Mercadinho São Jorge", owner: "Antônio Reis", cnpj: "67.890.123/0001-45", plan: "Essencial", markets: 1, status: "Cancelada", nextBilling: "—", monthly: 0, trial: "Concluído", lastAccess: "02/09, 14:10", discount: 0 },
  { id: "c7", company: "Rede Econômica", owner: "Fábio Moreira", cnpj: "78.901.234/0001-56", plan: "Rede", markets: 5, status: "Suspensa", nextBilling: "—", monthly: 995, trial: "Concluído", lastAccess: "12/09, 08:40", discount: 0 },
];

export type Plan = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  perMarket: number;
  includedMarkets: number;
  period: "Mensal" | "Trimestral" | "Anual";
  features: string[];
  limits: string;
  active: boolean;
  highlight: boolean;
};

export const allFeatures = ["Dashboard da rede", "Produtos e lotes", "Depósito e gôndolas", "Recebimento cego", "Aplicativo do repositor", "Relatórios avançados", "Integração com PDV", "Suporte prioritário"];

export const initialPlans: Plan[] = [
  { id: "p1", name: "Essencial", description: "Para o mercado de bairro que quer organizar o estoque.", basePrice: 199, perMarket: 199, includedMarkets: 1, period: "Mensal", features: ["Dashboard da rede", "Produtos e lotes", "Recebimento cego"], limits: "Até 5.000 produtos e 10 usuários", active: true, highlight: false },
  { id: "p2", name: "Profissional", description: "Operação completa com reposição e endereçamento.", basePrice: 249, perMarket: 249, includedMarkets: 1, period: "Mensal", features: ["Dashboard da rede", "Produtos e lotes", "Depósito e gôndolas", "Recebimento cego", "Aplicativo do repositor", "Relatórios avançados"], limits: "Até 20.000 produtos e 40 usuários", active: true, highlight: true },
  { id: "p3", name: "Rede", description: "Para redes com várias lojas e integrações.", basePrice: 990, perMarket: 199, includedMarkets: 5, period: "Mensal", features: allFeatures, limits: "Produtos e usuários ilimitados", active: true, highlight: false },
];

export type TrialSettings = {
  enabled: boolean;
  days: number;
  customDays: boolean;
  requireCard: boolean;
  marketLimit: number;
  features: string[];
  warnings: number[];
  endAction: "Bloquear acesso" | "Converter para plano Essencial" | "Somente leitura";
};

export const initialTrial: TrialSettings = { enabled: true, days: 15, customDays: false, requireCard: false, marketLimit: 2, features: ["Dashboard da rede", "Produtos e lotes", "Recebimento cego", "Aplicativo do repositor"], warnings: [7, 3, 1], endAction: "Somente leitura" };

export const payments = [
  { id: "PG-9812", client: "Rede Alves Supermercados", value: 747, method: "Cartão de crédito", date: "10/09/2026", status: "Pago" },
  { id: "PG-9811", client: "Atacarejo Vale Norte", value: 1432.8, method: "Boleto", date: "15/09/2026", status: "Pago" },
  { id: "PG-9810", client: "Supermercado Família", value: 498, method: "Pix", date: "18/09/2026", status: "Em atraso" },
  { id: "PG-9809", client: "Rede Econômica", value: 995, method: "Boleto", date: "05/09/2026", status: "Em atraso" },
  { id: "PG-9808", client: "Mercadinho São Jorge", value: 199, method: "Cartão de crédito", date: "01/09/2026", status: "Estornado" },
];

export const coupons = [
  { code: "BEMVINDO20", discount: "20% por 3 meses", uses: "34 / 100", validity: "31/12/2026", active: true },
  { code: "REDE10", discount: "10% permanente", uses: "6 / 20", validity: "30/06/2027", active: true },
  { code: "FEIRA2026", discount: "1 mês grátis", uses: "50 / 50", validity: "15/08/2026", active: false },
];

export const platformUsers = [
  { name: "Administrador Mercado Fácil", email: "admin@mercadofacil.com.br", role: "Proprietário da plataforma", lastAccess: "Agora" },
  { name: "Equipe Financeira", email: "financeiro@mercadofacil.com.br", role: "Financeiro", lastAccess: "Hoje, 10:12" },
  { name: "Equipe de Suporte", email: "suporte@mercadofacil.com.br", role: "Suporte", lastAccess: "Hoje, 17:55" },
];

export const tickets = [
  { id: "SUP-481", client: "Mercados Bom Dia", subject: "Dúvida sobre importação de produtos", priority: "Normal", status: "Aberto", updated: "Hoje, 17:40" },
  { id: "SUP-480", client: "Supermercado Família", subject: "Segunda via do boleto", priority: "Alta", status: "Em atendimento", updated: "Hoje, 15:02" },
  { id: "SUP-476", client: "Rede Alves Supermercados", subject: "Configurar novo mercado", priority: "Normal", status: "Resolvido", updated: "Ontem, 11:20" },
];

export const integrations = [
  { name: "Gateway de pagamento", description: "Cobrança recorrente por cartão, Pix e boleto.", status: "Não conectado" },
  { name: "Nota fiscal eletrônica (NF-e)", description: "Leitura do XML para conferência de recebimento.", status: "Não conectado" },
  { name: "Sistemas de PDV", description: "Sincronização de vendas e estoque com o caixa.", status: "Não conectado" },
  { name: "E-mail transacional", description: "Convites, avisos de teste e cobranças.", status: "Não conectado" },
];

export const auditLog = [
  { time: "Hoje, 18:21", user: "Administrador", action: "Acessou a administração da plataforma", target: "—" },
  { time: "Hoje, 16:05", user: "Equipe Financeira", action: "Registrou pagamento", target: "Atacarejo Vale Norte" },
  { time: "Hoje, 11:48", user: "Administrador", action: "Aplicou desconto de 10%", target: "Atacarejo Vale Norte" },
  { time: "Ontem, 19:02", user: "Equipe de Suporte", action: "Concedeu 5 dias adicionais de teste", target: "Mercados Bom Dia" },
  { time: "12/09, 08:41", user: "Administrador", action: "Suspendeu assinatura por inadimplência", target: "Rede Econômica" },
];

export const mrrHistory = [
  { label: "Abr", value: 3120 }, { label: "Mai", value: 3480 }, { label: "Jun", value: 3910 }, { label: "Jul", value: 4270 }, { label: "Ago", value: 4630 }, { label: "Set", value: 4981 },
];
