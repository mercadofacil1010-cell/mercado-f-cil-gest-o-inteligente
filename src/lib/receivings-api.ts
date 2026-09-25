// Recebimento de mercadoria e itens esperados (B4.1). Escopo desta etapa
// (DECISOES.md): só digitação manual dos itens esperados (leitura do XML da
// NF-e fica para depois); nota fiscal não é obrigatória, mas exige motivo
// quando ausente (PA-07). A conferência cega em si (contar, comparar só
// depois) é o B4.2 — aqui só existe criar o recebimento e a lista esperada.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReceivingStatus = Database["public"]["Enums"]["receiving_status"];

export const receivingStatusLabel: Record<ReceivingStatus, string> = {
  aguardando_recebimento: "Aguardando recebimento",
  em_conferencia: "Em conferência",
  com_divergencia: "Com divergência",
  aguardando_aprovacao: "Aguardando aprovação",
  finalizado: "Finalizado",
  recusado: "Recusado",
};

export type Receiving = {
  id: string;
  marketId: string;
  supplierId: string | null;
  supplierName: string;
  invoiceNumber: string;
  orderReference: string;
  noInvoiceReason: string;
  status: ReceivingStatus;
  createdAt: string;
};

export type ReceivingItem = {
  id: string;
  productId: string;
  productName: string;
  expectedQuantity: number;
};

type ReceivingRow = Database["public"]["Tables"]["receivings"]["Row"];

function mapReceiving(row: ReceivingRow, supplierName: string): Receiving {
  return {
    id: row.id,
    marketId: row.market_id,
    supplierId: row.supplier_id,
    supplierName,
    invoiceNumber: row.invoice_number ?? "",
    orderReference: row.order_reference ?? "",
    noInvoiceReason: row.no_invoice_reason ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Recebimentos de um mercado (RF-REC-01), mais recentes primeiro. */
export async function listReceivings(marketId: string): Promise<Receiving[]> {
  const { data, error } = await supabase
    .from("receivings")
    .select("*, suppliers(name)")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) =>
    mapReceiving(row, (row as { suppliers?: { name: string } | null }).suppliers?.name ?? ""),
  );
}

/** Itens esperados de um recebimento — nunca chamado pelo app do conferente (RN-REC-01). */
export async function listReceivingItems(receivingId: string): Promise<ReceivingItem[]> {
  const { data, error } = await supabase
    .from("receiving_items")
    .select("*, products(name)")
    .eq("receiving_id", receivingId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: (row as { products?: { name: string } | null }).products?.name ?? "",
    expectedQuantity: row.expected_quantity,
  }));
}

export async function createReceiving(
  marketId: string,
  supplierId: string | null,
  invoiceNumber: string,
  orderReference: string,
  noInvoiceReason: string,
): Promise<{ ok: true; receivingId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("create_receiving", {
    p_market_id: marketId,
    ...(supplierId ? { p_supplier_id: supplierId } : {}),
    ...(invoiceNumber ? { p_invoice_number: invoiceNumber } : {}),
    ...(orderReference ? { p_order_reference: orderReference } : {}),
    ...(noInvoiceReason ? { p_no_invoice_reason: noInvoiceReason } : {}),
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível criar o recebimento agora." };
  return { ok: true, receivingId: data.id };
}

export async function addReceivingItem(
  receivingId: string,
  productId: string,
  expectedQuantity: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("add_receiving_item", {
    p_receiving_id: receivingId,
    p_product_id: productId,
    p_expected_quantity: expectedQuantity,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removeReceivingItem(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("remove_receiving_item", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
