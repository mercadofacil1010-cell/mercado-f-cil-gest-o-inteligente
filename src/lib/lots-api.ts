// Lotes, validade e fila de descarte (B3.3). Só existe para produtos com
// tracks_batch_expiry = true (RF-PROD-07/B2.2). Com validade, a saída segue
// FEFO; sem validade, FIFO — a ordem é aplicada por register_stock_movement
// (src/lib/stock-movements-api.ts), que também recusa lote bloqueado/vencido
// em saída (PA-19).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LotStatus = Database["public"]["Enums"]["lot_status"];

export type Lot = {
  id: string;
  warehouseAddressId: string;
  productId: string;
  batchNumber: string;
  expiresAt: string | null;
  status: LotStatus;
};

type LotRow = Database["public"]["Tables"]["lots"]["Row"];

function mapRowToLot(row: LotRow): Lot {
  return {
    id: row.id,
    warehouseAddressId: row.warehouse_address_id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

/** Lotes de um produto num endereço (usados para escolher o lote de uma saída). */
export async function listLots(warehouseAddressId: string, productId: string): Promise<Lot[]> {
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .eq("warehouse_address_id", warehouseAddressId)
    .eq("product_id", productId)
    .order("expires_at", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data.map(mapRowToLot);
}

export async function getOrCreateLot(
  warehouseAddressId: string,
  productId: string,
  batchNumber: string,
  expiresAt: string | null,
): Promise<{ ok: true; lot: Lot } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("get_or_create_lot", {
    p_warehouse_address_id: warehouseAddressId,
    p_product_id: productId,
    p_batch_number: batchNumber,
    ...(expiresAt ? { p_expires_at: expiresAt } : {}),
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível registrar o lote." };
  return { ok: true, lot: mapRowToLot(data) };
}

/** Corrige a validade de um lote já recebido; exige justificativa (RN-LOT-06). */
export async function updateLotExpiry(
  id: string,
  expiresAt: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("update_lot_expiry", {
    p_id: id,
    p_expires_at: expiresAt,
    p_reason: reason,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Bloqueia ou reativa um lote manualmente (RF-LOT-03). */
export async function setLotStatus(
  id: string,
  status: LotStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("lots").update({ status }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar a situação do lote agora." };
  return { ok: true };
}

export type ExpiringLot = {
  lotId: string;
  warehouseAddressId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiresAt: string;
  status: LotStatus;
  balance: number;
  daysUntilExpiry: number;
};

/** Lotes com validade e saldo, para os alertas de 90/60/30 dias e a fila de descarte dos vencidos (RF-LOT-02, PA-19). */
export async function listExpiringLots(warehouseAddressId: string): Promise<ExpiringLot[]> {
  const { data, error } = await supabase
    .from("expiring_lots")
    .select("*, products(name)")
    .eq("warehouse_address_id", warehouseAddressId)
    .order("expires_at", { ascending: true });
  if (error || !data) return [];
  return data
    .filter((row) => row.lot_id && row.expires_at)
    .map((row) => ({
      lotId: row.lot_id as string,
      warehouseAddressId: row.warehouse_address_id as string,
      productId: row.product_id as string,
      productName: (row as { products?: { name: string } | null }).products?.name ?? "",
      batchNumber: row.batch_number ?? "",
      expiresAt: row.expires_at as string,
      status: row.status as LotStatus,
      balance: row.balance ?? 0,
      daysUntilExpiry: row.days_until_expiry ?? 0,
    }));
}
