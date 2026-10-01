// Assinatura e cálculo (B9.2, RF-BILL-04/10, RN-BILL-01/02) e fatura/
// cobrança real via Mercado Pago (B9.3, RF-BILL-05/INT-PAY). A fatura é
// criada no banco (`create_invoice`) e a cobrança em si (Pix/boleto/cartão)
// é um checkout hospedado do Mercado Pago, criado pela Edge Function
// `mercadopago-create-checkout`; o pagamento só vira "pago"/"falhou" pelo
// webhook do gateway (nunca direto pelo navegador).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SubscriptionSummary = {
  planName: string;
  priced: boolean;
  basePrice: number | null;
  pricePerMarket: number | null;
  billedMarkets: number;
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  couponCode: string | null;
  cycleStart: string;
  cycleEnd: string;
};

type SubscriptionRow = {
  planName: string;
  priced: boolean;
  basePrice: number | null;
  pricePerMarket: number | null;
  billedMarkets: number;
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  couponCode: string | null;
  cycleStart: string;
  cycleEnd: string;
};

export async function calculateSubscriptionAmount(
  companyId: string,
): Promise<SubscriptionSummary | null> {
  const { data, error } = await supabase.rpc("calculate_subscription_amount", {
    p_company_id: companyId,
  });
  if (error || !data) return null;
  const row = data as unknown as SubscriptionRow;
  return {
    planName: row.planName ?? "",
    priced: Boolean(row.priced),
    basePrice: row.basePrice ?? null,
    pricePerMarket: row.pricePerMarket ?? null,
    billedMarkets: row.billedMarkets ?? 0,
    subtotal: row.subtotal ?? null,
    discount: row.discount ?? null,
    total: row.total ?? null,
    couponCode: row.couponCode ?? null,
    cycleStart: row.cycleStart ?? "",
    cycleEnd: row.cycleEnd ?? "",
  };
}

/** RF-BILL-04/RN-BILL-02: valor proporcional de adicionar um mercado agora. Null sem price_per_market definido no plano. */
export async function calculateMarketAdditionCost(companyId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("calculate_market_addition_cost", {
    p_company_id: companyId,
  });
  if (error) return null;
  return data;
}

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export type Invoice = {
  id: string;
  cycleStart: string;
  cycleEnd: string;
  amount: number;
  status: InvoiceStatus;
  paymentMethod: string | null;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

function mapRowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
    amount: Number(row.amount),
    status: row.status,
    paymentMethod: row.payment_method,
    checkoutUrl: row.checkout_url,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export async function listInvoices(companyId: string): Promise<Invoice[]> {
  const { data, error } = await supabase.rpc("list_invoices", { p_company_id: companyId });
  if (error || !data) return [];
  return data.map(mapRowToInvoice);
}

/** RF-BILL-05: gera a fatura do ciclo atual (uma pendente por vez). */
export async function createInvoice(
  companyId: string,
): Promise<{ ok: true; invoice: Invoice } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("create_invoice", { p_company_id: companyId });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível gerar a fatura." };
  return { ok: true, invoice: mapRowToInvoice(data) };
}

/** Cria a cobrança no Mercado Pago para uma fatura pendente e devolve a URL de checkout (Pix/boleto/cartão). */
export async function createCheckout(
  invoiceId: string,
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke<{
    checkoutUrl?: string;
    error?: string;
  }>("mercadopago-create-checkout", { body: { invoiceId } });
  if (error) return { ok: false, message: error.message };
  if (!data?.checkoutUrl) return { ok: false, message: data?.error ?? "Checkout não disponível." };
  return { ok: true, checkoutUrl: data.checkoutUrl };
}
