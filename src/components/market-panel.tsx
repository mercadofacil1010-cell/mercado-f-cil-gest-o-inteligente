import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  LayoutGrid,
  Package,
  PackageMinus,
  PackageX,
  Pencil,
  Phone,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  Warehouse,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertPill,
  ChartCard,
  ColumnChart,
  HorizontalBar,
  Metric,
  type IconType,
} from "@/components/dashboard-ui";
import { money, type Market } from "@/data/markets";
import { getMarketOperation, inconsistencies, teamMembers } from "@/data/market-operations";
import { cn } from "@/lib/utils";
import {
  getMarketDashboard,
  listMarketFeed,
  listProductSalesRanking,
  type MarketDashboard,
  type MarketFeedItem,
  type ProductRanking,
} from "@/lib/dashboard-indicators-api";
import { listAlerts, alertTypeLabel, type Alert } from "@/lib/alerts-api";

const marketTabs = [
  "Visão geral",
  "Estoque",
  "Gôndolas",
  "Depósito",
  "Recebimentos",
  "Reposições",
  "Validades",
  "Inconsistências",
  "Alertas",
  "Vendas",
  "Equipe",
  "Configurações",
] as const;
export type MarketTab = (typeof marketTabs)[number];

const feedIcons: Record<string, { icon: IconType; className: string }> = {
  venda: { icon: ShoppingCart, className: "bg-primary-soft text-primary" },
  recebimento: { icon: ArrowDownToLine, className: "bg-primary-soft text-primary" },
  reposicao: { icon: CheckCircle2, className: "bg-highlight-soft text-success" },
  inconsistencia: { icon: AlertTriangle, className: "bg-critical/10 text-critical" },
};

const periodOptions = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
] as const;

type MarketPanelProps = {
  market: Market;
  markets: Market[];
  onBack: () => void;
  onSwitch: (market: Market) => void;
  notify: (message: string) => void;
  /** Permite que módulos específicos substituam o conteúdo de uma aba. */
  renderTab?: ((tab: MarketTab, market: Market) => ReactNode) | undefined;
  onEdit?: (() => void) | undefined;
  onInactivate?: (() => void) | undefined;
};

export function MarketPanel({
  market,
  markets,
  onBack,
  onSwitch,
  notify,
  renderTab,
  onEdit,
  onInactivate,
}: MarketPanelProps) {
  const [tab, setTab] = useState<MarketTab>("Visão geral");
  const operation = useMemo(() => getMarketOperation(market), [market]);
  const custom = tab === "Visão geral" ? null : renderTab?.(tab, market);

  return (
    <section className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar para visão geral
      </Button>

      <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-panel text-sidebar-foreground">
              <Store className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{market.name}</h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                    market.status === "Aberto"
                      ? "bg-highlight-soft text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      market.status === "Aberto" ? "bg-success" : "bg-muted-foreground",
                    )}
                  />
                  {market.status === "Aberto" ? "Em funcionamento" : "Fechado"}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                  {market.code}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                <HeaderInfo icon={MapPin} label="Endereço" value={market.address} />
                <HeaderInfo icon={Phone} label="Telefone" value={market.phone} />
                <HeaderInfo icon={UserRound} label="Gerente" value={market.manager} />
                <HeaderInfo
                  icon={RefreshCw}
                  label="Última sincronização"
                  value={`Hoje às ${market.updatedAt}`}
                />
              </dl>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row 2xl:shrink-0">
            <Select
              value={market.id}
              onValueChange={(id) => {
                const next = markets.find((item) => item.id === id);
                if (next) {
                  onSwitch(next);
                  setTab("Visão geral");
                }
              }}
            >
              <SelectTrigger className="h-11 bg-card sm:w-[210px]" aria-label="Trocar de unidade">
                <Store className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {markets.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Editar mercado
            </Button>
            {onInactivate && market.lifecycleStatus !== "inactive" && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={onInactivate}
              >
                <PackageX className="h-4 w-4" /> Inativar mercado
              </Button>
            )}
            <Button
              onClick={() =>
                notify(`Convite de acesso a ${market.name} chega na etapa B1.5 (equipe).`)
              }
            >
              <Share2 className="h-4 w-4" /> Compartilhar acesso
            </Button>
          </div>
        </div>
      </div>

      <div
        className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Seções do mercado"
      >
        <div className="flex min-w-max gap-1 rounded-lg border border-border bg-card p-1">
          {marketTabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={cn(
                "rounded-md px-3.5 py-2 text-sm font-semibold transition",
                tab === item
                  ? "bg-brand-panel text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" role="tabpanel" aria-label={tab}>
        {tab === "Visão geral" && <Overview market={market} notify={notify} />}
        {tab !== "Visão geral" &&
          (custom ?? (
            <DefaultTab tab={tab} market={market} operation={operation} notify={notify} />
          ))}
      </div>
    </section>
  );
}

function HeaderInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 break-words">
        <span className="hidden font-semibold sm:inline">{label}: </span>
        {value}
      </dd>
    </div>
  );
}

type Operation = ReturnType<typeof getMarketOperation>;

function formatFeedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Painel real de indicadores (B8.1, RF-DSH-01/02/03/04/06/07) — substitui os números de demonstração. */
function Overview({ market, notify }: { market: Market; notify: (message: string) => void }) {
  const [days, setDays] = useState<"1" | "7" | "30">("1");
  const [dashboard, setDashboard] = useState<MarketDashboard | null>(null);
  const [topProducts, setTopProducts] = useState<ProductRanking[]>([]);
  const [lowProducts, setLowProducts] = useState<ProductRanking[]>([]);
  const [feed, setFeed] = useState<MarketFeedItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const periodDays = Number(days);
    void Promise.all([
      getMarketDashboard(market.id, periodDays),
      listProductSalesRanking(market.id, "top", Math.max(periodDays, 30), 5),
      listProductSalesRanking(market.id, "bottom", Math.max(periodDays, 30), 5),
      listMarketFeed(market.id, 15),
      listAlerts(market.id),
    ]).then(([d, top, low, f, a]) => {
      if (cancelled) return;
      setDashboard(d);
      setTopProducts(top);
      setLowProducts(low);
      setFeed(f);
      setAlerts(a.filter((alert) => alert.status === "aberto"));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [market.id, days]);

  const d = dashboard;
  const metrics = d
    ? [
        {
          title: "Faturamento do período",
          value: money(d.revenue),
          note: `Ticket médio: ${d.avgTicket !== null ? money(d.avgTicket) : "—"}`,
          icon: CircleDollarSign,
          tone: "positive" as const,
        },
        {
          title: "Vendas realizadas",
          value: d.salesCount.toLocaleString("pt-BR"),
          note: "Eventos de venda processados",
          icon: ShoppingCart,
        },
        {
          title: "Itens vendidos",
          value: d.itemsSold.toLocaleString("pt-BR"),
          note: "Unidades líquidas (venda − devolução)",
          icon: Package,
        },
        {
          title: "Estoque baixo",
          value: String(d.lowStockPositions),
          note: `${d.rupturaPositions} em ruptura total`,
          icon: PackageMinus,
          tone: d.lowStockPositions > 0 ? ("critical" as const) : undefined,
        },
        {
          title: "Reposições pendentes",
          value: String(d.pendingReplenishments),
          note: "Tarefas ainda não concluídas",
          icon: LayoutGrid,
          tone: d.pendingReplenishments > 0 ? ("warning" as const) : undefined,
        },
        {
          title: "Próximos do vencimento",
          value: String(d.nearExpiryLots),
          note: "Lotes dentro da janela da empresa",
          icon: CalendarClock,
          tone: d.nearExpiryLots > 0 ? ("warning" as const) : undefined,
        },
        {
          title: "Perdas do período",
          value: `${d.losses.toLocaleString("pt-BR")} un.`,
          note: "Sem custo cadastrado: em unidades",
          icon: PackageX,
          tone: d.losses > 0 ? ("critical" as const) : undefined,
        },
        {
          title: "Inconsistências abertas",
          value: String(d.openIncidents),
          note: "Divergências a revisar",
          icon: ShieldAlert,
          tone: d.openIncidents > 0 ? ("critical" as const) : undefined,
        },
        {
          title: "Acuracidade de estoque",
          value: d.accuracyPct !== null ? `${d.accuracyPct.toFixed(0)}%` : "—",
          note: "Últimos inventários finalizados (90 dias)",
          icon: RefreshCw,
        },
      ]
    : [];
  const maxTop = Math.max(1, ...topProducts.map((item) => item.quantitySold));

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={days} onValueChange={(value) => setDays(value as "1" | "7" | "30")}>
            <SelectTrigger className="h-10 w-[190px] bg-card">
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
          <span className="text-xs font-semibold text-muted-foreground">
            {d ? `Gerado às ${formatFeedTime(d.generatedAt)}` : loading ? "Carregando…" : ""}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {loading && !d ? (
            <p className="col-span-full rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Carregando indicadores…
            </p>
          ) : (
            metrics.map((metric) => <Metric key={metric.title} {...metric} />)
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Produtos mais vendidos" subtitle="Unidades líquidas no período">
            {topProducts.length ? (
              <div className="mt-6 space-y-4">
                {topProducts.map((item) => (
                  <HorizontalBar
                    key={item.productId}
                    label={item.productName}
                    value={item.quantitySold}
                    max={maxTop}
                    detail={`${item.quantitySold.toLocaleString("pt-BR")} un.`}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhuma venda processada no período.
              </p>
            )}
          </ChartCard>
          <ChartCard
            title="Produtos com menor giro"
            subtitle="Sem venda no período — considerar promoção ou revisão"
          >
            {lowProducts.length ? (
              <ul className="mt-4 space-y-2">
                {lowProducts.map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm"
                  >
                    <span className="truncate">{item.productName}</span>
                    <span className="shrink-0 font-semibold text-muted-foreground">
                      {item.quantitySold.toLocaleString("pt-BR")} un.
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhum produto parado neste mercado.
              </p>
            )}
          </ChartCard>
        </div>

        <ChartCard
          title="Operação em tempo real"
          subtitle="Últimos eventos registrados na unidade"
          action={
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-highlight-soft px-2.5 py-1 text-xs font-bold text-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Ao vivo
            </span>
          }
        >
          {feed.length ? (
            <ol className="mt-5 space-y-1">
              {feed.map((event, index) => {
                const fallbackIcon = {
                  icon: ShoppingCart,
                  className: "bg-primary-soft text-primary",
                };
                const { icon: Icon, className } = feedIcons[event.kind] ?? fallbackIcon;
                return (
                  <li
                    key={index}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2.5 hover:bg-muted"
                  >
                    <span className={cn("grid h-9 w-9 place-items-center rounded-md", className)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{event.title}</strong>
                      <span className="block truncate text-sm text-muted-foreground">
                        {event.detail}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {formatFeedTime(event.occurredAt)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum evento registrado ainda nesta unidade.
            </p>
          )}
        </ChartCard>
      </div>

      <aside className="order-first min-w-0 2xl:order-none">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card 2xl:sticky 2xl:top-[96px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-extrabold">Alertas prioritários</h2>
            <AlertPill
              label={String(alerts.length)}
              tone={alerts.length ? "critical" : "neutral"}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">O que precisa de ação agora</p>
          {alerts.length ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-md border-l-4 border-critical bg-muted p-3.5">
                  <strong className="block text-sm">{alertTypeLabel[alert.alertType]}</strong>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {alert.description}
                  </span>
                  <Button
                    variant="link"
                    className="mt-1 h-auto min-h-0 p-0 text-sm"
                    onClick={() => notify('Veja e trate este alerta na aba "Alertas".')}
                  >
                    Ver na aba Alertas
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Nenhum alerta para esta unidade.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function DefaultTab({
  tab,
  market,
  operation,
  notify,
}: {
  tab: MarketTab;
  market: Market;
  operation: Operation;
  notify: (message: string) => void;
}) {
  if (tab === "Validades") return <ExpiryTab market={market} />;
  if (tab === "Inconsistências") return <InconsistenciesTab market={market} notify={notify} />;
  if (tab === "Vendas") return <SalesTab market={market} operation={operation} />;
  if (tab === "Equipe") return <TeamTab market={market} notify={notify} />;
  if (tab === "Configurações") return <SettingsTab market={market} notify={notify} />;
  return (
    <ChartCard title={tab} subtitle={`Resumo de ${tab.toLowerCase()} em ${market.name}`}>
      <p className="mt-4 text-sm text-muted-foreground">Módulo demonstrativo desta unidade.</p>
    </ChartCard>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/60">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryTab({ market }: { market: Market }) {
  const lots = [
    { product: "Iogurte morango 170g", lot: "L2309", date: "26/09/2026", days: 4, qty: "36 un." },
    {
      product: "Queijo muçarela fatiado 150g",
      lot: "Q8812",
      date: "29/09/2026",
      days: 7,
      qty: "18 un.",
    },
    { product: "Pão de forma integral", lot: "P1190", date: "05/10/2026", days: 13, qty: "22 un." },
    { product: "Presunto cozido 200g", lot: "R5520", date: "20/10/2026", days: 28, qty: "14 un." },
  ];
  return (
    <ChartCard title="Validades" subtitle={`Lotes que vencem em breve em ${market.name}`}>
      <SimpleTable
        headers={["Produto", "Lote", "Validade", "Prazo", "Quantidade"]}
        rows={lots.map((lot) => [
          <strong key="p">{lot.product}</strong>,
          lot.lot,
          lot.date,
          <AlertPill
            key="d"
            label={`${lot.days} dias`}
            tone={lot.days <= 7 ? "critical" : lot.days <= 15 ? "warning" : "neutral"}
          />,
          lot.qty,
        ])}
      />
    </ChartCard>
  );
}

function InconsistenciesTab({
  market,
  notify,
}: {
  market: Market;
  notify: (message: string) => void;
}) {
  return (
    <ChartCard title="Inconsistências" subtitle={`Divergências registradas em ${market.name}`}>
      <SimpleTable
        headers={["Código", "Produto", "Origem", "Diferença", "Situação", "Horário", ""]}
        rows={inconsistencies.map((item) => [
          <strong key="c">{item.id}</strong>,
          item.product,
          item.type,
          item.difference,
          <AlertPill
            key="s"
            label={item.status}
            tone={
              item.status === "Resolvida"
                ? "positive"
                : item.status === "Em análise"
                  ? "warning"
                  : "critical"
            }
          />,
          item.time,
          <Button
            key="a"
            variant="outline"
            size="sm"
            onClick={() => notify(`${item.id} aberta para análise.`)}
          >
            Analisar
          </Button>,
        ])}
      />
    </ChartCard>
  );
}

function SalesTab({ market, operation }: { market: Market; operation: Operation }) {
  const payments = [
    ["Cartão de débito", 38],
    ["Cartão de crédito", 31],
    ["Pix", 24],
    ["Dinheiro", 7],
  ] as const;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ChartCard
        title="Vendas por horário"
        subtitle={`Faturamento de hoje · ${money(market.revenue)}`}
      >
        <ColumnChart data={operation.salesByHour} label="Vendas por horário" highlightLast />
      </ChartCard>
      <ChartCard title="Formas de pagamento" subtitle="Participação nas vendas de hoje">
        <div className="mt-6 space-y-4">
          {payments.map(([label, value]) => (
            <HorizontalBar key={label} label={label} value={value} max={100} detail={`${value}%`} />
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

function TeamTab({ market, notify }: { market: Market; notify: (message: string) => void }) {
  const members = teamMembers.map((member, index) =>
    index === 0 ? { ...member, name: market.manager } : member,
  );
  return (
    <ChartCard
      title="Equipe"
      subtitle={`Pessoas com acesso a ${market.name}`}
      action={
        <Button
          size="sm"
          onClick={() => notify("Convite para novo funcionário gerado (simulação).")}
        >
          <Users className="h-4 w-4" /> Convidar
        </Button>
      }
    >
      <SimpleTable
        headers={["Nome", "Função", "Turno", "Status"]}
        rows={members.map((member) => [
          <strong key="n">{member.name}</strong>,
          member.role,
          member.shift,
          <AlertPill
            key="s"
            label={member.status}
            tone={member.status === "Online" ? "positive" : "neutral"}
          />,
        ])}
      />
    </ChartCard>
  );
}

function SettingsTab({ market, notify }: { market: Market; notify: (message: string) => void }) {
  const [settings, setSettings] = useState({
    blindCount: true,
    recount: true,
    expiryAlert: true,
    negativeStock: false,
  });
  const options: Array<[keyof typeof settings, string, string]> = [
    [
      "blindCount",
      "Conferência cega no recebimento",
      "Conferentes não visualizam as quantidades da nota.",
    ],
    [
      "recount",
      "Até três tentativas de contagem",
      "Divergências persistentes geram ocorrência ao gerente.",
    ],
    ["expiryAlert", "Alertas de validade", "Avisar com 30, 60 e 90 dias de antecedência."],
    ["negativeStock", "Permitir estoque negativo", "Vendas continuam mesmo sem saldo registrado."],
  ];
  return (
    <ChartCard title="Configurações da unidade" subtitle={`Regras operacionais de ${market.name}`}>
      <div className="mt-5 divide-y divide-border rounded-md border border-border">
        {options.map(([key, title, description]) => (
          <label key={key} className="flex cursor-pointer items-start justify-between gap-4 p-4">
            <span>
              <strong className="block text-sm">{title}</strong>
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                setSettings((current) => ({ ...current, [key]: event.target.checked }))
              }
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 className="h-4 w-4" /> Alterações aplicadas somente nesta demonstração.
      </div>
      <Button className="mt-4" onClick={() => notify("Configurações salvas (simulação).")}>
        <ClipboardCheck className="h-4 w-4" /> Salvar configurações
      </Button>
    </ChartCard>
  );
}
