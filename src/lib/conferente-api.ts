// Contexto do Conferente (B4, Correção 1): rota própria, fora do painel do
// dono. Nesta etapa (B4.1) só existe o suficiente para o conferente ver os
// mercados aos quais está vinculado e o cabeçalho dos recebimentos de cada
// um — a conferência cega em si (contar, comparar só depois) é o B4.2.
import { supabase } from "@/integrations/supabase/client";

export type ConferenteMarket = { id: string; name: string };

export type ConferenteContext = {
  companyId: string;
  markets: ConferenteMarket[];
} | null;

export async function getConferenteContext(userId: string): Promise<ConferenteContext> {
  const { data: memberRow } = await supabase
    .from("company_members")
    .select("id, company_id, role")
    .eq("user_id", userId)
    .eq("role", "receiver")
    .maybeSingle();
  if (!memberRow) return null;

  const { data: links } = await supabase
    .from("member_markets")
    .select("markets(id, name)")
    .eq("member_id", memberRow.id);

  const markets = (links ?? [])
    .map((link) => (link as { markets?: ConferenteMarket | null }).markets)
    .filter((market): market is ConferenteMarket => Boolean(market));

  return { companyId: memberRow.company_id, markets };
}
