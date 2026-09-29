// Recepção de vendas do PDV, idempotente (B7.1, RF-PDV-01/05, RN-PDV-01/02).
// Escopo decidido em DECISOES.md (autorização direta do proprietário, sem
// PDV real ainda): `receiveSaleEvent` é o ponto de entrada único — dono/
// gerente simula/injeta eventos por enquanto, já que nenhum PDV está
// conectado. Mapeamento de produto (B7.2) converte itens para unidade base
// via embalagem; a baixa de estoque (B7.3) acontece automaticamente em
// seguida, sempre da posição de gôndola de maior saldo — item de produto
// sem nenhuma posição configurada fica "Pendente de posição".
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SaleEventType = Database["public"]["Enums"]["sale_event_type"];
export type SaleEventStatus = Database["public"]["Enums"]["sale_event_status"];

export const saleEventTypeLabel: Record<SaleEventType, string> = {
  venda: "Venda",
  cancelamento: "Cancelamento",
  devolucao: "Devolução",
};

export const saleEventStatusLabel: Record<SaleEventStatus, string> = {
  recebido: "Recebido",
  pendente_mapeamento: "Pendente de mapeamento",
  pendente_posicao: "Pendente de posição",
  processado: "Processado",
  erro: "Erro",
};

export type SaleEvent = {
  id: string;
  registerCode: string;
  externalEventId: string;
  eventType: SaleEventType;
  referenceExternalEventId: string;
  occurredAt: string;
  receivedAt: string;
  status: SaleEventStatus;
  errorMessage: string;
  itemCount: number;
  unmappedCodes: string[];
  unpositionedCodes: string[];
};

export type PdvProductMapping = {
  id: string;
  externalProductCode: string;
  productId: string;
  productName: string;
  packagingId: string;
  packagingName: string;
  createdAt: string;
};

export type SaleEventItemInput = { externalProductCode: string; quantity: number };

/** Ponto de entrada único (RN-INT-01/06) — idempotente por (mercado, id do evento). */
export async function receiveSaleEvent(
  marketId: string,
  registerCode: string,
  externalEventId: string,
  eventType: SaleEventType,
  occurredAt: string,
  items: SaleEventItemInput[],
  referenceExternalEventId?: string,
): Promise<{ ok: true; duplicate: boolean } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("receive_sale_event", {
    p_market_id: marketId,
    p_register_code: registerCode,
    p_external_event_id: externalEventId,
    p_event_type: eventType,
    p_occurred_at: occurredAt,
    p_items: items.map((item) => ({
      external_product_code: item.externalProductCode,
      quantity: item.quantity,
    })),
    ...(referenceExternalEventId
      ? { p_reference_external_event_id: referenceExternalEventId }
      : {}),
  });
  if (error) return { ok: false, message: error.message };
  const duplicate = (data as { duplicate?: boolean } | null)?.duplicate === true;
  return { ok: true, duplicate };
}

export async function listSaleEvents(
  marketId: string,
  status?: SaleEventStatus,
): Promise<SaleEvent[]> {
  const { data, error } = await supabase.rpc("list_sale_events", {
    p_market_id: marketId,
    ...(status ? { p_status: status } : {}),
  });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    registerCode: row.register_code,
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    referenceExternalEventId: row.reference_external_event_id ?? "",
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    status: row.status,
    errorMessage: row.error_message ?? "",
    itemCount: row.item_count,
    unmappedCodes: row.unmapped_codes ?? [],
    unpositionedCodes: row.unpositioned_codes ?? [],
  }));
}

/** Cadastra/corrige o vínculo de um código do PDV (upsert) e reprocessa sozinho os eventos pendentes com esse código (RF-PDV-07). */
export async function createPdvProductMapping(
  marketId: string,
  externalProductCode: string,
  productId: string,
  packagingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("create_pdv_product_mapping", {
    p_market_id: marketId,
    p_external_product_code: externalProductCode,
    p_product_id: productId,
    p_packaging_id: packagingId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function listPdvProductMappings(marketId: string): Promise<PdvProductMapping[]> {
  const { data, error } = await supabase.rpc("list_pdv_product_mappings", {
    p_market_id: marketId,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    externalProductCode: row.external_product_code,
    productId: row.product_id,
    productName: row.product_name,
    packagingId: row.packaging_id,
    packagingName: row.packaging_name,
    createdAt: row.created_at,
  }));
}

/** Botão explícito de "tentar de novo" (RF-PDV-07) para um evento pendente de mapeamento. */
export async function reprocessSaleEvent(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("reprocess_sale_event", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
