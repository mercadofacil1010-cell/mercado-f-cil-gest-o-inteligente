// Dados fictícios de endereçamento do depósito e das gôndolas (sem banco de dados).

export type StoredItem = { product: string; quantity: number; unit: string; lot: string; expiresAt: string };

export type WarehouseAddress = {
  id: string;
  warehouse: string;
  sector: string;
  street: string;
  aisle: string;
  shelf: string;
  level: string;
  position: string;
  capacity: number;
  items: StoredItem[];
  active: boolean;
  lastMovement: string;
};

export const addressLabel = (address: Pick<WarehouseAddress, "warehouse" | "street" | "shelf" | "level" | "position">) =>
  `${address.warehouse} / Rua ${address.street} / Estante ${address.shelf} / Nível ${address.level} / Posição ${address.position}`;

export const usedCapacity = (address: WarehouseAddress) => address.items.reduce((sum, item) => sum + item.quantity, 0);

const address = (id: string, sector: string, street: string, aisle: string, shelf: string, level: string, position: string, capacity: number, items: StoredItem[], lastMovement: string, active = true): WarehouseAddress => ({ id, warehouse: "Depósito 1", sector, street, aisle, shelf, level, position, capacity, items, active, lastMovement });

export const initialAddresses: WarehouseAddress[] = [
  address("a1", "Laticínios", "A", "01", "01", "01", "01", 60, [{ product: "Leite integral 1L", quantity: 25, unit: "cx", lot: "L2310", expiresAt: "2026-12-28" }], "Hoje, 18:12"),
  address("a2", "Laticínios", "A", "01", "01", "02", "01", 60, [{ product: "Leite integral 1L", quantity: 18, unit: "cx", lot: "L2295", expiresAt: "2026-11-05" }], "Hoje, 16:40"),
  address("a3", "Mercearia", "B", "02", "03", "01", "02", 40, [{ product: "Arroz tipo 1 5kg", quantity: 6, unit: "fd", lot: "A7781", expiresAt: "2027-03-15" }], "Hoje, 14:05"),
  address("a4", "Mercearia", "B", "02", "03", "02", "04", 40, [{ product: "Café tradicional 500g", quantity: 34, unit: "cx", lot: "C0921", expiresAt: "2026-11-18" }, { product: "Açúcar refinado 1kg", quantity: 4, unit: "fd", lot: "S1102", expiresAt: "2027-06-01" }], "Ontem, 19:22"),
  address("a5", "Mercearia", "B", "02", "05", "01", "01", 40, [], "20/09, 10:15"),
  address("a6", "Bebidas", "C", "03", "02", "01", "01", 80, [{ product: "Refrigerante cola 2L", quantity: 52, unit: "fd", lot: "B5521", expiresAt: "2027-02-01" }], "Hoje, 11:30"),
  address("a7", "Bebidas", "C", "03", "02", "02", "01", 80, [{ product: "Água mineral 500ml", quantity: 78, unit: "fd", lot: "W0034", expiresAt: "2027-08-10" }], "Hoje, 09:02"),
  address("a8", "Limpeza", "D", "04", "01", "01", "03", 50, [], "15/09, 17:40", false),
];

export type ShelfPosition = {
  id: string;
  module: number;
  position: number;
  product: string | null;
  quantity: number;
  min: number;
  ideal: number;
  max: number;
  capacity: number;
  faces: number;
  priority: "Alta" | "Média" | "Baixa";
  active: boolean;
};

export type Gondola = {
  id: string;
  sector: string;
  aisle: string;
  number: string;
  side: "A" | "B";
  modules: number;
  shelves: ShelfPosition[][]; // índice 0 = prateleira superior
};

const pos = (id: string, module: number, position: number, product: string | null, quantity: number, min: number, ideal: number, max: number, faces = 2, priority: ShelfPosition["priority"] = "Média", active = true): ShelfPosition => ({ id, module, position, product, quantity, min, ideal, max, capacity: max + Math.round(max * 0.2), faces, priority, active });

export const initialGondolas: Gondola[] = [
  {
    id: "g4", sector: "Mercearia", aisle: "04", number: "04", side: "A", modules: 2,
    shelves: [
      [pos("g4-1-1", 1, 1, "Café tradicional 500g", 22, 12, 30, 40, 3), pos("g4-1-2", 1, 2, "Café extraforte 500g", 9, 10, 24, 30, 2, "Alta"), pos("g4-1-3", 2, 1, "Chá mate 250g", 14, 6, 16, 20), pos("g4-1-4", 2, 2, null, 0, 0, 0, 0, 1, "Baixa", false)],
      [pos("g4-2-1", 1, 1, "Arroz tipo 1 5kg", 3, 8, 20, 24, 4, "Alta"), pos("g4-2-2", 1, 2, "Arroz integral 1kg", 11, 6, 14, 18), pos("g4-2-3", 2, 1, "Feijão carioca 1kg", 16, 10, 24, 30, 3), pos("g4-2-4", 2, 2, "Feijão preto 1kg", 8, 6, 16, 20)],
      [pos("g4-3-1", 1, 1, "Açúcar refinado 1kg", 26, 12, 30, 36, 3), pos("g4-3-2", 1, 2, "Açúcar cristal 1kg", 12, 10, 24, 30), pos("g4-3-3", 2, 1, "Farinha de trigo 1kg", 7, 8, 18, 24, 2, "Alta"), pos("g4-3-4", 2, 2, "Fubá 500g", 15, 6, 14, 18)],
      [pos("g4-4-1", 1, 1, "Óleo de soja 900ml", 30, 12, 32, 40, 4), pos("g4-4-2", 1, 2, "Azeite 500ml", 6, 4, 10, 12, 2, "Baixa"), pos("g4-4-3", 2, 1, "Vinagre 750ml", 10, 6, 14, 18), pos("g4-4-4", 2, 2, "Sal refinado 1kg", 19, 8, 18, 24)],
    ],
  },
  {
    id: "g2", sector: "Laticínios", aisle: "02", number: "02", side: "B", modules: 2,
    shelves: [
      [pos("g2-1-1", 1, 1, "Leite integral 1L", 48, 36, 72, 90, 6, "Alta"), pos("g2-1-2", 1, 2, "Leite desnatado 1L", 20, 18, 36, 48, 3), pos("g2-1-3", 2, 1, "Leite sem lactose 1L", 12, 12, 24, 30, 2)],
      [pos("g2-2-1", 1, 1, "Iogurte morango 170g", 10, 12, 30, 36, 3, "Alta"), pos("g2-2-2", 1, 2, "Iogurte natural 170g", 14, 10, 24, 30), pos("g2-2-3", 2, 1, "Bebida láctea 1L", 0, 8, 16, 20, 2, "Alta")],
      [pos("g2-3-1", 1, 1, "Manteiga 200g", 16, 8, 18, 24, 2), pos("g2-3-2", 1, 2, "Requeijão 200g", 13, 10, 20, 24), pos("g2-3-3", 2, 1, null, 0, 0, 0, 0, 1, "Baixa", false)],
    ],
  },
];

export type ShelfState = "normal" | "near" | "below" | "empty";

export function shelfState(position: ShelfPosition): ShelfState {
  if (!position.active || !position.product) return "empty";
  if (position.quantity < position.min) return "below";
  if (position.quantity <= position.min + Math.max(1, Math.round((position.ideal - position.min) * 0.3))) return "near";
  return "normal";
}

export type MovementType = "Recebimento → Depósito" | "Endereço → Endereço" | "Depósito → Gôndola" | "Mercado → Mercado";
export const movementTypes: MovementType[] = ["Recebimento → Depósito", "Endereço → Endereço", "Depósito → Gôndola", "Mercado → Mercado"];

export type Movement = { id: string; type: MovementType; product: string; quantity: number; unit: string; origin: string; destination: string; user: string; time: string };

export const initialMovements: Movement[] = [
  { id: "m3", type: "Depósito → Gôndola", product: "Leite integral 1L", quantity: 24, unit: "un.", origin: "Depósito 1 / Rua A / Estante 01 / Nível 01 / Posição 01", destination: "Gôndola 02 · Prateleira 1 · Módulo 1 · Posição 1", user: "João Pereira", time: "Hoje, 18:12" },
  { id: "m2", type: "Recebimento → Depósito", product: "Café tradicional 500g", quantity: 10, unit: "cx", origin: "Recebimento REC-2041", destination: "Depósito 1 / Rua B / Estante 03 / Nível 02 / Posição 04", user: "Ana Ribeiro", time: "Hoje, 14:05" },
  { id: "m1", type: "Mercado → Mercado", product: "Refrigerante cola 2L", quantity: 8, unit: "fd", origin: "Mercado Central", destination: "Mercado Jardim", user: "Carlos Mendes", time: "Hoje, 11:30" },
];
