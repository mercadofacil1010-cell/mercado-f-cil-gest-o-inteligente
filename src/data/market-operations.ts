// Dados fictícios da operação de cada mercado (sem banco de dados).
import type { Market } from "@/data/markets";

export type OperationEvent = {
  id: string;
  time: string;
  kind: "sale" | "warehouse-in" | "warehouse-out" | "replenished" | "received" | "divergence" | "expiry";
  title: string;
  detail: string;
};

export type PriorityAlert = {
  id: string;
  title: string;
  detail: string;
  tone: "critical" | "warning";
};

export type MarketOperation = {
  itemsSold: number;
  criticalStock: number;
  shelvesBelowMin: number;
  replenishmentsInProgress: number;
  receivingsAwaiting: number;
  nearExpiry: number;
  losses: number;
  openInconsistencies: number;
  salesByHour: Array<{ label: string; value: number }>;
  stockMovements: Array<{ label: string; value: number }>;
  shelfRupture: Array<{ label: string; value: number }>;
  lossesByCategory: Array<{ label: string; value: number }>;
  events: OperationEvent[];
  alerts: PriorityAlert[];
};

const hours = ["07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"];
const hourWeights = [0.3, 0.45, 0.6, 0.7, 0.85, 1, 0.9, 0.65, 0.6, 0.75, 0.95, 0.88];

/** Gera números fictícios coerentes com os indicadores do mercado. */
export function getMarketOperation(market: Market): MarketOperation {
  const scale = market.revenue > 0 ? market.revenue / 82450 : 0;
  const round = (value: number) => Math.round(value * scale);
  return {
    itemsSold: Math.round(market.sales * 6.4),
    criticalStock: market.stockAlerts,
    shelvesBelowMin: market.stockAlerts + Math.min(2, market.replenishments),
    replenishmentsInProgress: market.replenishments,
    receivingsAwaiting: market.revenue > 0 ? Math.max(1, Math.round(market.replenishments / 3)) : 0,
    nearExpiry: market.expiryAlerts,
    losses: round(612),
    openInconsistencies: market.inconsistencies,
    salesByHour: hours.map((label, index) => ({ label, value: round(9800 * (hourWeights[index] ?? 0.5)) })),
    stockMovements: [
      { label: "Entradas", value: round(420) },
      { label: "Saídas depósito", value: round(310) },
      { label: "Reposições", value: round(286) },
      { label: "Transferências", value: round(42) },
      { label: "Ajustes", value: round(18) },
    ],
    shelfRupture: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Hoje"].map((label, index) => ({ label, value: Math.max(0, market.stockAlerts + [2, 1, 3, 0, 2, 4, 1][index]! - 1) })),
    lossesByCategory: [
      { label: "Hortifrúti", value: round(248) },
      { label: "Laticínios", value: round(163) },
      { label: "Padaria", value: round(112) },
      { label: "Mercearia", value: round(58) },
      { label: "Bebidas", value: round(31) },
    ],
    events: market.revenue > 0 ? [
      { id: "e1", time: "18:16", kind: "sale", title: "Venda registrada no caixa 03", detail: "R$ 186,40 · 14 itens" },
      { id: "e2", time: "18:14", kind: "warehouse-in", title: "Repositor entrou no depósito", detail: "João Pereira · Depósito 1 / Rua B" },
      { id: "e3", time: "18:12", kind: "warehouse-out", title: "Produto retirado do depósito", detail: "Leite integral 1L · 2 caixas (24 un.)" },
      { id: "e4", time: "18:07", kind: "replenished", title: "Reposição concluída", detail: "Gôndola 04 / Prateleira 2 · Arroz tipo 1 5kg" },
      { id: "e5", time: "17:58", kind: "received", title: "Mercadoria recebida", detail: "Laticínios Serra Azul · NF 48.213" },
      { id: "e6", time: "17:51", kind: "divergence", title: "Divergência identificada", detail: "Café tradicional 500g · contagem 3 un. abaixo" },
      { id: "e7", time: "17:43", kind: "expiry", title: "Lote próximo do vencimento", detail: "Iogurte morango 170g · lote L2309 vence em 4 dias" },
    ] : [
      { id: "e1", time: "Agora", kind: "received", title: "Unidade adicionada à rede", detail: "Aguardando os primeiros registros de operação" },
    ],
    alerts: market.revenue > 0 ? [
      { id: "a1", title: "Ruptura na gôndola 04", detail: "Arroz tipo 1 5kg abaixo do mínimo", tone: "critical" },
      { id: "a2", title: `${market.expiryAlerts} lotes vencendo em até 7 dias`, detail: "Priorize ações de venda ou troca", tone: "warning" },
      { id: "a3", title: "Divergência sem análise", detail: "Café tradicional 500g · aguardando gerente", tone: "critical" },
      { id: "a4", title: "Recebimento em conferência há 42 min", detail: "Distribuidora Bom Preço · NF 77.105", tone: "warning" },
    ] : [],
  };
}

export const teamMembers = [
  { name: "Carlos Mendes", role: "Gerente", shift: "Integral", status: "Online" },
  { name: "Ana Ribeiro", role: "Conferente", shift: "Manhã", status: "Online" },
  { name: "João Pereira", role: "Repositor", shift: "Tarde", status: "Online" },
  { name: "Luana Costa", role: "Repositora", shift: "Manhã", status: "Ausente" },
  { name: "Pedro Martins", role: "Operador de caixa", shift: "Tarde", status: "Online" },
];

export const inconsistencies = [
  { id: "INC-1042", product: "Café tradicional 500g", type: "Contagem de gôndola", difference: "-3 un.", status: "Aguardando gerente", time: "17:51" },
  { id: "INC-1039", product: "Detergente neutro 500ml", type: "Recebimento", difference: "-1 cx.", status: "Em análise", time: "15:20" },
  { id: "INC-1033", product: "Biscoito recheado 140g", type: "Transferência", difference: "+6 un.", status: "Resolvida", time: "Ontem" },
];
