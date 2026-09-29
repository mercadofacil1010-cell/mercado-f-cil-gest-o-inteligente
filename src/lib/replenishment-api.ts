// Geração automática de tarefas de reposição (B5.1) e fluxo do repositor
// gravado no banco (B5.2). Escopo decidido em DECISOES.md: sem PDV ainda, o
// saldo da posição é registrado manualmente por dono/gerente (G-03); quando
// cai ao mínimo ou menos, a tarefa nasce automaticamente, sempre mirando o
// ideal (PA-10). O repositor aceita a tarefa da fila, ou o gerente/dono
// atribui direto (PA-12); a retirada pode ter quantidade diferente da
// sugerida (DEC-B5-03); quando reposto + devolvido não fecha com o
// retirado, vira 'com_inconsistencia' e só o gerente/dono decide — sem
// limite automático (DEC-B5-04); um impedimento devolve a tarefa para
// pendente com o motivo registrado (DEC-B5-06).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReplenishmentTaskStatus = Database["public"]["Enums"]["replenishment_task_status"];

export const replenishmentTaskStatusLabel: Record<ReplenishmentTaskStatus, string> = {
  pendente: "Pendente",
  aceita: "Aceita",
  em_transito: "Em trânsito",
  com_inconsistencia: "Com inconsistência",
  concluida: "Concluída",
};

export type ReplenishmentTask = {
  id: string;
  gondolaPositionId: string;
  gondolaPositionCode: string;
  productId: string;
  productName: string;
  quantityNeeded: number;
  isRuptura: boolean;
  isNearExpiry: boolean;
  waitingHours: number;
  priorityScore: number;
  status: ReplenishmentTaskStatus;
  acceptedBy: string | null;
  quantityWithdrawn: number | null;
  lastImpedimentReason: string;
  createdAt: string;
};

/** Registra o saldo observado na posição — cria a tarefa automaticamente se cair ao mínimo (RF-REP-01). */
export async function recordGondolaBalance(
  positionId: string,
  balance: number,
): Promise<{ ok: true; taskCreated: boolean } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("record_gondola_balance", {
    p_position_id: positionId,
    p_balance: balance,
  });
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Não foi possível registrar o saldo agora." };
  }
  const taskCreated = (data as { task_created?: boolean }).task_created === true;
  return { ok: true, taskCreated };
}

/**
 * Tarefas de reposição de um mercado, já ordenadas por prioridade (PA-11).
 * Dono/gerente veem tudo que não está concluído; o repositor vê as
 * pendentes (para aceitar) e as próprias, em qualquer status.
 */
export async function listReplenishmentTasks(marketId: string): Promise<ReplenishmentTask[]> {
  const { data, error } = await supabase.rpc("list_replenishment_tasks", {
    p_market_id: marketId,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    gondolaPositionId: row.gondola_position_id,
    gondolaPositionCode: row.gondola_position_code,
    productId: row.product_id,
    productName: row.product_name,
    quantityNeeded: row.quantity_needed,
    isRuptura: row.is_ruptura,
    isNearExpiry: row.is_near_expiry,
    waitingHours: row.waiting_hours,
    priorityScore: row.priority_score,
    status: row.status,
    acceptedBy: row.accepted_by,
    quantityWithdrawn: row.quantity_withdrawn,
    lastImpedimentReason: row.last_impediment_reason ?? "",
    createdAt: row.created_at,
  }));
}

/** O repositor aceita uma tarefa pendente direto da fila (PA-12). */
export async function acceptReplenishmentTask(
  taskId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("accept_replenishment_task", { p_task_id: taskId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Dono/gerente atribui uma tarefa pendente direto a um repositor (PA-12). */
export async function assignReplenishmentTask(
  taskId: string,
  stockerUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("assign_replenishment_task", {
    p_task_id: taskId,
    p_stocker_user_id: stockerUserId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Registra a retirada real do depósito (RF-REP-04) — pode diferir da quantidade sugerida (DEC-B5-03). */
export async function registerReplenishmentWithdrawal(
  taskId: string,
  quantity: number,
  sourceWarehouseAddressId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("register_replenishment_withdrawal", {
    p_task_id: taskId,
    p_quantity: quantity,
    p_source_warehouse_address_id: sourceWarehouseAddressId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Registra reposição na gôndola e sobra devolvida (RF-REP-06) — fecha a tarefa ou vira inconsistência (RN-REP-08). */
export async function registerReplenishmentCompletion(
  taskId: string,
  quantityPlaced: number,
  options?: { quantityReturned?: number; returnWarehouseAddressId?: string; note?: string },
): Promise<
  | { ok: true; status: "concluida" | "com_inconsistencia"; matches: boolean }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc("register_replenishment_completion", {
    p_task_id: taskId,
    p_quantity_placed: quantityPlaced,
    p_quantity_returned: options?.quantityReturned ?? 0,
    ...(options?.returnWarehouseAddressId
      ? { p_return_warehouse_address_id: options.returnWarehouseAddressId }
      : {}),
    ...(options?.note ? { p_note: options.note } : {}),
  });
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Não foi possível concluir a reposição agora." };
  }
  const result = data as { status?: string; matches?: boolean };
  return {
    ok: true,
    status: result.status === "com_inconsistencia" ? "com_inconsistencia" : "concluida",
    matches: result.matches === true,
  };
}

/** Registra um impedimento (RF-REP-08) — a tarefa volta pendente com o motivo registrado (DEC-B5-06). */
export async function registerReplenishmentImpediment(
  taskId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("register_replenishment_impediment", {
    p_task_id: taskId,
    p_reason: reason,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Dono/gerente decide uma inconsistência (RN-REP-08) — nenhum novo movimento de estoque acontece aqui. */
export async function resolveReplenishmentInconsistency(
  taskId: string,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("resolve_replenishment_inconsistency", {
    p_task_id: taskId,
    p_note: note,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
