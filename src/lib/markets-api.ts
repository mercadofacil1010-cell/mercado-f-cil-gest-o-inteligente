// Mercados reais (B1.4): substitui os dados de demonstração por leitura e
// gravação de verdade no Supabase. Métricas operacionais (faturamento,
// vendas, reposições, alertas) continuam em zero: dependem do estoque, do
// PDV e da reposição, que ainda são dos blocos B2 a B5.
import { supabase } from "@/integrations/supabase/client";
import type { NewMarketData } from "@/components/add-market-flow";
import type { Market } from "@/data/markets";
import type { Database } from "@/integrations/supabase/types";

type MarketRow = Database["public"]["Tables"]["markets"]["Row"];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatAddress(row: Pick<MarketRow, "street" | "number" | "district">) {
  const parts = [row.street, row.number].filter(Boolean).join(", ");
  return [parts, row.district].filter(Boolean).join(" · ") || "Endereço não informado";
}

/** Converte a linha do banco para o formato usado nas telas (compatível com a versão de demonstração). */
export function mapRowToMarket(row: MarketRow): Market {
  return {
    id: row.id,
    code: row.internal_code ?? "",
    name: row.name,
    // "Aberto/Fechado" é o funcionamento do dia (is_open); um mercado inativo
    // nunca aparece como aberto, mesmo que is_open esteja com valor antigo.
    status: row.is_open && row.status === "active" ? "Aberto" : "Fechado",
    lifecycleStatus: row.status,
    address: formatAddress(row),
    phone: row.phone ?? "",
    // O vínculo de gerente chega no B1.5 (convites e equipe); até lá, nenhum
    // mercado tem gerente definido de verdade.
    manager: "Sem gerente vinculado",
    revenue: 0,
    sales: 0,
    replenishments: 0,
    stockAlerts: 0,
    expiryAlerts: 0,
    inconsistencies: 0,
    updatedAt: new Date(row.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    legalName: row.legal_name ?? "",
    cnpj: row.cnpj ?? "",
    cnpjType: row.uses_parent_cnpj ? "Matriz" : "Próprio",
    email: row.email ?? "",
    openingHours: row.opening_hours ?? "",
    zipCode: row.zip_code ?? "",
    complement: row.complement ?? "",
    reference: row.reference ?? "",
    checkouts: row.checkouts != null ? String(row.checkouts) : "",
    warehouses: row.warehouses != null ? String(row.warehouses) : "",
    employees: row.employees != null ? String(row.employees) : "",
    area: row.area_m2 != null ? String(row.area_m2) : "",
    posSystem: row.pos_system ?? "",
    barcodeReaders: row.has_barcode_readers ? "Sim" : "Não",
    labelPrinter: row.has_label_printer ? "Sim" : "Não",
    district: row.district ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    street: row.street ?? "",
    number: row.number ?? "",
  };
}

/** Empresa do usuário logado (dono ou equipe). Por enquanto, uma pessoa pertence a uma única empresa. */
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("company_members").select("company_id").eq("user_id", userId).limit(1).maybeSingle();
  if (error || !data) return null;
  return data.company_id;
}

export async function listMarkets(companyId: string): Promise<Market[]> {
  const { data, error } = await supabase.from("markets").select("*").eq("company_id", companyId).order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(mapRowToMarket);
}

function requiredOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function createMarket(companyId: string, data: NewMarketData): Promise<{ ok: true; market: Market } | { ok: false; message: string }> {
  // O id é gerado aqui (não pelo banco) de propósito: o Postgres tem uma
  // particularidade real com RLS + RETURNING logo após o INSERT — a política
  // de leitura (que confere se o mercado pertence à empresa do usuário) pode
  // não enxergar a linha recém-criada dentro do mesmo comando. Gerando o id
  // no navegador, gravamos sem pedir RETURNING e buscamos a linha de volta
  // numa segunda consulta (aí a política enxerga a linha normalmente).
  const id = crypto.randomUUID();
  const insertPayload: Database["public"]["Tables"]["markets"]["Insert"] = {
    id,
    company_id: companyId,
    name: data.unitName.trim(),
    legal_name: data.legalName.trim(),
    uses_parent_cnpj: data.cnpjType === "Matriz",
    internal_code: data.internalCode.trim(),
    phone: onlyDigits(data.phone),
    email: data.email.trim(),
    opening_hours: data.openingHours.trim(),
    // Ativado imediatamente: a cobrança de verdade só chega no B9 (RF-ORG-02, plano B1.4).
    status: "active",
    is_open: data.initialStatus === "Aberto",
    zip_code: onlyDigits(data.zipCode),
    street: data.street.trim(),
    number: data.number.trim(),
    district: data.district.trim(),
    city: data.city.trim(),
    state: data.state.trim().toUpperCase(),
    checkouts: Number(data.checkouts),
    warehouses: Number(data.warehouses),
    employees: Number(data.employees),
    area_m2: Number(data.area),
    pos_system: data.posSystem.trim(),
    has_barcode_readers: data.barcodeReaders === "Sim",
    has_label_printer: data.labelPrinter === "Sim",
    ...(data.cnpjType === "Próprio" ? { cnpj: onlyDigits(data.cnpj) } : {}),
    ...(requiredOrUndefined(data.complement) ? { complement: data.complement.trim() } : {}),
    ...(requiredOrUndefined(data.reference) ? { reference: data.reference.trim() } : {}),
  };

  const { error: insertError } = await supabase.from("markets").insert(insertPayload);
  if (insertError) {
    if (insertError.message.toLowerCase().includes("markets_company_name_key")) {
      return { ok: false, message: "Já existe um mercado com esse nome nesta empresa." };
    }
    if (insertError.message.toLowerCase().includes("markets_company_internal_code_key")) {
      return { ok: false, message: "Já existe um mercado com esse código interno nesta empresa." };
    }
    return { ok: false, message: "Não foi possível criar o mercado agora. Tente novamente." };
  }

  const { data: row, error: fetchError } = await supabase.from("markets").select("*").eq("id", id).single();
  if (fetchError || !row) {
    return { ok: false, message: "O mercado foi criado, mas não consegui carregá-lo agora. Recarregue a página." };
  }
  return { ok: true, market: mapRowToMarket(row) };
}

export async function updateMarket(marketId: string, data: NewMarketData): Promise<{ ok: true; market: Market } | { ok: false; message: string }> {
  const updatePayload: Database["public"]["Tables"]["markets"]["Update"] = {
    name: data.unitName.trim(),
    legal_name: data.legalName.trim(),
    uses_parent_cnpj: data.cnpjType === "Matriz",
    internal_code: data.internalCode.trim(),
    phone: onlyDigits(data.phone),
    email: data.email.trim(),
    opening_hours: data.openingHours.trim(),
    is_open: data.initialStatus === "Aberto",
    zip_code: onlyDigits(data.zipCode),
    street: data.street.trim(),
    number: data.number.trim(),
    district: data.district.trim(),
    city: data.city.trim(),
    state: data.state.trim().toUpperCase(),
    checkouts: Number(data.checkouts),
    warehouses: Number(data.warehouses),
    employees: Number(data.employees),
    area_m2: Number(data.area),
    pos_system: data.posSystem.trim(),
    has_barcode_readers: data.barcodeReaders === "Sim",
    has_label_printer: data.labelPrinter === "Sim",
    cnpj: data.cnpjType === "Próprio" ? onlyDigits(data.cnpj) : null,
    complement: requiredOrUndefined(data.complement) ?? null,
    reference: requiredOrUndefined(data.reference) ?? null,
  };

  const { data: row, error } = await supabase.from("markets").update(updatePayload).eq("id", marketId).select("*").single();
  if (error || !row) {
    return { ok: false, message: "Não foi possível salvar as alterações agora. Tente novamente." };
  }
  return { ok: true, market: mapRowToMarket(row) };
}

/** Inativa o mercado (RF-ORG-02). É definitivo: o banco não permite reverter por aqui (soft-delete real, não exclusão). */
export async function inactivateMarket(marketId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("markets").update({ status: "inactive", is_open: false }).eq("id", marketId);
  if (error) {
    return { ok: false, message: "Não foi possível inativar o mercado agora. Tente novamente." };
  }
  return { ok: true };
}
