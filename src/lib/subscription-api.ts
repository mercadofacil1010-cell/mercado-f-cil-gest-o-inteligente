// Assinatura e cálculo (B9.2, RF-BILL-04/10, RN-BILL-01/02). Ainda sem
// gateway (B9.3): estes valores são só cálculo e resumo — nenhuma cobrança
// de verdade acontece aqui.
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionSummary = {
  planName: string;
  priced: boolean;
  basePrice: number | null;
  pricePerMarket: number | null;
  billedMarkets: number;
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  couponCode: string | null;
  cycleStart: string;
  cycleEnd: string;
};

type SubscriptionRow = {
  planName: string;
  priced: boolean;
  basePrice: number | null;
  pricePerMarket: number | null;
  billedMarkets: number;
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  couponCode: string | null;
  cycleStart: string;
  cycleEnd: string;
};

export async function calculateSubscriptionAmount(
  companyId: string,
): Promise<SubscriptionSummary | null> {
  const { data, error } = await supabase.rpc("calculate_subscription_amount", {
    p_company_id: companyId,
  });
  if (error || !data) return null;
  const row = data as unknown as SubscriptionRow;
  return {
    planName: row.planName ?? "",
    priced: Boolean(row.priced),
    basePrice: row.basePrice ?? null,
    pricePerMarket: row.pricePerMarket ?? null,
    billedMarkets: row.billedMarkets ?? 0,
    subtotal: row.subtotal ?? null,
    discount: row.discount ?? null,
    total: row.total ?? null,
    couponCode: row.couponCode ?? null,
    cycleStart: row.cycleStart ?? "",
    cycleEnd: row.cycleEnd ?? "",
  };
}

/** RF-BILL-04/RN-BILL-02: valor proporcional de adicionar um mercado agora. Null sem price_per_market definido no plano. */
export async function calculateMarketAdditionCost(companyId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("calculate_market_addition_cost", {
    p_company_id: companyId,
  });
  if (error) return null;
  return data;
}
