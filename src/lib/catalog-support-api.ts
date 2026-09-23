// Cadastros de apoio ao catálogo (B2.1, G-01): fornecedores reais no lugar dos
// dados de demonstração. Categorias e marcas usam o mesmo padrão de tabela,
// mas ainda não têm tela própria — entram como seletores no cadastro de
// produto (B2.2).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Supplier = {
  id: string;
  name: string;
  cnpj: string;
  contactName: string;
  phone: string;
  email: string;
  leadTimeDays: number | null;
  status: Database["public"]["Enums"]["support_status"];
};

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function mapRowToSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    leadTimeDays: row.lead_time_days,
    status: row.status,
  };
}

export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("company_id", companyId)
    .neq("status", "inactive")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map(mapRowToSupplier);
}

export type SupplierFormData = {
  name: string;
  cnpj: string;
  contactName: string;
  phone: string;
  email: string;
  leadTimeDays: string;
};

function friendlySupplierError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("suppliers_company_name_key"))
    return "Já existe um fornecedor com esse nome nesta empresa.";
  if (lower.includes("suppliers_cnpj_check"))
    return "CNPJ inválido: informe 14 dígitos ou deixe em branco.";
  if (lower.includes("suppliers_phone_check"))
    return "Telefone inválido: informe DDD + número, só dígitos.";
  if (lower.includes("suppliers_email_check")) return "E-mail inválido.";
  if (lower.includes("suppliers_name_check")) return "Informe um nome entre 2 e 160 caracteres.";
  return "Não foi possível salvar o fornecedor agora. Tente novamente.";
}

export async function createSupplier(
  companyId: string,
  data: SupplierFormData,
): Promise<{ ok: true; supplier: Supplier } | { ok: false; message: string }> {
  const id = crypto.randomUUID();
  const payload: Database["public"]["Tables"]["suppliers"]["Insert"] = {
    id,
    company_id: companyId,
    name: data.name.trim(),
    ...(data.cnpj.trim() ? { cnpj: onlyDigits(data.cnpj) } : {}),
    ...(data.contactName.trim() ? { contact_name: data.contactName.trim() } : {}),
    ...(data.phone.trim() ? { phone: onlyDigits(data.phone) } : {}),
    ...(data.email.trim() ? { email: data.email.trim() } : {}),
    ...(data.leadTimeDays.trim() ? { lead_time_days: Number(data.leadTimeDays) } : {}),
  };

  // Mesmo cuidado do B1.4 com mercados: INSERT + RETURNING pode não enxergar a
  // linha recém-criada dentro do mesmo comando (RLS reavalia o SELECT). Insere
  // sem RETURNING e busca a linha de volta numa segunda consulta.
  const { error: insertError } = await supabase.from("suppliers").insert(payload);
  if (insertError) return { ok: false, message: friendlySupplierError(insertError.message) };

  const { data: row, error: fetchError } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !row)
    return {
      ok: false,
      message: "Fornecedor criado, mas não consegui carregá-lo agora. Recarregue a página.",
    };
  return { ok: true, supplier: mapRowToSupplier(row) };
}

export async function updateSupplier(
  supplierId: string,
  data: SupplierFormData,
): Promise<{ ok: true; supplier: Supplier } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["suppliers"]["Update"] = {
    name: data.name.trim(),
    cnpj: data.cnpj.trim() ? onlyDigits(data.cnpj) : null,
    contact_name: data.contactName.trim() || null,
    phone: data.phone.trim() ? onlyDigits(data.phone) : null,
    email: data.email.trim() || null,
    lead_time_days: data.leadTimeDays.trim() ? Number(data.leadTimeDays) : null,
  };

  const { data: row, error } = await supabase
    .from("suppliers")
    .update(payload)
    .eq("id", supplierId)
    .select("*")
    .single();
  if (error || !row) return { ok: false, message: friendlySupplierError(error?.message ?? "") };
  return { ok: true, supplier: mapRowToSupplier(row) };
}

/** Inativa o fornecedor (RN-ACL-06). Definitivo: sem exclusão física, pode estar referenciado em produtos/recebimentos. */
export async function inactivateSupplier(
  supplierId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("suppliers")
    .update({ status: "inactive" })
    .eq("id", supplierId);
  if (error)
    return { ok: false, message: "Não foi possível inativar o fornecedor agora. Tente novamente." };
  return { ok: true };
}
