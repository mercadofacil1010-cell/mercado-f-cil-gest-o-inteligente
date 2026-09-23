// Mercados (B1.4): dados reais vêm de src/lib/markets-api.ts. Este arquivo só
// guarda o formato (Market) usado pelas telas e o utilitário de moeda.
// Faturamento, vendas, reposições e alertas ficam em zero até os blocos B2–B5
// (estoque, recebimento, reposição e PDV) existirem de verdade.

export type MarketStatus = "Aberto" | "Fechado";
export type MarketLifecycleStatus = "draft" | "awaiting_billing" | "active" | "suspended" | "inactive";

export type Market = {
  id: string;
  code: string;
  name: string;
  status: MarketStatus;
  lifecycleStatus?: MarketLifecycleStatus;
  address: string;
  phone: string;
  manager: string;
  revenue: number;
  sales: number;
  replenishments: number;
  stockAlerts: number;
  expiryAlerts: number;
  inconsistencies: number;
  updatedAt: string;
  // Campos completos (usados para editar o mercado; nem toda tela precisa deles).
  legalName?: string;
  cnpj?: string;
  cnpjType?: "Próprio" | "Matriz";
  email?: string;
  openingHours?: string;
  zipCode?: string;
  complement?: string;
  reference?: string;
  checkouts?: string;
  warehouses?: string;
  employees?: string;
  area?: string;
  posSystem?: string;
  barcodeReaders?: "Sim" | "Não";
  labelPrinter?: "Sim" | "Não";
  district?: string;
  city?: string;
  state?: string;
  street?: string;
  number?: string;
};

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
