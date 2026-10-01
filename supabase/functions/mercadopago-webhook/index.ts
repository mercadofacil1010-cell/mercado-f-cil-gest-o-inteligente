// B9.3 — recebe as notificações de pagamento do Mercado Pago e repassa
// para `register_invoice_payment` (só chamável pelo service_role — nunca
// pelo usuário final). É isso que torna automático o que o B9.5 fazia
// manualmente: pagamento aprovado reativa sozinho uma assinatura em
// atraso/suspensa; recusado/cancelado marca atraso sozinho numa ativa.
//
// Requer o segredo MERCADOPAGO_ACCESS_TOKEN (mesmo do
// mercadopago-create-checkout) para consultar o pagamento de verdade na API
// do Mercado Pago antes de confiar no status — nunca confiar só no corpo da
// notificação, que não é assinado.
import { createClient } from "npm:@supabase/supabase-js@2";

const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STATUS_MAP: Record<string, "pago" | "falhou" | "cancelado"> = {
  approved: "pago",
  rejected: "falhou",
  cancelled: "cancelado",
  refunded: "cancelado",
  charged_back: "cancelado",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    // Responde 200 para o Mercado Pago não ficar reenviando — mas não há
    // credencial para processar nada ainda.
    return new Response("Gateway não configurado", { status: 200 });
  }

  let paymentId: string | null = null;
  try {
    const url = new URL(req.url);
    const body = req.headers.get("content-length") !== "0" ? await req.json().catch(() => null) : null;
    paymentId = url.searchParams.get("data.id") ?? body?.data?.id ?? null;
    const topic = url.searchParams.get("type") ?? body?.type;
    if (topic && topic !== "payment") {
      return new Response("Ignorado (não é notificação de pagamento)", { status: 200 });
    }
  } catch {
    return new Response("Notificação inválida", { status: 400 });
  }

  if (!paymentId) {
    return new Response("Notificação sem id de pagamento", { status: 200 });
  }

  // Nunca confiar no status que vem na notificação em si — busca o
  // pagamento de verdade na API do Mercado Pago com o access token.
  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!paymentResponse.ok) {
    return new Response("Não foi possível consultar o pagamento no Mercado Pago", { status: 502 });
  }
  const payment = await paymentResponse.json();

  const invoiceId: string | undefined = payment.external_reference;
  const mappedStatus = STATUS_MAP[payment.status as string];
  if (!invoiceId || !mappedStatus) {
    // Status intermediário (pending, in_process, etc.) — nada a registrar ainda.
    return new Response("Status ainda não final, nada registrado", { status: 200 });
  }

  const paymentMethod: string | null = payment.payment_type_id ?? null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.rpc("register_invoice_payment", {
    p_invoice_id: invoiceId,
    p_status: mappedStatus,
    p_gateway_payment_id: String(payment.id),
    p_payment_method: paymentMethod,
  });

  if (error) {
    // Fatura já processada (reenvio de notificação) não é erro de verdade.
    if (error.message?.includes("já foi processada")) {
      return new Response("Já processada", { status: 200 });
    }
    return new Response(error.message, { status: 500 });
  }

  return new Response("Registrado", { status: 200 });
});
