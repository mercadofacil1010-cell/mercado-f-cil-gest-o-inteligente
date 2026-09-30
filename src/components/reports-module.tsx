// Relatórios (B8.2, RF-RPT-01/03/05/06). Um seletor de relatório + período
// + produto, tabela genérica (as colunas vêm do próprio relatório) e um
// botão de exportar CSV — gerado no navegador, sem nada guardado no
// servidor (RN-RPT-04/PA-50). RF-RPT-05 (detalhar até a origem): cada linha
// já É um evento de origem (movimento, venda, ocorrência...), não um
// agregado — não há "detalhe" mais fundo para abrir.
import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartCard } from "@/components/dashboard-ui";
import {
  downloadCsv,
  getReport,
  logReportExport,
  reportColumnLabel,
  reportTypeLabel,
  reportUsesPeriod,
  rowsToCsv,
  type ReportRow,
  type ReportType,
} from "@/lib/reports-api";
import { listProducts, type Product } from "@/lib/products-api";

const reportTypes = Object.keys(reportTypeLabel) as ReportType[];

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

function formatCell(value: ReportRow[string] | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  }
  return String(value);
}

export function ReportsModule({
  companyId,
  marketId,
  notify,
}: {
  companyId: string | null;
  marketId: string;
  notify: (message: string) => void;
}) {
  const [report, setReport] = useState<ReportType>("estoque_atual");
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [productId, setProductId] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) void listProducts(companyId).then(setProducts);
  }, [companyId]);

  const reload = async () => {
    setLoading(true);
    const usesPeriod = reportUsesPeriod[report];
    const dateFrom = usesPeriod
      ? new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const result = await getReport(
      marketId,
      report,
      dateFrom,
      undefined,
      productId !== "all" ? productId : undefined,
    );
    setRows(result);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao trocar relatório/período/produto/mercado
  }, [marketId, report, days, productId]);

  const handleExport = async () => {
    if (rows.length === 0) {
      notify("Nada para exportar — ajuste os filtros.");
      return;
    }
    const csv = rowsToCsv(rows);
    downloadCsv(`${report}.csv`, csv);
    if (companyId) await logReportExport(companyId, marketId, report);
    notify("Relatório exportado em CSV.");
  };

  const columns = rows.length ? Object.keys(rows[0] ?? {}) : [];

  return (
    <ChartCard
      title="Relatórios"
      subtitle="Dados calculados na hora a partir das tabelas de origem — sempre atuais, nunca um arquivo guardado (RN-RPT-04)"
      action={
        <Button size="sm" variant="outline" onClick={() => void handleExport()}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Select value={report} onValueChange={(value) => setReport(value as ReportType)}>
          <SelectTrigger className="h-10 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {reportTypeLabel[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={days}
          onValueChange={(value) => setDays(value as "7" | "30" | "90")}
          disabled={!reportUsesPeriod[report]}
        >
          <SelectTrigger className="h-10 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="h-10 bg-card">
            <SelectValue placeholder="Todos os produtos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum dado para este relatório com os filtros atuais.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                {columns.map((key) => (
                  <th key={key} className="px-3 py-2.5 font-bold">
                    {reportColumnLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/60">
                  {columns.map((key) => (
                    <td key={key} className="px-3 py-3">
                      {formatCell(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
