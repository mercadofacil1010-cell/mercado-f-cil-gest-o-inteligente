// Contexto do Repositor (B5.2, Correção 1): rota própria, fora do painel do
// dono — mesma decisão de arquitetura do /conferente (DEC-B4-01). Só o
// suficiente para o repositor ver os mercados aos quais está vinculado.
import { supabase } from "@/integrations/supabase/client";

export type RepositorMarket = { id: string; name: string };

export type RepositorContext = {
  companyId: string;
  markets: RepositorMarket[];
} | null;

export async function getRepositorContext(userId: string): Promise<RepositorContext> {
  const { data: memberRow } = await supabase
    .from("company_members")
    .select("id, company_id, role")
    .eq("user_id", userId)
    .eq("role", "stocker")
    .maybeSingle();
  if (!memberRow) return null;

  const { data: links } = await supabase
    .from("member_markets")
    .select("markets(id, name)")
    .eq("member_id", memberRow.id);

  const markets = (links ?? [])
    .map((link) => (link as { markets?: RepositorMarket | null }).markets)
    .filter((market): market is RepositorMarket => Boolean(market));

  return { companyId: memberRow.company_id, markets };
}
