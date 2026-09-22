// Dados fictícios de produtos, embalagens e lotes (sem banco de dados).

/** Data de referência da demonstração, fixa para manter os dados coerentes. */
export const DEMO_TODAY = new Date(2026, 8, 22);

export type PackagingUnit = "Unidade" | "Pacote" | "Caixa" | "Fardo" | "Quilograma" | "Litro";
export const packagingUnits: PackagingUnit[] = ["Unidade", "Pacote", "Caixa", "Fardo", "Quilograma", "Litro"];

export type Packaging = { id: string; unit: PackagingUnit; quantity: number; of: PackagingUnit; barcode: string };

export type LotStatus = "Liberado" | "Bloqueado" | "Em análise";
export type Lot = {
  id: string;
  number: string;
  manufacturedAt: string; // AAAA-MM-DD
  expiresAt: string; // AAAA-MM-DD
  quantity: number;
  supplier: string;
  location: string;
  status: LotStatus;
};

export type ProductStatus = "Ativo" | "Inativo";

export type Product = {
  id: string;
  name: string;
  description: string;
  barcode: string;
  sku: string;
  brand: string;
  category: string;
  supplier: string;
  unit: PackagingUnit;
  weighable: boolean;
  photo: string;
  marketId: string;
  stock: number;
  minStock: number;
  idealStock: number;
  maxStock: number;
  reorderPoint: number;
  allowNegative: boolean;
  lotControl: boolean;
  expiryControl: boolean;
  location: string;
  cost: number;
  margin: number;
  price: number;
  promoPrice: number | null;
  promoStart: string;
  promoEnd: string;
  status: ProductStatus;
  packagings: Packaging[];
  lots: Lot[];
};

export const categories = ["Mercearia", "Laticínios", "Bebidas", "Hortifrúti", "Limpeza", "Padaria", "Frios"];
export const suppliers = ["Distribuidora Bom Preço", "Laticínios Serra Azul", "Bebidas Sul", "Hortifrúti Vale Verde", "Limpa Tudo Atacado"];

const lot = (id: string, number: string, manufacturedAt: string, expiresAt: string, quantity: number, supplier: string, location: string, status: LotStatus = "Liberado"): Lot => ({ id, number, manufacturedAt, expiresAt, quantity, supplier, location, status });

export const initialProducts: Product[] = [
  {
    id: "p1", name: "Leite integral 1L", description: "Leite UHT integral, caixa 1 litro.", barcode: "7891000100103", sku: "LAT-0001", brand: "Serra Azul", category: "Laticínios", supplier: "Laticínios Serra Azul", unit: "Unidade", weighable: false, photo: "",
    marketId: "central", stock: 486, minStock: 240, idealStock: 600, maxStock: 900, reorderPoint: 300, allowNegative: false, lotControl: true, expiryControl: true, location: "Depósito 1 / Rua A / Estante 01", cost: 4.1, margin: 32, price: 5.49, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 12, of: "Unidade", barcode: "17891000100100" }, { id: "k2", unit: "Fardo", quantity: 6, of: "Caixa", barcode: "27891000100107" }],
    lots: [lot("l1", "L2310", "2026-07-02", "2026-12-28", 300, "Laticínios Serra Azul", "Depósito 1 / Rua A / Estante 01"), lot("l2", "L2295", "2026-06-10", "2026-11-05", 186, "Laticínios Serra Azul", "Gôndola 02 / Prateleira 1")],
  },
  {
    id: "p2", name: "Arroz tipo 1 5kg", description: "Arroz agulhinha tipo 1.", barcode: "7896006711117", sku: "MER-0102", brand: "Grão Nobre", category: "Mercearia", supplier: "Distribuidora Bom Preço", unit: "Pacote", weighable: false, photo: "",
    marketId: "central", stock: 38, minStock: 60, idealStock: 180, maxStock: 260, reorderPoint: 80, allowNegative: false, lotControl: true, expiryControl: true, location: "Depósito 1 / Rua B / Estante 03", cost: 21.9, margin: 28, price: 27.99, promoPrice: 25.9, promoStart: "2026-09-20", promoEnd: "2026-09-30", status: "Ativo",
    packagings: [{ id: "k1", unit: "Fardo", quantity: 6, of: "Pacote", barcode: "17896006711114" }],
    lots: [lot("l1", "A7781", "2026-03-15", "2027-03-15", 38, "Distribuidora Bom Preço", "Depósito 1 / Rua B / Estante 03")],
  },
  {
    id: "p3", name: "Café tradicional 500g", description: "Café torrado e moído.", barcode: "7896089011111", sku: "MER-0230", brand: "Aroma do Sul", category: "Mercearia", supplier: "Distribuidora Bom Preço", unit: "Pacote", weighable: false, photo: "",
    marketId: "jardim", stock: 124, minStock: 80, idealStock: 200, maxStock: 300, reorderPoint: 100, allowNegative: false, lotControl: true, expiryControl: true, location: "Depósito 1 / Rua B / Estante 05", cost: 14.2, margin: 35, price: 19.19, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 20, of: "Pacote", barcode: "17896089011118" }],
    lots: [lot("l1", "C0921", "2026-05-01", "2026-11-18", 124, "Distribuidora Bom Preço", "Depósito 1 / Rua B / Estante 05")],
  },
  {
    id: "p4", name: "Iogurte morango 170g", description: "Iogurte polpa de morango.", barcode: "7891025100170", sku: "LAT-0310", brand: "Serra Azul", category: "Laticínios", supplier: "Laticínios Serra Azul", unit: "Unidade", weighable: false, photo: "",
    marketId: "central", stock: 36, minStock: 40, idealStock: 120, maxStock: 160, reorderPoint: 50, allowNegative: false, lotControl: true, expiryControl: true, location: "Câmara fria 1 / Nível 02", cost: 2.3, margin: 40, price: 3.49, promoPrice: 2.99, promoStart: "2026-09-22", promoEnd: "2026-09-26", status: "Ativo",
    packagings: [{ id: "k1", unit: "Pacote", quantity: 4, of: "Unidade", barcode: "17891025100177" }, { id: "k2", unit: "Caixa", quantity: 6, of: "Pacote", barcode: "27891025100174" }],
    lots: [lot("l1", "L2309", "2026-09-01", "2026-09-26", 36, "Laticínios Serra Azul", "Câmara fria 1 / Nível 02")],
  },
  {
    id: "p5", name: "Queijo muçarela fatiado 150g", description: "Muçarela fatiada, bandeja.", barcode: "7891097015004", sku: "FRI-0044", brand: "Campo Belo", category: "Frios", supplier: "Laticínios Serra Azul", unit: "Unidade", weighable: false, photo: "",
    marketId: "jardim", stock: 18, minStock: 20, idealStock: 60, maxStock: 90, reorderPoint: 25, allowNegative: false, lotControl: true, expiryControl: true, location: "Câmara fria 1 / Nível 01", cost: 7.8, margin: 38, price: 10.99, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 10, of: "Unidade", barcode: "17891097015001" }],
    lots: [lot("l1", "Q8812", "2026-09-05", "2026-09-29", 12, "Laticínios Serra Azul", "Câmara fria 1 / Nível 01"), lot("l2", "Q8790", "2026-08-20", "2026-09-18", 6, "Laticínios Serra Azul", "Câmara fria 1 / Nível 01", "Bloqueado")],
  },
  {
    id: "p6", name: "Refrigerante cola 2L", description: "Refrigerante sabor cola, garrafa PET.", barcode: "7894900011517", sku: "BEB-0012", brand: "Fizz", category: "Bebidas", supplier: "Bebidas Sul", unit: "Unidade", weighable: false, photo: "",
    marketId: "avenida", stock: 312, minStock: 120, idealStock: 360, maxStock: 500, reorderPoint: 150, allowNegative: false, lotControl: true, expiryControl: true, location: "Depósito 1 / Rua C / Estante 02", cost: 6.2, margin: 45, price: 8.99, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Fardo", quantity: 6, of: "Unidade", barcode: "17894900011514" }],
    lots: [lot("l1", "B5521", "2026-08-01", "2027-02-01", 312, "Bebidas Sul", "Depósito 1 / Rua C / Estante 02")],
  },
  {
    id: "p7", name: "Banana prata", description: "Banana prata a granel.", barcode: "2000001000017", sku: "HOR-0001", brand: "Vale Verde", category: "Hortifrúti", supplier: "Hortifrúti Vale Verde", unit: "Quilograma", weighable: true, photo: "",
    marketId: "central", stock: 84, minStock: 50, idealStock: 120, maxStock: 160, reorderPoint: 60, allowNegative: false, lotControl: false, expiryControl: true, location: "Área de vendas / Bancada 01", cost: 3.9, margin: 55, price: 6.49, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 18, of: "Quilograma", barcode: "" }],
    lots: [lot("l1", "H0922", "2026-09-20", "2026-09-27", 84, "Hortifrúti Vale Verde", "Área de vendas / Bancada 01")],
  },
  {
    id: "p8", name: "Detergente neutro 500ml", description: "Detergente lava-louças neutro.", barcode: "7891022100501", sku: "LIM-0101", brand: "Brilho", category: "Limpeza", supplier: "Limpa Tudo Atacado", unit: "Unidade", weighable: false, photo: "",
    marketId: "avenida", stock: 0, minStock: 48, idealStock: 144, maxStock: 240, reorderPoint: 60, allowNegative: false, lotControl: false, expiryControl: false, location: "Depósito 1 / Rua D / Estante 01", cost: 1.6, margin: 60, price: 2.59, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 24, of: "Unidade", barcode: "17891022100508" }],
    lots: [],
  },
  {
    id: "p9", name: "Pão de forma integral", description: "Pão de forma integral 500g.", barcode: "7896002300507", sku: "PAD-0020", brand: "Trigo Bom", category: "Padaria", supplier: "Distribuidora Bom Preço", unit: "Pacote", weighable: false, photo: "",
    marketId: "jardim", stock: 22, minStock: 15, idealStock: 40, maxStock: 60, reorderPoint: 20, allowNegative: false, lotControl: true, expiryControl: true, location: "Gôndola 07 / Prateleira 3", cost: 6.4, margin: 36, price: 8.79, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 12, of: "Pacote", barcode: "17896002300504" }],
    lots: [lot("l1", "P1190", "2026-09-18", "2026-10-05", 22, "Distribuidora Bom Preço", "Gôndola 07 / Prateleira 3")],
  },
  {
    id: "p10", name: "Azeitona premium 200g", description: "Azeitona verde sem caroço.", barcode: "7898915380200", sku: "MER-0544", brand: "Oliva Real", category: "Mercearia", supplier: "Distribuidora Bom Preço", unit: "Unidade", weighable: false, photo: "",
    marketId: "avenida", stock: 42, minStock: 12, idealStock: 30, maxStock: 48, reorderPoint: 15, allowNegative: false, lotControl: true, expiryControl: true, location: "Gôndola 05 / Prateleira 4", cost: 9.1, margin: 42, price: 12.99, promoPrice: null, promoStart: "", promoEnd: "", status: "Inativo",
    packagings: [{ id: "k1", unit: "Caixa", quantity: 24, of: "Unidade", barcode: "17898915380207" }],
    lots: [lot("l1", "O3321", "2026-01-10", "2026-12-10", 42, "Distribuidora Bom Preço", "Gôndola 05 / Prateleira 4")],
  },
];

export function daysUntil(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return Number.POSITIVE_INFINITY;
  const target = new Date(year, month - 1, day);
  return Math.round((target.getTime() - DEMO_TODAY.getTime()) / 86_400_000);
}

export type ExpiryLevel = "Vencido" | "30 dias" | "60 dias" | "90 dias" | "Em dia" | "Sem validade";

export function expiryLevel(date: string | undefined): ExpiryLevel {
  if (!date) return "Sem validade";
  const days = daysUntil(date);
  if (days < 0) return "Vencido";
  if (days <= 30) return "30 dias";
  if (days <= 60) return "60 dias";
  if (days <= 90) return "90 dias";
  return "Em dia";
}

export function nearestLot(product: Product): Lot | undefined {
  return [...product.lots].filter((item) => item.quantity > 0).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
}

export type StockLevel = "Sem estoque" | "Abaixo do mínimo" | "Normal" | "Acima do máximo";

export function stockLevel(product: Product): StockLevel {
  if (product.stock <= 0) return "Sem estoque";
  if (product.stock < product.minStock) return "Abaixo do mínimo";
  if (product.stock > product.maxStock) return "Acima do máximo";
  return "Normal";
}

export function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

export const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
