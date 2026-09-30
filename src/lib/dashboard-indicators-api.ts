// Indicadores reais do painel (B8.1, RF-DSH-*/IND-01..15). Substitui os
// números de demonstração do "Visão geral" por dados de verdade, calculados
// a partir do que já existe: vendas do PDV (B7), gôndolas (B3.1/B5),
// validade (B3.3), perdas (B3.2), inconsistências (B6.1) e inventário
// (B3.6). Custo/margem ficam de fora (PA-48): o catálogo só tem preço de
// venda, nunca custo — calcular margem seria inventar dado.
import { supabase } from "@/integrations/supabase/client";

export type MarketDashboard = {
  generatedAt: string;
  periodDays: number;
  revenue: number;
  salesCount: number;
  avgTicket: number | null;
  itemsSold: number;
  lowStockPositions: number;
  rupturaPositions: number;
  pendingReplenishments: number;
  avgReplenishmentHours: number | null;
  nearExpiryLots: number;
  losses: number;
  openIncidents: number;
  accuracyPct: number | null;
  turnover: number | null;
  noTurnoverProducts: number;
  coverageDays: number | null;
};

export type CompanyDashboard = {
  generatedAt: string;
  periodDays: number;
  markets: { marketId: string; marketName: string; dashboard: MarketDashboard }[];
};

export type ProductRanking = { productId: string; productName: string; quantitySold: number };

export type MarketFeedItem = {
  kind: string;
  title: string;
  detail: string;
  occurredAt: string | null;
};

const emptyMarketDashboard: MarketDashboard = {
  generatedAt: new Date().toISOString(),
  periodDays: 1,
  revenue: 0,
  salesCount: 0,
  avgTicket: null,
  itemsSold: 0,
  lowStockPositions: 0,
  rupturaPositions: 0,
  pendingReplenishments: 0,
  avgReplenishmentHours: null,
  nearExpiryLots: 0,
  losses: 0,
  openIncidents: 0,
  accuracyPct: null,
  turnover: null,
  noTurnoverProducts: 0,
  coverageDays: null,
};

function mapDashboard(raw: unknown): MarketDashboard {
  const row = (raw ?? {}) as Partial<Record<keyof MarketDashboard, unknown>>;
  const num = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));
  const numOrNull = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);
  return {
    generatedAt: String(row.generatedAt ?? new Date().toISOString()),
    periodDays: num(row.periodDays) || 1,
    revenue: num(row.revenue),
    salesCount: num(row.salesCount),
    avgTicket: numOrNull(row.avgTicket),
    itemsSold: num(row.itemsSold),
    lowStockPositions: num(row.lowStockPositions),
    rupturaPositions: num(row.rupturaPositions),
    pendingReplenishments: num(row.pendingReplenishments),
    avgReplenishmentHours: numOrNull(row.avgReplenishmentHours),
    nearExpiryLots: num(row.nearExpiryLots),
    losses: num(row.losses),
    openIncidents: num(row.openIncidents),
    accuracyPct: numOrNull(row.accuracyPct),
    turnover: numOrNull(row.turnover),
    noTurnoverProducts: num(row.noTurnoverProducts),
    coverageDays: numOrNull(row.coverageDays),
  };
}

/** RF-DSH-01/03/06/07 — indicadores de um único mercado. p_days: 1 = hoje, 7 ou 30 = período. */
export async function getMarketDashboard(marketId: string, days = 1): Promise<MarketDashboard> {
  const { data, error } = await supabase.rpc("get_market_dashboard", {
    p_market_id: marketId,
    p_days: days,
  });
  if (error || !data) return emptyMarketDashboard;
  return mapDashboard(data);
}

/** RF-DSH-02 — indicadores consolidados da rede, um por mercado (só dono). */
export async function getCompanyDashboard(companyId: string, days = 1): Promise<CompanyDashboard> {
  const { data, error } = await supabase.rpc("get_company_dashboard", {
    p_company_id: companyId,
    p_days: days,
  });
  if (error || !data)
    return { generatedAt: new Date().toISOString(), periodDays: days, markets: [] };
  const raw = data as { generatedAt?: string; periodDays?: number; markets?: unknown[] };
  return {
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    periodDays: raw.periodDays ?? days,
    markets: (raw.markets ?? []).map((item) => {
      const row = item as { marketId: string; marketName: string; dashboard: unknown };
      return {
        marketId: row.marketId,
        marketName: row.marketName,
        dashboard: mapDashboard(row.dashboard),
      };
    }),
  };
}

/** RF-DSH-03 — produtos mais vendidos ("top") ou sem giro ("bottom") no período. */
export async function listProductSalesRanking(
  marketId: string,
  direction: "top" | "bottom",
  days = 30,
  limit = 5,
): Promise<ProductRanking[]> {
  const { data, error } = await supabase.rpc("list_product_sales_ranking", {
    p_market_id: marketId,
    p_days: days,
    p_limit: limit,
    p_direction: direction,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantitySold: Number(row.quantity_sold),
  }));
}

/** RF-DSH-04 — feed de operação com os últimos eventos reais do mercado. */
export async function listMarketFeed(marketId: string, limit = 15): Promise<MarketFeedItem[]> {
  const { data, error } = await supabase.rpc("list_market_feed", {
    p_market_id: marketId,
    p_limit: limit,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    occurredAt: row.occurred_at,
  }));
}
