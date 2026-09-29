// Geração automática de tarefas de reposição (B5.1), fluxo do repositor
// gravado no banco (B5.2) e contagem cega da gôndola ao concluir (B5.3).
// Escopo decidido em DECISOES.md: sem PDV ainda, o saldo da posição é
// registrado manualmente por dono/gerente (G-03); quando cai ao mínimo ou
// menos, a tarefa nasce automaticamente, sempre mirando o ideal (PA-10). O
// repositor aceita a tarefa da fila, ou o gerente/dono atribui direto
// (PA-12); a retirada pode ter quantidade diferente da sugerida (DEC-B5-03).
// Depois de devolver a sobra (mesmo que zero), o repositor conta cegamente
// o total da prateleira (nunca vê o saldo teórico, DEC-B5-07/08) — até 3
// tentativas; se não bater na terceira, vira 'com_inconsistencia' e só o
// gerente/dono decide (PA-14/DEC-B5-04). Um impedimento devolve a tarefa
// para pendente com o motivo registrado (DEC-B5-06).
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
  productBarcode: string;
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
    productBarcode: row.product_barcode ?? "",
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

/** Registra a sobra devolvida (RN-REP-07) — precisa acontecer antes da contagem cega, mesmo quando é zero. */
export async function registerReplenishmentReturn(
  taskId: string,
  quantityReturned: number,
  returnWarehouseAddressId?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("register_replenishment_return", {
    p_task_id: taskId,
    p_quantity_returned: quantityReturned,
    ...(returnWarehouseAddressId
      ? { p_return_warehouse_address_id: returnWarehouseAddressId }
      : {}),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type ReplenishmentCountResult =
  | { ok: true; status: "em_transito"; matches: false; attempt: number; attemptsLeft: number }
  | { ok: true; status: "concluida" | "com_inconsistencia"; matches: boolean; attempt: number }
  | { ok: false; message: string };

/**
 * Contagem cega do total da prateleira agora (RF-REP-07) — nunca revela o
 * saldo esperado; só diz se bateu e, se não, quantas tentativas restam. Até
 * 3 tentativas (RN-REP-05); na terceira divergência vira 'com_inconsistencia'.
 */
export async function submitReplenishmentCount(
  taskId: string,
  countedQuantity: number,
): Promise<ReplenishmentCountResult> {
  const { data, error } = await supabase.rpc("submit_replenishment_count", {
    p_task_id: taskId,
    p_counted_quantity: countedQuantity,
  });
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Não foi possível registrar a contagem agora." };
  }
  const result = data as {
    status?: string;
    matches?: boolean;
    attempt?: number;
    attempts_left?: number;
  };
  const attempt = result.attempt ?? 1;
  if (result.status === "concluida" || result.status === "com_inconsistencia") {
    return {
      ok: true,
      status: result.status,
      matches: result.matches === true,
      attempt,
    };
  }
  return {
    ok: true,
    status: "em_transito",
    matches: false,
    attempt,
    attemptsLeft: result.attempts_left ?? 0,
  };
}

/** Registra um impedimento (RF-REP-08) — a tarefa volta pendente com o motivo registrado (DEC-B5-06). */
export async function registerReplenishmentImpediment(
  taskId: string,
  reason: string,
  photoPath?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("register_replenishment_impediment", {
    p_task_id: taskId,
    p_reason: reason,
    ...(photoPath ? { p_photo_path: photoPath } : {}),
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
