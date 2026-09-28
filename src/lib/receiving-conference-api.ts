// Conferência cega do recebimento (B4.2). Escopo desta etapa (DECISOES.md):
// leitura do produto por código de barras digitado (câmera real fica pro
// B5.4); evidência de contagem é só texto (foto real também fica pro B5.4).
// A comparação com o esperado nunca acontece aqui — isso é o B4.3.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReceivingItemCondition = Database["public"]["Enums"]["receiving_item_condition"];

export const conditionLabel: Record<ReceivingItemCondition, string> = {
  bom_estado: "Bom estado",
  avariado: "Avariado",
  embalagem_violada: "Embalagem violada",
  vencido: "Vencido",
};

export type CountedItem = {
  id: string;
  productId: string;
  productName: string;
  packagingId: string;
  packagingName: string;
  countedQuantity: number;
  baseQuantity: number;
  batchNumber: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  condition: ReceivingItemCondition;
  note: string;
  createdAt: string;
  attempt: number;
  rejected: boolean;
  rejectionReason: string;
};

type CountedItemRow = Database["public"]["Tables"]["receiving_counted_items"]["Row"];

function mapCountedItem(
  row: CountedItemRow,
  productName: string,
  packagingName: string,
): CountedItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName,
    packagingId: row.packaging_id,
    packagingName,
    countedQuantity: row.counted_quantity,
    baseQuantity: row.base_quantity,
    batchNumber: row.batch_number ?? "",
    manufacturedAt: row.manufactured_at,
    expiresAt: row.expires_at,
    condition: row.condition,
    note: row.note ?? "",
    createdAt: row.created_at,
    attempt: row.attempt,
    rejected: row.rejected,
    rejectionReason: row.rejection_reason ?? "",
  };
}

/** Inicia (ou retoma) a conferência cega — o próprio conferente chama isso. */
export async function startReceivingConference(
  receivingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("start_receiving_conference", {
    p_receiving_id: receivingId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Itens já contados nesta conferência (nunca inclui o esperado — RN-REC-01). */
export async function listCountedItems(receivingId: string): Promise<CountedItem[]> {
  const { data, error } = await supabase
    .from("receiving_counted_items")
    .select("*, products(name), product_packagings(name)")
    .eq("receiving_id", receivingId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) =>
    mapCountedItem(
      row,
      (row as { products?: { name: string } | null }).products?.name ?? "",
      (row as { product_packagings?: { name: string } | null }).product_packagings?.name ?? "",
    ),
  );
}

export async function addReceivingCount(
  receivingId: string,
  productId: string,
  packagingId: string,
  quantity: number,
  options?: {
    batchNumber?: string;
    manufacturedAt?: string;
    expiresAt?: string;
    condition?: ReceivingItemCondition;
    note?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("add_receiving_count", {
    p_receiving_id: receivingId,
    p_product_id: productId,
    p_packaging_id: packagingId,
    p_quantity: quantity,
    ...(options?.batchNumber ? { p_batch_number: options.batchNumber } : {}),
    ...(options?.manufacturedAt ? { p_manufactured_at: options.manufacturedAt } : {}),
    ...(options?.expiresAt ? { p_expires_at: options.expiresAt } : {}),
    ...(options?.condition ? { p_condition: options.condition } : {}),
    ...(options?.note ? { p_note: options.note } : {}),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removeReceivingCount(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("remove_receiving_count", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
