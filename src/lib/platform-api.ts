// Indicadores da plataforma (B9.4, IND-ADM-01..09) — dados reais para a
// "Visão geral" do administrador. "Previsão de receita" não inventa uma
// taxa de crescimento: é a MRR atual, assumindo base estável (não existe
// nenhum modelo de previsão decidido em DECISOES.md).
import { supabase } from "@/integrations/supabase/client";

export type PlatformIndicators = {
  companiesCount: number;
  activeMarkets: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  cancelledSubscriptions: number;
  pastDueSubscriptions: number;
  suspendedSubscriptions: number;
  trialConversionPct: number | null;
  mrr: number;
  revenueForecast: number;
};

type IndicatorsRow = PlatformIndicators;

export async function getPlatformIndicators(): Promise<PlatformIndicators | null> {
  const { data, error } = await supabase.rpc("get_platform_indicators");
  if (error || !data) return null;
  const row = data as unknown as IndicatorsRow;
  return {
    companiesCount: row.companiesCount ?? 0,
    activeMarkets: row.activeMarkets ?? 0,
    activeSubscriptions: row.activeSubscriptions ?? 0,
    trialSubscriptions: row.trialSubscriptions ?? 0,
    cancelledSubscriptions: row.cancelledSubscriptions ?? 0,
    pastDueSubscriptions: row.pastDueSubscriptions ?? 0,
    suspendedSubscriptions: row.suspendedSubscriptions ?? 0,
    trialConversionPct: row.trialConversionPct ?? null,
    mrr: row.mrr ?? 0,
    revenueForecast: row.revenueForecast ?? 0,
  };
}
