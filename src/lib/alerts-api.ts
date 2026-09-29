// Motor de alertas (B6.2, RF-EST-06/RF-INC-06/RN-DSH-05). Feed único que
// reúne sinais que já existem espalhados pelo sistema — inconsistência
// aberta (B6.1), saldo negativo, gôndola no mínimo sem tarefa ativa (o
// caso que o B5.1 não cobre sozinho) — em vez de reinventar a detecção.
// Canal só sistema por enquanto (PA-37); dono/gerente sem preferências
// ainda (PA-38); nunca desaparece sozinho ao abrir o painel (RN-DSH-05).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AlertType = Database["public"]["Enums"]["alert_type"];
export type AlertStatus = Database["public"]["Enums"]["alert_status"];

export const alertTypeLabel: Record<AlertType, string> = {
  incidente_aberto: "Inconsistência aberta",
  saldo_negativo: "Saldo negativo",
  gondola_no_minimo: "Gôndola no mínimo",
};

export type Alert = {
  id: string;
  alertType: AlertType;
  productId: string | null;
  productName: string;
  warehouseAddressCode: string;
  gondolaPositionCode: string;
  referenceIncidentId: string | null;
  description: string;
  status: AlertStatus;
  discardNote: string;
  createdAt: string;
};

/** Sincroniza o feed: resolve sozinho o que não é mais verdade, cria o que é novo — nunca chamado implicitamente. */
export async function syncAlerts(
  marketId: string,
): Promise<{ ok: true; created: number } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("sync_alerts", { p_market_id: marketId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, created: data ?? 0 };
}

export async function listAlerts(marketId: string): Promise<Alert[]> {
  const { data, error } = await supabase.rpc("list_alerts", { p_market_id: marketId });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    alertType: row.alert_type,
    productId: row.product_id,
    productName: row.product_name ?? "",
    warehouseAddressCode: row.warehouse_address_code ?? "",
    gondolaPositionCode: row.gondola_position_code ?? "",
    referenceIncidentId: row.reference_incident_id,
    description: row.description,
    status: row.status,
    discardNote: row.discard_note ?? "",
    createdAt: row.created_at,
  }));
}

export async function discardAlert(
  id: string,
  note?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("discard_alert", {
    p_id: id,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
