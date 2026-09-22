import { useMemo, useState, type ReactNode } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertPill, ChartCard, ColumnChart, HorizontalBar, Metric, type IconType } from "@/components/dashboard-ui";
import { money, type Market } from "@/data/markets";
import { getMarketOperation, inconsistencies, teamMembers, type OperationEvent } from "@/data/market-operations";
import { cn } from "@/lib/utils";

export const marketTabs = [
  "Visão geral",
  "Estoque",
  "Gôndolas",
  "Depósito",
  "Recebimentos",
  "Reposições",
  "Validades",
  "Inconsistências",
  "Vendas",
  "Equipe",
  "Configurações",
] as const;
export type MarketTab = (typeof marketTabs)[number];

const eventIcons: Record<OperationEvent["kind"], { icon: IconType; className: string }> = {
  sale: { icon: ShoppingCart, className: "bg-primary-soft text-primary" },
  "warehouse-in": { icon: Warehouse, className: "bg-muted text-foreground" },
  "warehouse-out": { icon: ArrowUpFromLine, className: "bg-muted text-foreground" },
  replenished: { icon: CheckCircle2, className: "bg-highlight-soft text-success" },
  received: { icon: ArrowDownToLine, className: "bg-primary-soft text-primary" },
  divergence: { icon: AlertTriangle, className: "bg-critical/10 text-critical" },
  expiry: { icon: CalendarClock, className: "bg-warning-soft text-warning" },
};

type MarketPanelProps = {
  market: Market;
  markets: Market[];
  onBack: () => void;
  onSwitch: (market: Market) => void;
  notify: (message: string) => void;
  /** Permite que módulos específicos substituam o conteúdo de uma aba. */
  renderTab?: ((tab: MarketTab, market: Market) => ReactNode) | undefined;
};

export function MarketPanel({ market, markets, onBack, onSwitch, notify, renderTab }: MarketPanelProps) {
  const [tab, setTab] = useState<MarketTab>("Visão geral");
  const operation = useMemo(() => getMarketOperation(market), [market]);
  const custom = tab === "Visão geral" ? null : renderTab?.(tab, market);

  return (
    <section className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-2" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Voltar para visão geral</Button>

      <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-panel text-sidebar-foreground"><Store className="h-7 w-7" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{market.name}</h1>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", market.status === "Aberto" ? "bg-highlight-soft text-success" : "bg-muted text-muted-foreground")}>
                  <span className={cn("h-2 w-2 rounded-full", market.status === "Aberto" ? "bg-success" : "bg-muted-foreground")} />{market.status === "Aberto" ? "Em funcionamento" : "Fechado"}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{market.code}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                <HeaderInfo icon={MapPin} label="Endereço" value={market.address} />
                <HeaderInfo icon={Phone} label="Telefone" value={market.phone} />
                <HeaderInfo icon={UserRound} label="Gerente" value={market.manager} />
                <HeaderInfo icon={RefreshCw} label="Última sincronização" value={`Hoje às ${market.updatedAt}`} />
              </dl>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row 2xl:shrink-0">
            <Select value={market.id} onValueChange={(id) => { const next = markets.find((item) => item.id === id); if (next) { onSwitch(next); setTab("Visão geral"); } }}>
              <SelectTrigger className="h-11 bg-card sm:w-[210px]" aria-label="Trocar de unidade"><Store className="mr-2 h-4 w-4 text-primary" /><SelectValue /></SelectTrigger>
              <SelectContent>{markets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => notify(`Edição de ${market.name} aberta em modo demonstrativo.`)}><Pencil className="h-4 w-4" /> Editar mercado</Button>
            <Button onClick={() => notify(`Convite de acesso a ${market.name} gerado (simulação).`)}><Share2 className="h-4 w-4" /> Compartilhar acesso</Button>
          </div>
        </div>
      </div>

      <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Seções do mercado">
        <div className="flex min-w-max gap-1 rounded-lg border border-border bg-card p-1">
          {marketTabs.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={cn("rounded-md px-3.5 py-2 text-sm font-semibold transition", tab === item ? "bg-brand-panel text-sidebar-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" role="tabpanel" aria-label={tab}>
        {tab === "Visão geral" && <Overview market={market} operation={operation} notify={notify} />}
        {tab !== "Visão geral" && (custom ?? <DefaultTab tab={tab} market={market} operation={operation} notify={notify} />)}
      </div>
    </section>
  );
}

function HeaderInfo({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0" /><dt className="sr-only">{label}</dt><dd className="min-w-0 break-words"><span className="hidden font-semibold sm:inline">{label}: </span>{value}</dd></div>;
}

type Operation = ReturnType<typeof getMarketOperation>;

function Overview({ market, operation, notify }: { market: Market; operation: Operation; notify: (message: string) => void }) {
  const metrics = [
    { title: "Faturamento do dia", value: money(market.revenue), note: "Vendas da unidade hoje", icon: CircleDollarSign, tone: "positive" },
    { title: "Vendas de hoje", value: market.sales.toLocaleString("pt-BR"), note: "Cupons emitidos", icon: ShoppingCart },
    { title: "Itens vendidos", value: operation.itemsSold.toLocaleString("pt-BR"), note: "Unidades registradas", icon: Package },
    { title: "Estoque crítico", value: String(operation.criticalStock), note: "Produtos abaixo do mínimo", icon: PackageMinus, tone: "critical" },
    { title: "Gôndolas abaixo do mínimo", value: String(operation.shelvesBelowMin), note: "Posições para repor", icon: LayoutGrid, tone: "warning" },
    { title: "Reposições em andamento", value: String(operation.replenishmentsInProgress), note: "Tarefas abertas", icon: RefreshCw },
    { title: "Recebimentos aguardando", value: String(operation.receivingsAwaiting), note: "Aguardando conferência", icon: Truck },
    { title: "Próximos do vencimento", value: String(operation.nearExpiry), note: "Lotes em até 7 dias", icon: CalendarClock, tone: "warning" },
    { title: "Perdas registradas", value: money(operation.losses), note: "Acumulado do mês", icon: PackageX, tone: "critical" },
    { title: "Inconsistências abertas", value: String(operation.openInconsistencies), note: "Divergências a revisar", icon: ShieldAlert, tone: "critical" },
  ];
  const maxLoss = Math.max(1, ...operation.lossesByCategory.map((item) => item.value));

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metrics.map((metric) => <Metric key={metric.title} {...metric} />)}</div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Vendas por horário" subtitle="Faturamento de hoje por hora">
            <ColumnChart data={operation.salesByHour} label="Gráfico de vendas por horário" highlightLast />
          </ChartCard>
          <ChartCard title="Movimentações de estoque" subtitle="Quantidade de movimentos hoje">
            <ColumnChart data={operation.stockMovements} label="Gráfico de movimentações de estoque" />
          </ChartCard>
          <ChartCard title="Ruptura de gôndola" subtitle="Posições sem produto nos últimos 7 dias">
            <ColumnChart data={operation.shelfRupture.map((item) => ({ ...item, tone: item.value > 6 ? "critical" as const : item.value > 4 ? "warning" as const : "neutral" as const }))} label="Gráfico de ruptura de gôndola" height="h-48" />
          </ChartCard>
          <ChartCard title="Perdas por categoria" subtitle="Valor perdido no mês">
            <div className="mt-6 space-y-4">{operation.lossesByCategory.map((item, index) => <HorizontalBar key={item.label} label={item.label} value={item.value} max={maxLoss} detail={money(item.value)} tone={index === 0 ? "critical" : index === 1 ? "warning" : undefined} muted={index > 1} />)}</div>
          </ChartCard>
        </div>

        <ChartCard title="Operação em tempo real" subtitle="Últimos eventos registrados na unidade" action={<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-highlight-soft px-2.5 py-1 text-xs font-bold text-success"><span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Ao vivo</span>}>
          <ol className="mt-5 space-y-1">
            {operation.events.map((event) => {
              const { icon: Icon, className } = eventIcons[event.kind];
              return (
                <li key={event.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2.5 hover:bg-muted">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-md", className)}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><strong className="block truncate text-sm">{event.title}</strong><span className="block truncate text-sm text-muted-foreground">{event.detail}</span></div>
                  <span className="text-xs font-semibold text-muted-foreground">{event.time}</span>
                </li>
              );
            })}
          </ol>
        </ChartCard>
      </div>

      <aside className="order-first min-w-0 2xl:order-none">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card 2xl:sticky 2xl:top-[96px]">
          <div className="flex items-center justify-between gap-3"><h2 className="font-extrabold">Alertas prioritários</h2><AlertPill label={String(operation.alerts.length)} tone={operation.alerts.length ? "critical" : "neutral"} /></div>
          <p className="mt-1 text-sm text-muted-foreground">O que precisa de ação agora</p>
          {operation.alerts.length ? (
            <ul className="mt-4 space-y-3">
              {operation.alerts.map((alert) => (
                <li key={alert.id} className={cn("rounded-md border-l-4 bg-muted p-3.5", alert.tone === "critical" ? "border-critical" : "border-warning")}>
                  <strong className="block text-sm">{alert.title}</strong>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{alert.detail}</span>
                  <Button variant="link" className="mt-1 h-auto min-h-0 p-0 text-sm" onClick={() => notify(`Alerta "${alert.title}" marcado para tratamento.`)}>Tratar alerta</Button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">Nenhum alerta para esta unidade.</p>}
        </div>
      </aside>
    </div>
  );
}

function DefaultTab({ tab, market, operation, notify }: { tab: MarketTab; market: Market; operation: Operation; notify: (message: string) => void }) {
  if (tab === "Validades") return <ExpiryTab market={market} />;
  if (tab === "Inconsistências") return <InconsistenciesTab market={market} notify={notify} />;
  if (tab === "Vendas") return <SalesTab market={market} operation={operation} />;
  if (tab === "Equipe") return <TeamTab market={market} notify={notify} />;
  if (tab === "Configurações") return <SettingsTab market={market} notify={notify} />;
  return <ChartCard title={tab} subtitle={`Resumo de ${tab.toLowerCase()} em ${market.name}`}><p className="mt-4 text-sm text-muted-foreground">Módulo demonstrativo desta unidade.</p></ChartCard>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">{headers.map((header) => <th key={header} className="px-3 py-2.5 font-bold">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/60">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ExpiryTab({ market }: { market: Market }) {
  const lots = [
    { product: "Iogurte morango 170g", lot: "L2309", date: "26/09/2026", days: 4, qty: "36 un." },
    { product: "Queijo muçarela fatiado 150g", lot: "Q8812", date: "29/09/2026", days: 7, qty: "18 un." },
    { product: "Pão de forma integral", lot: "P1190", date: "05/10/2026", days: 13, qty: "22 un." },
    { product: "Presunto cozido 200g", lot: "R5520", date: "20/10/2026", days: 28, qty: "14 un." },
  ];
  return (
    <ChartCard title="Validades" subtitle={`Lotes que vencem em breve em ${market.name}`}>
      <SimpleTable headers={["Produto", "Lote", "Validade", "Prazo", "Quantidade"]} rows={lots.map((lot) => [<strong key="p">{lot.product}</strong>, lot.lot, lot.date, <AlertPill key="d" label={`${lot.days} dias`} tone={lot.days <= 7 ? "critical" : lot.days <= 15 ? "warning" : "neutral"} />, lot.qty])} />
    </ChartCard>
  );
}

function InconsistenciesTab({ market, notify }: { market: Market; notify: (message: string) => void }) {
  return (
    <ChartCard title="Inconsistências" subtitle={`Divergências registradas em ${market.name}`}>
      <SimpleTable headers={["Código", "Produto", "Origem", "Diferença", "Situação", "Horário", ""]} rows={inconsistencies.map((item) => [<strong key="c">{item.id}</strong>, item.product, item.type, item.difference, <AlertPill key="s" label={item.status} tone={item.status === "Resolvida" ? "positive" : item.status === "Em análise" ? "warning" : "critical"} />, item.time, <Button key="a" variant="outline" size="sm" onClick={() => notify(`${item.id} aberta para análise.`)}>Analisar</Button>])} />
    </ChartCard>
  );
}

function SalesTab({ market, operation }: { market: Market; operation: Operation }) {
  const payments = [["Cartão de débito", 38], ["Cartão de crédito", 31], ["Pix", 24], ["Dinheiro", 7]] as const;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ChartCard title="Vendas por horário" subtitle={`Faturamento de hoje · ${money(market.revenue)}`}><ColumnChart data={operation.salesByHour} label="Vendas por horário" highlightLast /></ChartCard>
      <ChartCard title="Formas de pagamento" subtitle="Participação nas vendas de hoje"><div className="mt-6 space-y-4">{payments.map(([label, value]) => <HorizontalBar key={label} label={label} value={value} max={100} detail={`${value}%`} />)}</div></ChartCard>
    </div>
  );
}

function TeamTab({ market, notify }: { market: Market; notify: (message: string) => void }) {
  const members = teamMembers.map((member, index) => (index === 0 ? { ...member, name: market.manager } : member));
  return (
    <ChartCard title="Equipe" subtitle={`Pessoas com acesso a ${market.name}`} action={<Button size="sm" onClick={() => notify("Convite para novo funcionário gerado (simulação).")}><Users className="h-4 w-4" /> Convidar</Button>}>
      <SimpleTable headers={["Nome", "Função", "Turno", "Status"]} rows={members.map((member) => [<strong key="n">{member.name}</strong>, member.role, member.shift, <AlertPill key="s" label={member.status} tone={member.status === "Online" ? "positive" : "neutral"} />])} />
    </ChartCard>
  );
}

function SettingsTab({ market, notify }: { market: Market; notify: (message: string) => void }) {
  const [settings, setSettings] = useState({ blindCount: true, recount: true, expiryAlert: true, negativeStock: false });
  const options: Array<[keyof typeof settings, string, string]> = [
    ["blindCount", "Conferência cega no recebimento", "Conferentes não visualizam as quantidades da nota."],
    ["recount", "Até três tentativas de contagem", "Divergências persistentes geram ocorrência ao gerente."],
    ["expiryAlert", "Alertas de validade", "Avisar com 30, 60 e 90 dias de antecedência."],
    ["negativeStock", "Permitir estoque negativo", "Vendas continuam mesmo sem saldo registrado."],
  ];
  return (
    <ChartCard title="Configurações da unidade" subtitle={`Regras operacionais de ${market.name}`}>
      <div className="mt-5 divide-y divide-border rounded-md border border-border">
        {options.map(([key, title, description]) => (
          <label key={key} className="flex cursor-pointer items-start justify-between gap-4 p-4">
            <span><strong className="block text-sm">{title}</strong><span className="mt-0.5 block text-sm text-muted-foreground">{description}</span></span>
            <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> Alterações aplicadas somente nesta demonstração.</div>
      <Button className="mt-4" onClick={() => notify("Configurações salvas (simulação).")}><ClipboardCheck className="h-4 w-4" /> Salvar configurações</Button>
    </ChartCard>
  );
}
