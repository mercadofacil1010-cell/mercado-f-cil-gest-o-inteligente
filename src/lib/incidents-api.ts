// Central de inconsistências (B6.1, RF-INC-*/RN-INC-*). Ocorrência nasce
// automaticamente a partir de recebimento com divergência (B4.3), reposição
// com inconsistência (B5.3), inventário com diferença (B3.6) e lote vencido
// ainda com saldo (B3.3, sincronizado sob demanda). Venda e transferência
// ficam de fora (decisão em DECISOES.md): venda ainda não existe (B7) e
// transferência é instantânea, sem divergência hoje.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type IncidentSource = Database["public"]["Enums"]["incident_source"];
export type IncidentSeverity = Database["public"]["Enums"]["incident_severity"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type IncidentResolution = Database["public"]["Enums"]["incident_resolution"];

export const incidentSourceLabel: Record<IncidentSource, string> = {
  recebimento: "Recebimento",
  reposicao: "Reposição",
  inventario: "Inventário",
  validade: "Validade",
};

export const incidentSeverityLabel: Record<IncidentSeverity, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  aberta: "Aberta",
  reconhecida: "Reconhecida",
  em_investigacao: "Em investigação",
  encerrada: "Encerrada",
};

export type Incident = {
  id: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  isRecurring: boolean;
  productId: string | null;
  productName: string;
  warehouseAddressCode: string;
  expectedQuantity: number | null;
  countedQuantity: number | null;
  difference: number | null;
  description: string;
  status: IncidentStatus;
  assignedTo: string | null;
  dueDate: string | null;
  resolution: IncidentResolution | null;
  resolutionNote: string;
  reopenedCount: number;
  createdAt: string;
};

/** Lista as inconsistências do mercado (RF-INC-01/02/04) — só dono/gerente. */
export async function listIncidents(marketId: string): Promise<Incident[]> {
  const { data, error } = await supabase.rpc("list_incidents", { p_market_id: marketId });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    source: row.source,
    severity: row.severity,
    isRecurring: row.is_recurring,
    productId: row.product_id,
    productName: row.product_name ?? "",
    warehouseAddressCode: row.warehouse_address_code ?? "",
    expectedQuantity: row.expected_quantity,
    countedQuantity: row.counted_quantity,
    difference: row.difference,
    description: row.description,
    status: row.status,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    resolution: row.resolution,
    resolutionNote: row.resolution_note ?? "",
    reopenedCount: row.reopened_count,
    createdAt: row.created_at,
  }));
}

/** Sincroniza lotes vencidos ainda com saldo (RF-INC-01, origem validade) — sem evento próprio, chamado sob demanda. */
export async function syncExpiryIncidents(
  marketId: string,
): Promise<{ ok: true; created: number } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("sync_expiry_incidents", { p_market_id: marketId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, created: data ?? 0 };
}

export async function acknowledgeIncident(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("acknowledge_incident", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function startIncidentInvestigation(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("start_incident_investigation", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Atribui responsável e prazo (RF-INC-03). */
export async function assignIncident(
  id: string,
  assigneeUserId: string,
  dueDate?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("assign_incident", {
    p_id: id,
    p_assignee_user_id: assigneeUserId,
    ...(dueDate ? { p_due_date: dueDate } : {}),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Encerra (corrigida ou descartada) — sempre com justificativa (RF-INC-08); nunca lança movimento sozinho (RN-INC-02). */
export async function resolveIncident(
  id: string,
  resolution: IncidentResolution,
  note: string,
  correctionMovementId?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("resolve_incident", {
    p_id: id,
    p_resolution: resolution,
    p_note: note,
    ...(correctionMovementId ? { p_correction_movement_id: correctionMovementId } : {}),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function reopenIncident(
  id: string,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("reopen_incident", { p_id: id, p_note: note });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
