// Conclusão do cadastro real (B1.2): grava o CPF/nascimento no perfil, cria a
// empresa de verdade (create_company) e registra o aceite dos termos na
// auditoria (RNF-LGPD-03). Usado tanto logo após o cadastro (quando a
// confirmação de e-mail está desligada) quanto ao retomar depois que o
// usuário confirma o e-mail e faz login (ver useResumePendingSignup).
import { supabase } from "@/integrations/supabase/client";

// Versão dos textos legais aceitos (RNF-LGPD-03). Atualize ao publicar uma
// nova versão dos Termos de Uso / Política de Privacidade.
export const LEGAL_TERMS_VERSION = "termos-v1";
export const LEGAL_PRIVACY_VERSION = "privacidade-v1";

export type CompanySignupData = {
  name: string;
  cpf: string;
  birthDate: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  companyPhone: string;
  companyEmail: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  segment: string;
  hasPos: string;
  posName: string;
  wantsTrial: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Verifica se o usuário logado já tem alguma empresa (owner ou equipe). */
export async function userHasCompany(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("company_members").select("id").eq("user_id", userId).limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Grava CPF/nascimento no perfil, cria a empresa e registra o aceite legal.
 * Assume que já existe uma sessão autenticada (auth.uid() disponível no banco).
 */
export async function completeCompanySignup(data: CompanySignupData): Promise<{ ok: true; companyId: string } | { ok: false; message: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { ok: false, message: "Sessão expirada. Faça login novamente para concluir o cadastro." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ cpf: onlyDigits(data.cpf), birth_date: data.birthDate, phone: onlyDigits(data.companyPhone) || null })
    .eq("id", userId);
  if (profileError) {
    return { ok: false, message: "Não foi possível salvar seus dados pessoais. Tente novamente." };
  }

  const optional = (value: string) => (value.trim() ? { value: value.trim() } : null);
  const posName = data.hasPos === "Sim" ? optional(data.posName) : null;
  const { data: companyId, error: companyError } = await supabase.rpc("create_company", {
    p_legal_name: data.legalName,
    p_trade_name: data.tradeName,
    p_cnpj: onlyDigits(data.cnpj),
    ...(optional(data.stateRegistration) ? { p_state_registration: data.stateRegistration.trim() } : {}),
    ...(onlyDigits(data.companyPhone) ? { p_phone: onlyDigits(data.companyPhone) } : {}),
    ...(optional(data.companyEmail) ? { p_email: data.companyEmail.trim() } : {}),
    ...(onlyDigits(data.zipCode) ? { p_zip_code: onlyDigits(data.zipCode) } : {}),
    ...(optional(data.address) ? { p_street: data.address.trim() } : {}),
    ...(optional(data.number) ? { p_number: data.number.trim() } : {}),
    ...(optional(data.complement) ? { p_complement: data.complement.trim() } : {}),
    ...(optional(data.district) ? { p_district: data.district.trim() } : {}),
    ...(optional(data.city) ? { p_city: data.city.trim() } : {}),
    ...(optional(data.state) ? { p_state: data.state.trim() } : {}),
    ...(optional(data.segment) ? { p_segment: data.segment.trim() } : {}),
    p_has_pos: data.hasPos === "Sim",
    ...(posName ? { p_pos_name: posName.value } : {}),
    p_start_trial: data.wantsTrial === "Sim",
  });
  if (companyError || !companyId) {
    // CNPJ já cadastrado é o motivo mais comum (empresa_cnpj_key).
    if (companyError?.message.toLowerCase().includes("cnpj")) {
      return { ok: false, message: "Este CNPJ já está cadastrado no Mercado Fácil." };
    }
    return { ok: false, message: "Não foi possível criar a empresa agora. Tente novamente em instantes." };
  }

  // Aceite dos termos e da política de privacidade, com versão, data/hora e origem (RNF-LGPD-03).
  await supabase.rpc("log_audit_event", {
    p_entity: "legal_acceptance",
    p_company_id: companyId,
    p_details: {
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      accepted_at: new Date().toISOString(),
      origin: "cadastro_web",
    },
  });

  return { ok: true, companyId };
}
