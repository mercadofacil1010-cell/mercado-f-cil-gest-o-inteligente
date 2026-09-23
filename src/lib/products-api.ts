// Catálogo de produtos reais (B2.2): cadastro do produto e das embalagens/
// conversões até a unidade base. Estoque, preço e lotes de verdade (por
// mercado) chegam no B2.3/B3 — esta tela só cuida do registro do catálogo,
// compartilhado por toda a rede.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BaseUnit = "unidade" | "quilograma" | "litro";

export const baseUnitLabel: Record<BaseUnit, string> = {
  unidade: "Unidade",
  quilograma: "Quilograma (kg)",
  litro: "Litro (L)",
};

export type Product = {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  categoryName: string;
  brandId: string | null;
  brandName: string;
  barcode: string;
  sku: string;
  baseUnit: BaseUnit;
  isWeighable: boolean;
  tracksBatchExpiry: boolean;
  status: Database["public"]["Enums"]["support_status"];
};

export type Packaging = {
  id: string;
  productId: string;
  name: string;
  barcode: string;
  conversionFactor: number;
  isBase: boolean;
  status: Database["public"]["Enums"]["support_status"];
};

export type SupportItem = { id: string; name: string };

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type PackagingRow = Database["public"]["Tables"]["product_packagings"]["Row"];

function mapRowToProduct(row: ProductRow, categoryName: string, brandName: string): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    categoryId: row.category_id,
    categoryName,
    brandId: row.brand_id,
    brandName,
    barcode: row.barcode ?? "",
    sku: row.sku ?? "",
    baseUnit: row.base_unit as BaseUnit,
    isWeighable: row.is_weighable,
    tracksBatchExpiry: row.tracks_batch_expiry,
    status: row.status,
  };
}

function mapRowToPackaging(row: PackagingRow): Packaging {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    barcode: row.barcode ?? "",
    conversionFactor: row.conversion_factor,
    isBase: row.is_base,
    status: row.status,
  };
}

export async function listCategories(companyId: string): Promise<SupportItem[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("company_id", companyId)
    .neq("status", "inactive")
    .order("name");
  return data ?? [];
}

export async function listBrands(companyId: string): Promise<SupportItem[]> {
  const { data } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", companyId)
    .neq("status", "inactive")
    .order("name");
  return data ?? [];
}

export async function createCategory(companyId: string, name: string): Promise<SupportItem | null> {
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("categories")
    .insert({ id, company_id: companyId, name: name.trim() });
  if (error) return null;
  return { id, name: name.trim() };
}

export async function createBrand(companyId: string, name: string): Promise<SupportItem | null> {
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("brands")
    .insert({ id, company_id: companyId, name: name.trim() });
  if (error) return null;
  return { id, name: name.trim() };
}

export async function listProducts(companyId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(name), brands(name)")
    .eq("company_id", companyId)
    .neq("status", "inactive")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((row) =>
    mapRowToProduct(row, row.categories?.name ?? "", row.brands?.name ?? ""),
  );
}

export async function listPackagings(productId: string): Promise<Packaging[]> {
  const { data, error } = await supabase
    .from("product_packagings")
    .select("*")
    .eq("product_id", productId)
    .neq("status", "inactive")
    .order("conversion_factor", { ascending: true });
  if (error || !data) return [];
  return data.map(mapRowToPackaging);
}

export type ProductFormData = {
  name: string;
  description: string;
  categoryId: string | null;
  brandId: string | null;
  barcode: string;
  sku: string;
  baseUnit: BaseUnit;
  isWeighable: boolean;
  tracksBatchExpiry: boolean;
};

function friendlyProductError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("products_company_barcode_key"))
    return "Já existe um produto com esse código de barras nesta empresa.";
  if (lower.includes("products_barcode_check"))
    return "Código de barras inválido: use só números (6 a 14 dígitos).";
  if (lower.includes("products_name_check")) return "Informe um nome entre 2 e 160 caracteres.";
  if (lower.includes("products_sku_check")) return "SKU muito longo (máximo 40 caracteres).";
  return "Não foi possível salvar o produto agora. Tente novamente.";
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export async function createProduct(
  companyId: string,
  data: ProductFormData,
): Promise<{ ok: true; product: Product } | { ok: false; message: string }> {
  const id = crypto.randomUUID();
  const payload: Database["public"]["Tables"]["products"]["Insert"] = {
    id,
    company_id: companyId,
    name: data.name.trim(),
    base_unit: data.baseUnit,
    is_weighable: data.isWeighable,
    tracks_batch_expiry: data.tracksBatchExpiry,
    ...(data.description.trim() ? { description: data.description.trim() } : {}),
    ...(data.categoryId ? { category_id: data.categoryId } : {}),
    ...(data.brandId ? { brand_id: data.brandId } : {}),
    ...(data.barcode.trim() ? { barcode: onlyDigits(data.barcode) } : {}),
    ...(data.sku.trim() ? { sku: data.sku.trim() } : {}),
  };

  const { error: insertError } = await supabase.from("products").insert(payload);
  if (insertError) return { ok: false, message: friendlyProductError(insertError.message) };

  // O produto sempre nasce com a própria embalagem-base (fator 1), como a
  // unidade que ele já é — as demais embalagens (caixa, fardo...) são
  // adicionadas depois, na tela de embalagens.
  const { error: packagingError } = await supabase.from("product_packagings").insert({
    product_id: id,
    name: baseUnitLabel[data.baseUnit],
    conversion_factor: 1,
    is_base: true,
  });
  if (packagingError)
    return {
      ok: false,
      message: "Produto criado, mas não consegui registrar a embalagem-base. Recarregue a página.",
    };

  const { data: row, error: fetchError } = await supabase
    .from("products")
    .select("*, categories(name), brands(name)")
    .eq("id", id)
    .single();
  if (fetchError || !row)
    return {
      ok: false,
      message: "Produto criado, mas não consegui carregá-lo agora. Recarregue a página.",
    };
  return {
    ok: true,
    product: mapRowToProduct(row, row.categories?.name ?? "", row.brands?.name ?? ""),
  };
}

export async function updateProduct(
  productId: string,
  data: ProductFormData,
): Promise<{ ok: true; product: Product } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["products"]["Update"] = {
    name: data.name.trim(),
    description: data.description.trim() || null,
    category_id: data.categoryId,
    brand_id: data.brandId,
    barcode: data.barcode.trim() ? onlyDigits(data.barcode) : null,
    sku: data.sku.trim() || null,
    is_weighable: data.isWeighable,
    tracks_batch_expiry: data.tracksBatchExpiry,
    // A unidade base não muda por aqui: trocá-la invalidaria o fator (=1) já
    // gravado na embalagem-base. Mudar de unidade base exige criar outro produto.
  };

  const { data: row, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select("*, categories(name), brands(name)")
    .single();
  if (error || !row) return { ok: false, message: friendlyProductError(error?.message ?? "") };
  return {
    ok: true,
    product: mapRowToProduct(row, row.categories?.name ?? "", row.brands?.name ?? ""),
  };
}

/** Inativa o produto (RN-ACL-06). Definitivo: sem exclusão física. */
export async function inactivateProduct(
  productId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("products")
    .update({ status: "inactive" })
    .eq("id", productId);
  if (error)
    return { ok: false, message: "Não foi possível inativar o produto agora. Tente novamente." };
  return { ok: true };
}

export type PackagingFormData = { name: string; barcode: string; conversionFactor: string };

function friendlyPackagingError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("product_packagings_conversion_factor_check"))
    return "O fator de conversão precisa ser maior que zero.";
  if (lower.includes("product_packagings_barcode_check"))
    return "Código de barras inválido: use só números (6 a 14 dígitos).";
  return "Não foi possível salvar a embalagem agora. Tente novamente.";
}

export async function createPackaging(
  productId: string,
  data: PackagingFormData,
): Promise<{ ok: true; packaging: Packaging } | { ok: false; message: string }> {
  const payload: Database["public"]["Tables"]["product_packagings"]["Insert"] = {
    product_id: productId,
    name: data.name.trim(),
    conversion_factor: Number(data.conversionFactor),
    ...(data.barcode.trim() ? { barcode: onlyDigits(data.barcode) } : {}),
  };
  const { data: row, error } = await supabase
    .from("product_packagings")
    .insert(payload)
    .select("*")
    .single();
  if (error || !row) return { ok: false, message: friendlyPackagingError(error?.message ?? "") };
  return { ok: true, packaging: mapRowToPackaging(row) };
}

/**
 * Troca o fator de conversão de uma embalagem sem reescrever o histórico
 * (RN-PROD-02/RN-CRT-EMB-04, decidido no B2.1): inativa a linha antiga e cria
 * uma nova já com o fator atualizado, mantendo o nome e o código de barras.
 */
export async function updatePackagingFactor(
  packaging: Packaging,
  newFactor: string,
): Promise<{ ok: true; packaging: Packaging } | { ok: false; message: string }> {
  const { error: inactivateError } = await supabase
    .from("product_packagings")
    .update({ status: "inactive" })
    .eq("id", packaging.id);
  if (inactivateError)
    return { ok: false, message: "Não foi possível atualizar a embalagem agora. Tente novamente." };

  const payload: Database["public"]["Tables"]["product_packagings"]["Insert"] = {
    product_id: packaging.productId,
    name: packaging.name,
    conversion_factor: Number(newFactor),
    is_base: packaging.isBase,
    ...(packaging.barcode ? { barcode: packaging.barcode } : {}),
  };
  const { data: row, error } = await supabase
    .from("product_packagings")
    .insert(payload)
    .select("*")
    .single();
  if (error || !row) return { ok: false, message: friendlyPackagingError(error?.message ?? "") };
  return { ok: true, packaging: mapRowToPackaging(row) };
}

/** Inativa a embalagem (RN-ACL-06). A embalagem-base do produto não pode ser inativada por aqui. */
export async function inactivatePackaging(
  packagingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("product_packagings")
    .update({ status: "inactive" })
    .eq("id", packagingId);
  if (error)
    return { ok: false, message: "Não foi possível inativar a embalagem agora. Tente novamente." };
  return { ok: true };
}
