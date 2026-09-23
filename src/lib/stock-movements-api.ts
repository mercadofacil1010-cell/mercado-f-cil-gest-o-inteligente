// Livro de movimentos e saldos de estoque (B3.2). Escopo desta etapa
// (DECISOES.md): só endereços de depósito (B3.1); sem reserva ainda. Ledger
// imutável — toda escrita passa pelas funções do banco (register/reverse),
// nunca por INSERT/UPDATE/DELETE direto.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StockMovementType = Database["public"]["Enums"]["stock_movement_type"];

export const stockMovementTypeLabel: Record<StockMovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  perda: "Perda",
  devolucao_fornecedor: "Devolução ao fornecedor",
};

export type StockMovement = {
  id: string;
  warehouseAddressId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  reference: string;
  reversalOf: string | null;
  lotId: string | null;
  lotBatchNumber: string;
  createdAt: string;
};

type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];

function mapRowToStockMovement(
  row: StockMovementRow,
  productName: string,
  lotBatchNumber: string,
): StockMovement {
  return {
    id: row.id,
    warehouseAddressId: row.warehouse_address_id,
    productId: row.product_id,
    productName,
    type: row.type,
    quantity: row.quantity,
    reference: row.reference ?? "",
    reversalOf: row.reversal_of,
    lotId: row.lot_id,
    lotBatchNumber,
    createdAt: row.created_at,
  };
}

/** Extrato cronológico de um endereço (RF-EST-03), mais recente primeiro. */
export async function listStockMovements(warehouseAddressId: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*, products(name), lots(batch_number)")
    .eq("warehouse_address_id", warehouseAddressId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) =>
    mapRowToStockMovement(row, row.products?.name ?? "", row.lots?.batch_number ?? ""),
  );
}

export type StockBalance = { productId: string; productName: string; balance: number };

/** Saldo consolidado por produto de um endereço (RF-EST-01). */
export async function listStockBalances(warehouseAddressId: string): Promise<StockBalance[]> {
  const { data, error } = await supabase
    .from("stock_balances")
    .select("product_id, balance, products(name)")
    .eq("warehouse_address_id", warehouseAddressId);
  if (error || !data) return [];
  return data
    .map((row) => ({
      productId: row.product_id ?? "",
      productName: (row as { products?: { name: string } | null }).products?.name ?? "",
      balance: row.balance ?? 0,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

function friendlyStockError(message: string): string {
  if (
    message.includes("saldo negativo") ||
    message.includes("lote") ||
    message.includes("limite de aprovação") ||
    message.includes("próprio pedido") ||
    message.includes("motivo da recusa")
  )
    return message;
  if (message.toLowerCase().includes("row-level security") || message.includes("Sem permissão"))
    return "Você não tem acesso a este mercado para registrar movimentos.";
  if (message) return message;
  return "Não foi possível registrar o movimento agora. Tente novamente.";
}

export async function registerStockMovement(
  warehouseAddressId: string,
  productId: string,
  type: StockMovementType,
  quantity: number,
  reference: string,
  reason?: string,
  lotId?: string,
): Promise<
  { ok: true; pending?: boolean } | { ok: false; message: string; needsReason?: boolean }
> {
  const { data, error } = await supabase.rpc("register_stock_movement", {
    p_warehouse_address_id: warehouseAddressId,
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    ...(reference ? { p_reference: reference } : {}),
    ...(reason ? { p_reason: reason } : {}),
    ...(lotId ? { p_lot_id: lotId } : {}),
  });
  if (error) {
    const needsReason =
      error.message.includes("saldo negativo") ||
      error.message.includes("ordem de saída") ||
      error.message.includes("limite de aprovação");
    return { ok: false, message: friendlyStockError(error.message), needsReason };
  }
  const pending = (data as { status?: string } | null)?.status === "pending";
  return { ok: true, pending };
}

export type PendingAdjustmentStatus = Database["public"]["Enums"]["pending_adjustment_status"];

export type PendingAdjustment = {
  id: string;
  warehouseAddressId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  reference: string;
  reason: string;
  status: PendingAdjustmentStatus;
  requestedBy: string;
  createdAt: string;
};

/** Fila de perdas/ajustes acima do limite da empresa, aguardando aprovação (RN-CRT-VAL-05). */
export async function listPendingAdjustments(
  warehouseAddressId: string,
): Promise<PendingAdjustment[]> {
  const { data, error } = await supabase
    .from("pending_stock_adjustments")
    .select("*, products(name)")
    .eq("warehouse_address_id", warehouseAddressId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    warehouseAddressId: row.warehouse_address_id,
    productId: row.product_id,
    productName: (row as { products?: { name: string } | null }).products?.name ?? "",
    type: row.type,
    quantity: row.quantity,
    reference: row.reference ?? "",
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  }));
}

export async function approvePendingAdjustment(
  id: string,
  note?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("approve_pending_stock_adjustment", {
    p_id: id,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return { ok: false, message: friendlyStockError(error.message) };
  return { ok: true };
}

export async function rejectPendingAdjustment(
  id: string,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("reject_pending_stock_adjustment", {
    p_id: id,
    p_note: note,
  });
  if (error) return { ok: false, message: friendlyStockError(error.message) };
  return { ok: true };
}

export async function reverseStockMovement(
  movementId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("reverse_stock_movement", {
    p_movement_id: movementId,
    p_reason: reason,
  });
  if (error) return { ok: false, message: friendlyStockError(error.message) };
  return { ok: true };
}
