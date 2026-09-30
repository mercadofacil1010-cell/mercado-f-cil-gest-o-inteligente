// Planos e cupons (B9.1, RF-BILL-01/02/03/06, RF-ADM-03/04). Estrutura
// pronta sem preço comercial fechado ainda (PA-28, DECISOES.md): preços são
// opcionais, cadastrados pelo administrador da plataforma quando existirem.
// Teste grátis é configurado POR PLANO (PA-31: "parâmetro por plano/
// campanha"), não um interruptor único do sistema.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Plan = {
  id: string;
  name: string;
  description: string;
  basePrice: number | null;
  pricePerMarket: number | null;
  maxMarkets: number | null;
  features: string[];
  trialDays: number;
  requiresPaymentMethodForTrial: boolean;
  isDefault: boolean;
  status: Database["public"]["Enums"]["support_status"];
};

export type Coupon = {
  id: string;
  code: string;
  discountType: Database["public"]["Enums"]["coupon_discount_type"];
  discountValue: number;
  validFrom: string;
  validUntil: string | null;
  usageLimit: number | null;
  timesUsed: number;
  eligibilityNote: string;
  status: Database["public"]["Enums"]["support_status"];
};

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    basePrice: row.base_price,
    pricePerMarket: row.price_per_market,
    maxMarkets: row.max_markets,
    features: row.features,
    trialDays: row.trial_days,
    requiresPaymentMethodForTrial: row.requires_payment_method_for_trial,
    isDefault: row.is_default,
    status: row.status,
  };
}

function mapCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    usageLimit: row.usage_limit,
    timesUsed: row.times_used,
    eligibilityNote: row.eligibility_note ?? "",
    status: row.status,
  };
}

export type PlanFormData = {
  name: string;
  description: string;
  basePrice: number | null;
  pricePerMarket: number | null;
  maxMarkets: number | null;
  features: string[];
  trialDays: number;
  requiresPaymentMethodForTrial: boolean;
};

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(mapPlan);
}

export async function createPlan(
  data: PlanFormData,
): Promise<{ ok: true; plan: Plan } | { ok: false; message: string }> {
  const { data: row, error } = await supabase.rpc("create_plan", {
    p_name: data.name.trim(),
    p_trial_days: data.trialDays,
    p_requires_payment_method_for_trial: data.requiresPaymentMethodForTrial,
    p_features: data.features,
    ...(data.description.trim() ? { p_description: data.description.trim() } : {}),
    ...(data.basePrice !== null ? { p_base_price: data.basePrice } : {}),
    ...(data.pricePerMarket !== null ? { p_price_per_market: data.pricePerMarket } : {}),
    ...(data.maxMarkets !== null ? { p_max_markets: data.maxMarkets } : {}),
  });
  if (error || !row)
    return { ok: false, message: error?.message ?? "Não foi possível criar o plano." };
  return { ok: true, plan: mapPlan(row) };
}

export async function updatePlan(
  id: string,
  data: PlanFormData,
): Promise<{ ok: true; plan: Plan } | { ok: false; message: string }> {
  const { data: row, error } = await supabase.rpc("update_plan", {
    p_id: id,
    p_name: data.name.trim(),
    p_trial_days: data.trialDays,
    p_requires_payment_method_for_trial: data.requiresPaymentMethodForTrial,
    p_features: data.features,
    ...(data.description.trim() ? { p_description: data.description.trim() } : {}),
    ...(data.basePrice !== null ? { p_base_price: data.basePrice } : {}),
    ...(data.pricePerMarket !== null ? { p_price_per_market: data.pricePerMarket } : {}),
    ...(data.maxMarkets !== null ? { p_max_markets: data.maxMarkets } : {}),
  });
  if (error || !row)
    return { ok: false, message: error?.message ?? "Não foi possível salvar o plano." };
  return { ok: true, plan: mapPlan(row) };
}

export async function setDefaultPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("set_default_plan", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** RN-ACL-06: sem exclusão física — só inativa. Bloqueado para o plano padrão. */
export async function inactivatePlan(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("inactivate_plan", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function listCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.rpc("list_coupons");
  if (error || !data) return [];
  return data.map(mapCoupon);
}

export async function createCoupon(
  code: string,
  discountType: Database["public"]["Enums"]["coupon_discount_type"],
  discountValue: number,
  validUntil: string | null,
  usageLimit: number | null,
  eligibilityNote: string,
): Promise<{ ok: true; coupon: Coupon } | { ok: false; message: string }> {
  const { data: row, error } = await supabase.rpc("create_coupon", {
    p_code: code.trim(),
    p_discount_type: discountType,
    p_discount_value: discountValue,
    ...(validUntil ? { p_valid_until: validUntil } : {}),
    ...(usageLimit !== null ? { p_usage_limit: usageLimit } : {}),
    ...(eligibilityNote.trim() ? { p_eligibility_note: eligibilityNote.trim() } : {}),
  });
  if (error || !row)
    return { ok: false, message: error?.message ?? "Não foi possível criar o cupom." };
  return { ok: true, coupon: mapCoupon(row) };
}

export async function deactivateCoupon(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("deactivate_coupon", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** PA-32/RN-BILL-04: exceção manual, sempre com justificativa (auditada). */
export async function adminAdjustTrial(
  companyId: string,
  newTrialEndsAt: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("admin_adjust_trial", {
    p_company_id: companyId,
    p_new_trial_ends_at: newTrialEndsAt,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
