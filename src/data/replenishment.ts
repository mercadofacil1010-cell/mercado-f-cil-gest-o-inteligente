// Dados fictícios das tarefas de reposição do aplicativo do repositor.

export type TaskPriority = "Urgente" | "Alta" | "Normal";
export type TaskStatus = "Pendente" | "Em andamento" | "Concluída" | "Aguardando gerente" | "Com ocorrência";

export type ReplenishmentTask = {
  id: string;
  product: string;
  barcode: string;
  category: string;
  gondola: string;
  gondolaCode: string;
  warehouse: string;
  warehouseCode: string;
  priority: TaskPriority;
  suggested: number;
  unit: string;
  requestedAt: string;
  waitingMinutes: number;
  /** Quantidade que o sistema calcula na prateleira. Nunca é mostrada antes da contagem. */
  shelfExpected: number;
  status: TaskStatus;
};

export const stockerProfile = { name: "João Pereira", market: "Mercado Central", shift: "Tarde · 14h às 22h", completedToday: 12 };

export const initialTasks: ReplenishmentTask[] = [
  { id: "T-318", product: "Arroz tipo 1 5kg", barcode: "7896006711117", category: "Mercearia", gondola: "Gôndola 04 · Prateleira 2 · Posição 1", gondolaCode: "G04-P2-01", warehouse: "Depósito 1 / Rua B / Estante 03 / Nível 01 / Posição 02", warehouseCode: "D1-B-03-01-02", priority: "Urgente", suggested: 17, unit: "pct", requestedAt: "17:48", waitingMinutes: 32, shelfExpected: 3, status: "Pendente" },
  { id: "T-319", product: "Leite integral 1L", barcode: "7891000100103", category: "Laticínios", gondola: "Gôndola 02 · Prateleira 1 · Posição 1", gondolaCode: "G02-P1-01", warehouse: "Depósito 1 / Rua A / Estante 01 / Nível 01 / Posição 01", warehouseCode: "D1-A-01-01-01", priority: "Alta", suggested: 24, unit: "un.", requestedAt: "18:02", waitingMinutes: 18, shelfExpected: 48, status: "Pendente" },
  { id: "T-320", product: "Café extraforte 500g", barcode: "7896089011128", category: "Mercearia", gondola: "Gôndola 04 · Prateleira 1 · Posição 2", gondolaCode: "G04-P1-02", warehouse: "Depósito 1 / Rua B / Estante 03 / Nível 02 / Posição 04", warehouseCode: "D1-B-03-02-04", priority: "Urgente", suggested: 15, unit: "pct", requestedAt: "18:05", waitingMinutes: 15, shelfExpected: 9, status: "Pendente" },
  { id: "T-321", product: "Farinha de trigo 1kg", barcode: "7896005200016", category: "Mercearia", gondola: "Gôndola 04 · Prateleira 3 · Posição 3", gondolaCode: "G04-P3-03", warehouse: "Depósito 1 / Rua B / Estante 05 / Nível 01 / Posição 01", warehouseCode: "D1-B-05-01-01", priority: "Normal", suggested: 11, unit: "pct", requestedAt: "18:11", waitingMinutes: 9, shelfExpected: 7, status: "Pendente" },
  { id: "T-322", product: "Iogurte morango 170g", barcode: "7891025100170", category: "Laticínios", gondola: "Gôndola 02 · Prateleira 2 · Posição 1", gondolaCode: "G02-P2-01", warehouse: "Câmara fria 1 / Nível 02", warehouseCode: "CF1-02", priority: "Normal", suggested: 20, unit: "un.", requestedAt: "18:14", waitingMinutes: 6, shelfExpected: 10, status: "Pendente" },
];
