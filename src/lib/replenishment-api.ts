// Geração automática de tarefas de reposição (B5.1). Escopo desta etapa
// (DECISOES.md): sem PDV ainda, o saldo da posição é registrado manualmente
// por dono/gerente (G-03); quando cai ao mínimo ou menos, a tarefa nasce
// automaticamente, sempre mirando o ideal (PA-10). Aceite e execução da
// tarefa pelo repositor chegam no B5.2.
import { supabase } from "@/integrations/supabase/client";

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

/** Tarefas de reposição pendentes de um mercado, já ordenadas por prioridade (PA-11). */
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
    createdAt: row.created_at,
  }));
}
