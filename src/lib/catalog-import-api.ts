// Importação e exportação do catálogo em CSV (B2.4, RF-PROD-08). Decisões
// (DECISOES.md): só dados do produto (embalagem-base nasce automática, as
// demais continuam manuais); linha com código de barras já existente
// atualiza o produto (casando pelo código); categoria/marca citadas e ainda
// não cadastradas são criadas automaticamente pelo nome.
import {
  createBrand,
  createCategory,
  createProduct,
  findProductByBarcode,
  listBrands,
  listCategories,
  listProducts,
  updateProduct,
  type BaseUnit,
  type ProductFormData,
} from "@/lib/products-api";

export const CSV_HEADERS = [
  "nome",
  "codigo_de_barras",
  "sku",
  "categoria",
  "marca",
  "unidade_base",
  "pesavel",
  "controla_lote_e_validade",
  "descricao",
] as const;

const BASE_UNIT_ALIASES: Record<string, BaseUnit> = {
  unidade: "unidade",
  un: "unidade",
  quilograma: "quilograma",
  kg: "quilograma",
  litro: "litro",
  l: "litro",
};

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseBoolean(value: string): boolean {
  const normalized = normalize(value);
  return normalized === "sim" || normalized === "true" || normalized === "1";
}

/** Modelo de planilha (CSV) para importação de produtos. */
export function buildTemplateCsv(): string {
  const example = [
    "Arroz Branco Tipo 1 5kg",
    "7891234567895",
    "ARZ-5KG",
    "Mercearia",
    "Marca Própria",
    "unidade",
    "não",
    "não",
    "",
  ];
  return toCsvLine(CSV_HEADERS as unknown as string[]) + "\n" + toCsvLine(example) + "\n";
}

function toCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsvLine(fields: string[]): string {
  return fields.map(toCsvField).join(",");
}

/** Parser simples de CSV (separador vírgula, aspas duplas para escapar). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      if (field !== "" || row.length > 0) pushRow();
    } else if (char === "\r") {
      // ignora — quebra de linha é tratada pelo \n
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

export type ImportRowError = { line: number; message: string };
export type ImportResult = {
  created: number;
  updated: number;
  errors: ImportRowError[];
};

/** Importa um CSV de produtos para o catálogo da empresa (B2.4). */
export async function importProductsCsv(companyId: string, csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  const result: ImportResult = { created: 0, updated: 0, errors: [] };
  if (rows.length === 0) {
    result.errors.push({ line: 0, message: "Planilha vazia." });
    return result;
  }

  const header = (rows[0] ?? []).map((value) => normalize(value).replace(/\s+/g, "_"));
  const columnIndex = (name: string) => header.indexOf(name);
  const idx = {
    nome: columnIndex("nome"),
    codigo_de_barras: columnIndex("codigo_de_barras"),
    sku: columnIndex("sku"),
    categoria: columnIndex("categoria"),
    marca: columnIndex("marca"),
    unidade_base: columnIndex("unidade_base"),
    pesavel: columnIndex("pesavel"),
    controla_lote_e_validade: columnIndex("controla_lote_e_validade"),
    descricao: columnIndex("descricao"),
  };
  if (idx.nome === -1 || idx.unidade_base === -1) {
    result.errors.push({
      line: 1,
      message:
        'Cabeçalho inválido: as colunas "nome" e "unidade_base" são obrigatórias. Baixe o modelo e não altere os nomes das colunas.',
    });
    return result;
  }

  // Cache de categorias/marcas já vistas nesta importação (evita criar duplicadas
  // quando várias linhas citam o mesmo nome, e evita ida repetida ao banco).
  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string>();
  for (const item of await listCategories(companyId))
    categoryCache.set(normalize(item.name), item.id);
  for (const item of await listBrands(companyId)) brandCache.set(normalize(item.name), item.id);

  const resolveCategory = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const key = normalize(trimmed);
    const cached = categoryCache.get(key);
    if (cached) return cached;
    const created = await createCategory(companyId, trimmed);
    if (!created) return null;
    categoryCache.set(key, created.id);
    return created.id;
  };
  const resolveBrand = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const key = normalize(trimmed);
    const cached = brandCache.get(key);
    if (cached) return cached;
    const created = await createBrand(companyId, trimmed);
    if (!created) return null;
    brandCache.set(key, created.id);
    return created.id;
  };

  for (let i = 1; i < rows.length; i++) {
    const line = i + 1; // linha 1 é o cabeçalho
    const cols = rows[i] ?? [];
    const get = (index: number) => (index === -1 ? "" : (cols[index] ?? "").trim());

    const name = get(idx.nome);
    if (!name || name.length < 2 || name.length > 160) {
      result.errors.push({ line, message: "Nome do produto inválido (2 a 160 caracteres)." });
      continue;
    }

    const rawBaseUnit = normalize(get(idx.unidade_base));
    const baseUnit = BASE_UNIT_ALIASES[rawBaseUnit];
    if (!baseUnit) {
      result.errors.push({
        line,
        message: `Unidade base "${get(idx.unidade_base)}" inválida — use unidade, quilograma ou litro.`,
      });
      continue;
    }

    const barcodeDigits = get(idx.codigo_de_barras).replace(/\D/g, "");
    if (get(idx.codigo_de_barras) && !/^\d{6,14}$/.test(barcodeDigits)) {
      result.errors.push({
        line,
        message: "Código de barras inválido: use só números (6 a 14 dígitos).",
      });
      continue;
    }

    const categoryId = await resolveCategory(get(idx.categoria));
    const brandId = await resolveBrand(get(idx.marca));

    const form: ProductFormData = {
      name,
      description: get(idx.descricao),
      categoryId,
      brandId,
      barcode: barcodeDigits,
      sku: get(idx.sku),
      baseUnit,
      isWeighable: parseBoolean(get(idx.pesavel)),
      tracksBatchExpiry: parseBoolean(get(idx.controla_lote_e_validade)),
    };

    const existing = barcodeDigits ? await findProductByBarcode(companyId, barcodeDigits) : null;
    const outcome = existing
      ? await updateProduct(existing.id, form)
      : await createProduct(companyId, form);

    if (!outcome.ok) {
      result.errors.push({ line, message: outcome.message });
      continue;
    }
    if (existing) result.updated++;
    else result.created++;
  }

  return result;
}

/** Exporta o catálogo atual da empresa em CSV (B2.4). */
export async function exportProductsCsv(companyId: string): Promise<string> {
  const products = await listProducts(companyId);
  const lines = [toCsvLine(CSV_HEADERS as unknown as string[])];
  for (const product of products) {
    lines.push(
      toCsvLine([
        product.name,
        product.barcode,
        product.sku,
        product.categoryName,
        product.brandName,
        product.baseUnit,
        product.isWeighable ? "sim" : "não",
        product.tracksBatchExpiry ? "sim" : "não",
        product.description,
      ]),
    );
  }
  return lines.join("\n") + "\n";
}
