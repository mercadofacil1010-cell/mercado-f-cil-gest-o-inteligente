// Parâmetros de produto por mercado (B2.3): mínimo, ideal, máximo, ponto de
// pedido e situação (ativo/bloqueado/inativo) — RN-PROD-05. O mesmo produto
// pode ter parâmetros diferentes em cada loja da rede; o catálogo em si
// (nome, código de barras, embalagens) continua único e compartilhado (B2.2).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MarketProductStatus = Database["public"]["Enums"]["market_product_status"];

export const marketProductStatusLabel: Record<MarketProductStatus, string> = {
  active: "Ativo",
  blocked: "Bloqueado",
  inactive: "Inativo",
};

export type MarketProduct = {
  id: string;
  productId: string;
  marketId: string;
  minQuantity: number;
  idealQuantity: number;
  maxQuantity: number;
  reorderPoint: number;
  status: MarketProductStatus;
};

type MarketProductRow = Database["public"]["Tables"]["market_products"]["Row"];

function mapRowToMarketProduct(row: MarketProductRow): MarketProduct {
  return {
    id: row.id,
    productId: row.product_id,
    marketId: row.market_id,
    minQuantity: row.min_quantity,
    idealQuantity: row.ideal_quantity,
    maxQuantity: row.max_quantity,
    reorderPoint: row.reorder_point,
    status: row.status,
  };
}

/** Todos os parâmetros de um produto, um por mercado onde já foi configurado. */
export async function listMarketProductsByProduct(productId: string): Promise<MarketProduct[]> {
  const { data, error } = await supabase
    .from("market_products")
    .select("*")
    .eq("product_id", productId);
  if (error || !data) return [];
  return data.map(mapRowToMarketProduct);
}

/** Todos os produtos já configurados num mercado específico (para telas do próprio mercado). */
export async function listMarketProductsByMarket(marketId: string): Promise<MarketProduct[]> {
  const { data, error } = await supabase
    .from("market_products")
    .select("*")
    .eq("market_id", marketId);
  if (error || !data) return [];
  return data.map(mapRowToMarketProduct);
}

export type MarketProductFormData = {
  minQuantity: string;
  idealQuantity: string;
  maxQuantity: string;
  reorderPoint: string;
};

function friendlyMarketProductError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("market_products_product_market_key"))
    return "Este produto já tem parâmetros cadastrados nesse mercado.";
  if (lower.includes("market_products_check"))
    return "O mínimo precisa ser menor ou igual ao ideal, e o ideal menor ou igual ao máximo.";
  if (lower.includes("market_products_min_quantity_check"))
    return "O mínimo não pode ser negativo.";
  if (lower.includes("market_products_max_quantity_check"))
    return "O máximo não pode ser negativo.";
  if (lower.includes("market_products_ideal_quantity_check"))
    return "O ideal não pode ser negativo.";
  if (lower.includes("market_products_reorder_point_check"))
    return "O ponto de pedido não pode ser negativo.";
  if (lower.includes("row-level security") || lower.includes("row level security"))
    return "Você não tem acesso a este mercado para configurar este produto.";
  return "Não foi possível salvar os parâmetros agora. Tente novamente.";
}

export async function createMarketProduct(
  productId: string,
  marketId: string,
  data: MarketProductFormData,
): Promise<{ ok: true; marketProduct: MarketProduct } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["market_products"]["Insert"] = {
    product_id: productId,
    market_id: marketId,
    min_quantity: Number(data.minQuantity),
    ideal_quantity: Number(data.idealQuantity),
    max_quantity: Number(data.maxQuantity),
    reorder_point: Number(data.reorderPoint),
  };
  const { data: row, error } = await supabase
    .from("market_products")
    .insert(payload)
    .select("*")
    .single();
  if (error || !row)
    return { ok: false, message: friendlyMarketProductError(error?.message ?? "") };
  return { ok: true, marketProduct: mapRowToMarketProduct(row) };
}

export async function updateMarketProduct(
  id: string,
  data: MarketProductFormData,
): Promise<{ ok: true; marketProduct: MarketProduct } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["market_products"]["Update"] = {
    min_quantity: Number(data.minQuantity),
    ideal_quantity: Number(data.idealQuantity),
    max_quantity: Number(data.maxQuantity),
    reorder_point: Number(data.reorderPoint),
  };
  const { data: row, error } = await supabase
    .from("market_products")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !row)
    return { ok: false, message: friendlyMarketProductError(error?.message ?? "") };
  return { ok: true, marketProduct: mapRowToMarketProduct(row) };
}

/** Muda a situação por mercado: ativo, bloqueado (pausa reversível) ou inativo (desligamento definitivo). */
export async function setMarketProductStatus(
  id: string,
  status: MarketProductStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("market_products").update({ status }).eq("id", id);
  if (error)
    return { ok: false, message: "Não foi possível atualizar a situação agora. Tente novamente." };
  return { ok: true };
}
