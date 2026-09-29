// Pendências de conciliação (B5.5, PA-40) — ações feitas offline que o
// servidor recusou ao sincronizar. Só dono/gerente com acesso ao mercado
// enxergam (mesmo padrão de pending_stock_adjustments do B3.4).
import { supabase } from "@/integrations/supabase/client";

export type SyncConflict = {
  id: string;
  marketId: string;
  actionType: string;
  payload: unknown;
  errorMessage: string;
  submittedBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

export const syncConflictActionLabel: Record<string, string> = {
  replenishment_withdrawal: "Retirada de reposição",
  replenishment_return: "Devolução de reposição",
  replenishment_impediment: "Impedimento de reposição",
  receiving_count: "Contagem de recebimento",
};

export async function listSyncConflicts(marketId: string): Promise<SyncConflict[]> {
  const { data, error } = await supabase
    .from("offline_sync_conflicts")
    .select("*")
    .eq("market_id", marketId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    marketId: row.market_id,
    actionType: row.action_type,
    payload: row.payload,
    errorMessage: row.error_message,
    submittedBy: row.submitted_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  }));
}

export async function resolveSyncConflict(
  id: string,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("resolve_sync_conflict", { p_id: id, p_note: note });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
