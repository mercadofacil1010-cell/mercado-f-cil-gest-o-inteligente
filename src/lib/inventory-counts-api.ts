// Contagem de inventário por endereço de depósito (B3.6). Escopo desta etapa
// (DECISOES.md): sessão de contagem por endereço, cega (a tela nunca mostra
// o saldo teórico até finalizar); divergência vira ajuste automático,
// reaproveitando a fila de aprovação por limite do B3.4 quando necessário.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type InventoryCountStatus = Database["public"]["Enums"]["inventory_count_status"];

export type InventoryCountItem = {
  id: string;
  productId: string;
  productName: string;
  countedQuantity: number;
  theoreticalBalance: number | null;
  difference: number | null;
  resultingMovementStatus: "none" | "posted" | "pending" | null;
};

export type InventoryCount = {
  id: string;
  warehouseAddressId: string;
  status: InventoryCountStatus;
  createdAt: string;
  finalizedAt: string | null;
  items: InventoryCountItem[];
};

type InventoryCountItemRow = Database["public"]["Tables"]["inventory_count_items"]["Row"];

function mapItem(row: InventoryCountItemRow, productName: string): InventoryCountItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName,
    countedQuantity: row.counted_quantity,
    theoreticalBalance: row.theoretical_balance,
    difference: row.difference,
    resultingMovementStatus:
      (row.resulting_movement_status as "none" | "posted" | "pending" | null) ?? null,
  };
}

/** Contagem em aberto do endereço, com os itens já contados (ou null se não há nenhuma). */
export async function getOpenInventoryCount(
  warehouseAddressId: string,
): Promise<InventoryCount | null> {
  const { data: count, error } = await supabase
    .from("inventory_counts")
    .select("*")
    .eq("warehouse_address_id", warehouseAddressId)
    .eq("status", "aberta")
    .maybeSingle();
  if (error || !count) return null;

  const { data: items } = await supabase
    .from("inventory_count_items")
    .select("*, products(name)")
    .eq("inventory_count_id", count.id)
    .order("created_at", { ascending: true });

  return {
    id: count.id,
    warehouseAddressId: count.warehouse_address_id,
    status: count.status,
    createdAt: count.created_at,
    finalizedAt: count.finalized_at,
    items: (items ?? []).map((row) =>
      mapItem(row, (row as { products?: { name: string } | null }).products?.name ?? ""),
    ),
  };
}

export async function startInventoryCount(
  warehouseAddressId: string,
): Promise<{ ok: true; countId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("start_inventory_count", {
    p_warehouse_address_id: warehouseAddressId,
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível iniciar a contagem agora." };
  return { ok: true, countId: data.id };
}

export async function setInventoryCountItem(
  inventoryCountId: string,
  productId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("set_inventory_count_item", {
    p_inventory_count_id: inventoryCountId,
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function finalizeInventoryCount(
  inventoryCountId: string,
): Promise<{ ok: true; items: InventoryCountItem[] } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("finalize_inventory_count", {
    p_inventory_count_id: inventoryCountId,
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível finalizar a contagem agora." };
  return { ok: true, items: data.map((row) => mapItem(row, "")) };
}
