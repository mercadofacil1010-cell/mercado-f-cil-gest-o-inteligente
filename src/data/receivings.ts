// Dados fictícios de recebimentos de mercadorias (sem integração com nota fiscal).
import type { PackagingUnit } from "@/data/products";

export type ReceivingStatus = "Aguardando recebimento" | "Em conferência" | "Com divergência" | "Aguardando aprovação" | "Finalizado" | "Recusado";
export const receivingStatuses: ReceivingStatus[] = ["Aguardando recebimento", "Em conferência", "Com divergência", "Aguardando aprovação", "Finalizado", "Recusado"];

export type CatalogItem = { barcode: string; product: string; baseUnit: PackagingUnit; factors: Partial<Record<PackagingUnit, number>> };

/** Catálogo usado para identificar os produtos lidos na conferência. */
export const receivingCatalog: CatalogItem[] = [
  { barcode: "7891000100103", product: "Leite integral 1L", baseUnit: "Unidade", factors: { Unidade: 1, Caixa: 12, Fardo: 72 } },
  { barcode: "7891025100170", product: "Iogurte morango 170g", baseUnit: "Unidade", factors: { Unidade: 1, Pacote: 4, Caixa: 24 } },
  { barcode: "7891097015004", product: "Queijo muçarela fatiado 150g", baseUnit: "Unidade", factors: { Unidade: 1, Caixa: 10 } },
  { barcode: "7896089011111", product: "Café tradicional 500g", baseUnit: "Pacote", factors: { Pacote: 1, Caixa: 20 } },
  { barcode: "7896006711117", product: "Arroz tipo 1 5kg", baseUnit: "Pacote", factors: { Pacote: 1, Fardo: 6 } },
  { barcode: "7894900011517", product: "Refrigerante cola 2L", baseUnit: "Unidade", factors: { Unidade: 1, Fardo: 6 } },
  { barcode: "7891022100501", product: "Detergente neutro 500ml", baseUnit: "Unidade", factors: { Unidade: 1, Caixa: 24 } },
  { barcode: "2000001000017", product: "Banana prata", baseUnit: "Quilograma", factors: { Quilograma: 1, Caixa: 18 } },
  { barcode: "7898000000011", product: "Achocolatado 400g", baseUnit: "Unidade", factors: { Unidade: 1, Caixa: 24 } },
];

export type ExpectedItem = { barcode: string; product: string; quantity: number; unit: PackagingUnit; lot: string };

export type ProductCondition = "Bom estado" | "Avariado" | "Embalagem violada" | "Vencido";

export type CountedItem = {
  id: string;
  barcode: string;
  product: string;
  packaging: PackagingUnit;
  quantity: number;
  baseQuantity: number;
  lot: string;
  manufacturedAt: string;
  expiresAt: string;
  condition: ProductCondition;
  photo: string;
  note: string;
};

export type ResultLine = {
  barcode: string;
  product: string;
  expected: number;
  counted: number;
  unit: PackagingUnit;
  missing: number;
  surplus: number;
  notRequested: boolean;
  damaged: number;
  lotMismatch: boolean;
  badExpiry: boolean;
  refused: boolean;
};

export type Receiving = {
  id: string;
  supplier: string;
  invoice: string;
  date: string;
  time: string;
  employee: string;
  volumes: number;
  showVolumes: boolean;
  status: ReceivingStatus;
  divergences: number;
  durationMinutes: number | null;
  expected: ExpectedItem[];
  counted: CountedItem[];
  approvedWithDivergence: boolean;
  refusedBarcodes: string[];
  attempts: number;
};

const base = { counted: [], approvedWithDivergence: false, refusedBarcodes: [], attempts: 0 } satisfies Partial<Receiving>;

export const initialReceivings: Receiving[] = [
  {
    ...base, id: "REC-2045", supplier: "Laticínios Serra Azul", invoice: "48.213", date: "22/09/2026", time: "18:20", employee: "Ana Ribeiro", volumes: 14, showVolumes: true, status: "Aguardando recebimento", divergences: 0, durationMinutes: null,
    expected: [
      { barcode: "7891000100103", product: "Leite integral 1L", quantity: 120, unit: "Unidade", lot: "L2330" },
      { barcode: "7891025100170", product: "Iogurte morango 170g", quantity: 48, unit: "Unidade", lot: "L2331" },
      { barcode: "7891097015004", product: "Queijo muçarela fatiado 150g", quantity: 20, unit: "Unidade", lot: "Q8840" },
    ],
  },
  {
    ...base, id: "REC-2044", supplier: "Distribuidora Bom Preço", invoice: "77.105", date: "22/09/2026", time: "17:36", employee: "Ana Ribeiro", volumes: 22, showVolumes: false, status: "Em conferência", divergences: 0, durationMinutes: null, attempts: 1,
    expected: [
      { barcode: "7896089011111", product: "Café tradicional 500g", quantity: 60, unit: "Pacote", lot: "C0950" },
      { barcode: "7896006711117", product: "Arroz tipo 1 5kg", quantity: 36, unit: "Pacote", lot: "A7802" },
    ],
  },
  {
    ...base, id: "REC-2043", supplier: "Bebidas Sul", invoice: "10.884", date: "22/09/2026", time: "10:12", employee: "Pedro Martins", volumes: 30, showVolumes: true, status: "Com divergência", divergences: 2, durationMinutes: 38,
    expected: [{ barcode: "7894900011517", product: "Refrigerante cola 2L", quantity: 180, unit: "Unidade", lot: "B5540" }],
  },
  {
    ...base, id: "REC-2042", supplier: "Hortifrúti Vale Verde", invoice: "3.320", date: "22/09/2026", time: "07:05", employee: "Ana Ribeiro", volumes: 12, showVolumes: true, status: "Aguardando aprovação", divergences: 1, durationMinutes: 21,
    expected: [{ barcode: "2000001000017", product: "Banana prata", quantity: 216, unit: "Quilograma", lot: "H0922" }],
  },
  {
    ...base, id: "REC-2041", supplier: "Distribuidora Bom Preço", invoice: "77.001", date: "21/09/2026", time: "15:40", employee: "Pedro Martins", volumes: 18, showVolumes: true, status: "Finalizado", divergences: 0, durationMinutes: 26,
    expected: [{ barcode: "7896089011111", product: "Café tradicional 500g", quantity: 40, unit: "Pacote", lot: "C0921" }],
  },
  {
    ...base, id: "REC-2039", supplier: "Limpa Tudo Atacado", invoice: "5.902", date: "20/09/2026", time: "09:18", employee: "Ana Ribeiro", volumes: 8, showVolumes: true, status: "Recusado", divergences: 3, durationMinutes: 17,
    expected: [{ barcode: "7891022100501", product: "Detergente neutro 500ml", quantity: 96, unit: "Unidade", lot: "D1120" }],
  },
];

const counted = (id: string, barcode: string, product: string, packaging: PackagingUnit, quantity: number, factor: number, lot: string, expiresAt: string, condition: ProductCondition = "Bom estado"): CountedItem => ({ id, barcode, product, packaging, quantity, baseQuantity: quantity * factor, lot, manufacturedAt: "", expiresAt, condition, photo: "", note: "" });

// Contagens já realizadas nos recebimentos concluídos, para que os resultados façam sentido.
const seededCounts: Record<string, CountedItem[]> = {
  "REC-2043": [counted("c1", "7894900011517", "Refrigerante cola 2L", "Fardo", 28, 6, "B5540", "2027-03-01"), counted("c2", "7894900011517", "Refrigerante cola 2L", "Unidade", 4, 1, "B5540", "2027-03-01", "Avariado")],
  "REC-2042": [counted("c1", "2000001000017", "Banana prata", "Caixa", 11, 18, "H0922", "2026-09-27")],
  "REC-2041": [counted("c1", "7896089011111", "Café tradicional 500g", "Caixa", 2, 20, "C0921", "2026-11-18")],
  "REC-2039": [counted("c1", "7891022100501", "Detergente neutro 500ml", "Caixa", 3, 24, "D1099", "2027-01-10", "Embalagem violada"), counted("c2", "7898000000011", "Achocolatado 400g", "Caixa", 1, 24, "X0001", "2027-02-01")],
};

for (const receiving of initialReceivings) receiving.counted = seededCounts[receiving.id] ?? [];
