// Relatórios (B8.2, RF-RPT-*/REL-01..12). Um só ponto de entrada
// (`getReport`) para os 12 tipos — a tela desenha as colunas genericamente
// a partir das chaves que vierem e monta o CSV em cima do mesmo dado
// (RN-RPT-04: nada fica armazenado no servidor, sempre calculado na hora a
// partir das tabelas de origem, cuja retenção já é indefinida).
import { supabase } from "@/integrations/supabase/client";

export type ReportType =
  | "estoque_atual"
  | "movimentacoes"
  | "recebimentos"
  | "divergencias_recebimento"
  | "reposicoes"
  | "rupturas"
  | "validade"
  | "perdas"
  | "vendas"
  | "sem_giro"
  | "inconsistencias"
  | "transferencias"
  | "auditoria";

export const reportTypeLabel: Record<ReportType, string> = {
  estoque_atual: "Estoque atual",
  movimentacoes: "Extrato de movimentações",
  recebimentos: "Recebimentos",
  divergencias_recebimento: "Divergências de recebimento",
  reposicoes: "Reposições",
  rupturas: "Rupturas",
  validade: "Validade",
  perdas: "Perdas",
  vendas: "Vendas",
  sem_giro: "Produtos sem giro",
  inconsistencias: "Inconsistências",
  transferencias: "Transferências",
  auditoria: "Auditoria",
};

/** Relatórios cujo filtro de período faz sentido (os demais mostram o estado atual). */
export const reportUsesPeriod: Record<ReportType, boolean> = {
  estoque_atual: false,
  movimentacoes: true,
  recebimentos: true,
  divergencias_recebimento: true,
  reposicoes: true,
  rupturas: false,
  validade: false,
  perdas: true,
  vendas: true,
  sem_giro: true,
  inconsistencias: true,
  transferencias: true,
  auditoria: true,
};

export type ReportRow = Record<string, string | number | boolean | null>;

/** RF-RPT-01/05/06, RN-RPT-01: mesma permissão e isolamento das telas operacionais. */
export async function getReport(
  marketId: string,
  report: ReportType,
  dateFrom?: string,
  dateTo?: string,
  productId?: string,
): Promise<ReportRow[]> {
  const { data, error } = await supabase.rpc("get_report", {
    p_market_id: marketId,
    p_report: report,
    ...(dateFrom ? { p_date_from: dateFrom } : {}),
    ...(dateTo ? { p_date_to: dateTo } : {}),
    ...(productId ? { p_product_id: productId } : {}),
  });
  if (error || !data) return [];
  return data as ReportRow[];
}

const columnLabels: Record<string, string> = {
  endereco: "Endereço",
  produto: "Produto",
  saldo: "Saldo",
  data: "Data",
  tipo: "Tipo",
  quantidade: "Quantidade",
  referencia: "Referência",
  responsavel: "Responsável",
  finalizado_em: "Finalizado em",
  situacao: "Situação",
  fornecedor: "Fornecedor",
  nota_fiscal: "Nota fiscal",
  esperado: "Esperado",
  contado: "Contado",
  diferenca: "Diferença",
  gravidade: "Gravidade",
  concluida_em: "Concluída em",
  posicao: "Posição",
  quantidade_necessaria: "Quantidade necessária",
  ruptura: "Ruptura",
  saldo_atual: "Saldo atual",
  minimo: "Mínimo",
  lote: "Lote",
  vencimento: "Vencimento",
  motivo: "Motivo",
  caixa: "Caixa",
  preco_unitario: "Preço unitário",
  quantidade_vendida: "Quantidade vendida",
  origem: "Origem",
  descricao: "Descrição",
  destino: "Destino",
  acao: "Ação",
  entidade: "Entidade",
  entidade_id: "Registro",
  campos_alterados: "Campos alterados",
};

export function reportColumnLabel(key: string): string {
  return columnLabels[key] ?? key;
}

function toCsvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Gera o CSV no navegador — nenhum arquivo fica salvo no servidor (RN-RPT-04/PA-50). */
export function rowsToCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0] ?? {});
  const header = columns.map((key) => toCsvField(reportColumnLabel(key))).join(",");
  const lines = rows.map((row) => columns.map((key) => toCsvField(row[key])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** AUD-10: registra a exportação (evento de auditoria genérico, mesma função de sempre). */
export async function logReportExport(companyId: string, marketId: string, report: ReportType) {
  await supabase.rpc("log_audit_event", {
    p_entity: "report_export",
    p_company_id: companyId,
    p_market_id: marketId,
    p_details: { report },
  });
}
