// Endereçamento de depósito e gôndola por mercado (B3.1): estrutura física
// (RF-LOC-01/02), capacidade e limites (RF-LOC-04/05), sem exclusão física
// (RN-ACL-06). Endereço de depósito guarda vários produtos/lotes; posição de
// gôndola tem sempre um único produto-alvo com mínimo/ideal/máximo
// (RN-LOC-04, decidido em DECISOES.md). Mudar capacidade/limites exige
// justificativa (RN-LOC-06) — gravada via as funções update_* do banco.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WarehouseAddress = {
  id: string;
  marketId: string;
  warehouseName: string;
  sector: string;
  street: string;
  aisle: string;
  shelf: string;
  level: string;
  position: string;
  code: string;
  capacity: number;
  status: Database["public"]["Enums"]["support_status"];
};

export type GondolaPosition = {
  id: string;
  marketId: string;
  sector: string;
  aisle: string;
  gondolaNumber: string;
  side: "A" | "B";
  moduleNumber: number;
  shelfNumber: number;
  positionNumber: number;
  code: string;
  productId: string | null;
  productName: string;
  minQuantity: number;
  idealQuantity: number;
  maxQuantity: number;
  capacity: number;
  status: Database["public"]["Enums"]["support_status"];
};

type WarehouseAddressRow = Database["public"]["Tables"]["warehouse_addresses"]["Row"];
type GondolaPositionRow = Database["public"]["Tables"]["gondola_positions"]["Row"];

function mapRowToWarehouseAddress(row: WarehouseAddressRow): WarehouseAddress {
  return {
    id: row.id,
    marketId: row.market_id,
    warehouseName: row.warehouse_name,
    sector: row.sector,
    street: row.street,
    aisle: row.aisle,
    shelf: row.shelf,
    level: row.level,
    position: row.position,
    code: row.code,
    capacity: row.capacity,
    status: row.status,
  };
}

function mapRowToGondolaPosition(row: GondolaPositionRow, productName: string): GondolaPosition {
  return {
    id: row.id,
    marketId: row.market_id,
    sector: row.sector,
    aisle: row.aisle,
    gondolaNumber: row.gondola_number,
    side: row.side as "A" | "B",
    moduleNumber: row.module_number,
    shelfNumber: row.shelf_number,
    positionNumber: row.position_number,
    code: row.code,
    productId: row.product_id,
    productName,
    minQuantity: row.min_quantity,
    idealQuantity: row.ideal_quantity,
    maxQuantity: row.max_quantity,
    capacity: row.capacity,
    status: row.status,
  };
}

export async function listWarehouseAddresses(marketId: string): Promise<WarehouseAddress[]> {
  const { data, error } = await supabase
    .from("warehouse_addresses")
    .select("*")
    .eq("market_id", marketId)
    .order("code");
  if (error || !data) return [];
  return data.map(mapRowToWarehouseAddress);
}

export async function listGondolaPositions(marketId: string): Promise<GondolaPosition[]> {
  const { data, error } = await supabase
    .from("gondola_positions")
    .select("*, products(name)")
    .eq("market_id", marketId)
    .order("code");
  if (error || !data) return [];
  return data.map((row) => mapRowToGondolaPosition(row, row.products?.name ?? ""));
}

export type WarehouseAddressFormData = {
  warehouseName: string;
  sector: string;
  street: string;
  aisle: string;
  shelf: string;
  level: string;
  position: string;
  code: string;
  capacity: string;
};

function friendlyLocationError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("warehouse_addresses_market_code_key") ||
    lower.includes("gondola_positions_market_code_key")
  )
    return "Já existe um endereço com esse código neste mercado.";
  if (lower.includes("row-level security") || lower.includes("row level security"))
    return "Você não tem acesso a este mercado para cadastrar endereços.";
  if (lower.includes("gondola_positions_check"))
    return "O mínimo precisa ser ≤ ideal, e o ideal ≤ máximo.";
  return "Não foi possível salvar o endereço agora. Tente novamente.";
}

export async function createWarehouseAddress(
  marketId: string,
  data: WarehouseAddressFormData,
): Promise<{ ok: true; address: WarehouseAddress } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["warehouse_addresses"]["Insert"] = {
    market_id: marketId,
    warehouse_name: data.warehouseName.trim(),
    sector: data.sector.trim(),
    street: data.street.trim(),
    aisle: data.aisle.trim(),
    shelf: data.shelf.trim(),
    level: data.level.trim(),
    position: data.position.trim(),
    code: data.code.trim(),
    capacity: Number(data.capacity),
  };
  const { data: row, error } = await supabase
    .from("warehouse_addresses")
    .insert(payload)
    .select("*")
    .single();
  if (error || !row) return { ok: false, message: friendlyLocationError(error?.message ?? "") };
  return { ok: true, address: mapRowToWarehouseAddress(row) };
}

export async function updateWarehouseAddress(
  id: string,
  data: WarehouseAddressFormData,
): Promise<{ ok: true; address: WarehouseAddress } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["warehouse_addresses"]["Update"] = {
    warehouse_name: data.warehouseName.trim(),
    sector: data.sector.trim(),
    street: data.street.trim(),
    aisle: data.aisle.trim(),
    shelf: data.shelf.trim(),
    level: data.level.trim(),
    position: data.position.trim(),
    code: data.code.trim(),
  };
  const { data: row, error } = await supabase
    .from("warehouse_addresses")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !row) return { ok: false, message: friendlyLocationError(error?.message ?? "") };
  return { ok: true, address: mapRowToWarehouseAddress(row) };
}

/** Troca a capacidade do endereço; exige justificativa (RN-LOC-06). */
export async function updateWarehouseAddressCapacity(
  id: string,
  capacity: string,
  reason: string,
): Promise<{ ok: true; address: WarehouseAddress } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("update_warehouse_address_capacity", {
    p_id: id,
    p_capacity: Number(capacity),
    p_reason: reason.trim(),
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível alterar a capacidade." };
  return { ok: true, address: mapRowToWarehouseAddress(data) };
}

/** Inativa o endereço (RN-ACL-06). Definitivo: sem exclusão física. */
export async function inactivateWarehouseAddress(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("warehouse_addresses")
    .update({ status: "inactive" })
    .eq("id", id);
  if (error)
    return { ok: false, message: "Não foi possível inativar o endereço agora. Tente novamente." };
  return { ok: true };
}

export type GondolaPositionFormData = {
  sector: string;
  aisle: string;
  gondolaNumber: string;
  side: "A" | "B";
  moduleNumber: string;
  shelfNumber: string;
  positionNumber: string;
  code: string;
  productId: string | null;
  minQuantity: string;
  idealQuantity: string;
  maxQuantity: string;
  capacity: string;
};

export async function createGondolaPosition(
  marketId: string,
  data: GondolaPositionFormData,
): Promise<{ ok: true; position: GondolaPosition } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["gondola_positions"]["Insert"] = {
    market_id: marketId,
    sector: data.sector.trim(),
    aisle: data.aisle.trim(),
    gondola_number: data.gondolaNumber.trim(),
    side: data.side,
    module_number: Number(data.moduleNumber),
    shelf_number: Number(data.shelfNumber),
    position_number: Number(data.positionNumber),
    code: data.code.trim(),
    product_id: data.productId,
    min_quantity: Number(data.minQuantity),
    ideal_quantity: Number(data.idealQuantity),
    max_quantity: Number(data.maxQuantity),
    capacity: Number(data.capacity),
  };
  const { data: row, error } = await supabase
    .from("gondola_positions")
    .insert(payload)
    .select("*, products(name)")
    .single();
  if (error || !row) return { ok: false, message: friendlyLocationError(error?.message ?? "") };
  return { ok: true, position: mapRowToGondolaPosition(row, row.products?.name ?? "") };
}

/** Troca o produto-alvo da posição (sem mexer nos limites). */
export async function updateGondolaPositionProduct(
  id: string,
  productId: string | null,
): Promise<{ ok: true; position: GondolaPosition } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("gondola_positions")
    .update({ product_id: productId })
    .eq("id", id)
    .select("*, products(name)")
    .single();
  if (error || !row) return { ok: false, message: friendlyLocationError(error?.message ?? "") };
  return { ok: true, position: mapRowToGondolaPosition(row, row.products?.name ?? "") };
}

/** Troca mínimo/ideal/máximo/capacidade da posição; exige justificativa (RN-LOC-06). */
export async function updateGondolaPositionLimits(
  id: string,
  data: { minQuantity: string; idealQuantity: string; maxQuantity: string; capacity: string },
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("update_gondola_position_limits", {
    p_id: id,
    p_min: Number(data.minQuantity),
    p_ideal: Number(data.idealQuantity),
    p_max: Number(data.maxQuantity),
    p_capacity: Number(data.capacity),
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Inativa a posição (RN-ACL-06). Definitivo: sem exclusão física. */
export async function inactivateGondolaPosition(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("gondola_positions")
    .update({ status: "inactive" })
    .eq("id", id);
  if (error)
    return { ok: false, message: "Não foi possível inativar a posição agora. Tente novamente." };
  return { ok: true };
}
