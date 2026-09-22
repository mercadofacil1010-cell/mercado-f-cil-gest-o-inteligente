// Dados fictícios dos mercados usados na demonstração (sem banco de dados).

export type MarketStatus = "Aberto" | "Fechado";

export type Market = {
  id: string;
  code: string;
  name: string;
  status: MarketStatus;
  address: string;
  phone: string;
  manager: string;
  revenue: number;
  sales: number;
  replenishments: number;
  stockAlerts: number;
  expiryAlerts: number;
  inconsistencies: number;
  updatedAt: string;
};

export const initialMarkets: Market[] = [
  {
    id: "central",
    code: "UND-001",
    name: "Mercado Central",
    status: "Aberto",
    address: "Av. Brasil, 1240 · Centro",
    phone: "(11) 3456-7800",
    manager: "Carlos Mendes",
    revenue: 82450,
    sales: 742,
    replenishments: 7,
    stockAlerts: 4,
    expiryAlerts: 3,
    inconsistencies: 2,
    updatedAt: "18:17",
  },
  {
    id: "jardim",
    code: "UND-002",
    name: "Mercado Jardim",
    status: "Aberto",
    address: "Rua das Flores, 455 · Jardim Sul",
    phone: "(11) 3456-7810",
    manager: "Fernanda Lima",
    revenue: 61780,
    sales: 583,
    replenishments: 4,
    stockAlerts: 2,
    expiryAlerts: 5,
    inconsistencies: 1,
    updatedAt: "18:15",
  },
  {
    id: "avenida",
    code: "UND-003",
    name: "Mercado Avenida",
    status: "Fechado",
    address: "Av. das Nações, 890 · Bela Vista",
    phone: "(11) 3456-7820",
    manager: "Rafael Souza",
    revenue: 40060,
    sales: 391,
    replenishments: 3,
    stockAlerts: 3,
    expiryAlerts: 1,
    inconsistencies: 1,
    updatedAt: "17:58",
  },
];

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
