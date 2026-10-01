// B9.3 — cria a cobrança no Mercado Pago (Checkout Pro) para uma fatura já
// existente (criada antes via a função do banco `create_invoice`). Devolve
// a URL de checkout (Pix, boleto e cartão num único fluxo hospedado).
//
// Requer o segredo MERCADOPAGO_ACCESS_TOKEN configurado no projeto Supabase
// (Project Settings → Edge Functions → Secrets). Sem ele, responde com um
// erro claro em vez de travar — decisão registrada em docs/DECISOES.md
// (PA-27, B10.5): a estrutura fica pronta antes de existir credencial de
// sandbox.
import { createClient } from "npm:@supabase/supabase-js@2";

const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405 });
  }

  if (!MERCADOPAGO_ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({
        error:
          "Gateway de pagamento ainda não configurado (falta MERCADOPAGO_ACCESS_TOKEN). Fale com o administrador da plataforma.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });
  }

  let invoiceId: string;
  try {
    const body = await req.json();
    invoiceId = body.invoiceId;
    if (!invoiceId) throw new Error("invoiceId é obrigatório");
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), {
      status: 400,
    });
  }

  // Cliente autenticado como o próprio usuário que chamou — a RLS de
  // `invoices` já garante que só dono/admin da empresa enxergam a fatura.
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, amount, status, company_id")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return new Response(JSON.stringify({ error: "Fatura não encontrada ou sem permissão" }), {
      status: 404,
    });
  }
  if (invoice.status !== "pendente") {
    return new Response(JSON.stringify({ error: "Esta fatura não está mais pendente" }), {
      status: 409,
    });
  }

  const notificationUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

  const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: "Assinatura Mercado Fácil",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(invoice.amount),
        },
      ],
      external_reference: invoice.id,
      notification_url: notificationUrl,
      back_urls: APP_BASE_URL
        ? {
            success: `${APP_BASE_URL}/assinatura?pagamento=aprovado`,
            pending: `${APP_BASE_URL}/assinatura?pagamento=pendente`,
            failure: `${APP_BASE_URL}/assinatura?pagamento=recusado`,
          }
        : undefined,
    }),
  });

  if (!preferenceResponse.ok) {
    const detail = await preferenceResponse.text();
    return new Response(
      JSON.stringify({ error: "O Mercado Pago recusou a criação da cobrança", detail }),
      { status: 502 },
    );
  }

  const preference = await preferenceResponse.json();

  const { error: updateError } = await supabase.rpc("set_invoice_checkout", {
    p_invoice_id: invoice.id,
    p_preference_id: preference.id,
    p_checkout_url: preference.init_point,
  });
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ checkoutUrl: preference.init_point, preferenceId: preference.id }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
