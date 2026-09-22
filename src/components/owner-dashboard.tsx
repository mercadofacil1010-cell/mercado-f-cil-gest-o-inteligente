import { useMemo, useState, type ComponentType, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileChartColumn,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageMinus,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddMarketFlow, type NewMarketData } from "@/components/add-market-flow";
import { initialMarkets, money, type Market } from "@/data/markets";

type IconType = ComponentType<{ className?: string }>;

function marketFromForm(data: NewMarketData, existing: Market[]): Market {
  const base = data.unitName.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mercado";
  let id = base;
  for (let suffix = 2; existing.some((market) => market.id === id); suffix += 1) id = `${base}-${suffix}`;
  const now = new Date();
  return {
    id,
    code: data.internalCode.trim(),
    name: data.unitName.trim(),
    status: data.initialStatus,
    address: `${data.street.trim()}, ${data.number.trim()} · ${data.district.trim()}`,
    phone: data.phone,
    manager: data.managerName.trim(),
    revenue: 0,
    sales: 0,
    replenishments: 0,
    stockAlerts: 0,
    expiryAlerts: 0,
    inconsistencies: 0,
    updatedAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };
}

const navigation: Array<{ label: string; icon: IconType }> = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Meus mercados", icon: Store },
  { label: "Produtos", icon: Package },
  { label: "Estoque consolidado", icon: Boxes },
  { label: "Compras", icon: ShoppingCart },
  { label: "Fornecedores", icon: Truck },
  { label: "Validades", icon: CalendarDays },
  { label: "Inconsistências", icon: ShieldAlert },
  { label: "Relatórios", icon: FileChartColumn },
  { label: "Equipe e acessos", icon: UserRoundCog },
  { label: "Assinatura", icon: CircleDollarSign },
  { label: "Configurações", icon: Settings },
  { label: "Ajuda e suporte", icon: HelpCircle },
];

export function OwnerDashboard({ onLogout }: { onLogout: () => void }) {
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [addingMarket, setAddingMarket] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("Visão geral");
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [period, setPeriod] = useState("today");
  const [query, setQuery] = useState("");
  const [detailMarket, setDetailMarket] = useState<Market | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const visibleMarkets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return markets.filter((market) => {
      const selected = selectedMarket === "all" || market.id === selectedMarket;
      const searched = !normalized || `${market.name} ${market.address} ${market.manager}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return selected && searched;
    });
  }, [markets, query, selectedMarket]);

  const totals = useMemo(() => {
    const source = selectedMarket === "all" ? markets : markets.filter((market) => market.id === selectedMarket);
    return source.reduce((sum, market) => ({
      revenue: sum.revenue + market.revenue,
      sales: sum.sales + market.sales,
      replenishments: sum.replenishments + market.replenishments,
      stockAlerts: sum.stockAlerts + market.stockAlerts,
      expiryAlerts: sum.expiryAlerts + market.expiryAlerts,
      inconsistencies: sum.inconsistencies + market.inconsistencies,
      open: sum.open + Number(market.status === "Aberto"),
      count: sum.count + 1,
    }), emptyTotals());
  }, [markets, selectedMarket]);

  const selectNav = (label: string) => {
    setActive(label);
    setDetailMarket(null);
    setMobileMenuOpen(false);
    if (label !== "Visão geral" && label !== "Meus mercados") setToast(`${label}: área demonstrativa selecionada.`);
  };

  const openMarket = (market: Market) => {
    setDetailMarket(market);
    setActive("Meus mercados");
  };

  const completeAddMarket = (data: NewMarketData) => {
    const market = marketFromForm(data, markets);
    setMarkets((current) => [...current, market]);
    setAddingMarket(false);
    setSelectedMarket("all");
    setQuery("");
    setDetailMarket(null);
    setActive("Visão geral");
    setToast(`${market.name} adicionado à sua rede.`);
  };

  if (addingMarket) return <AddMarketFlow onCancel={() => setAddingMarket(false)} onComplete={completeAddMarket} contractedMarkets={markets.length} />;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {mobileMenuOpen && <Button variant="ghost" aria-label="Fechar menu" className="fixed inset-0 z-30 h-auto w-full rounded-none bg-scrim p-0 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden bg-brand-panel text-sidebar-foreground transition-[width,transform] duration-300 ${collapsed ? "lg:w-[76px]" : "lg:w-[270px]"} w-[270px] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-[74px] shrink-0 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-3" : "justify-between px-5"}`}>
          <BrandLogo inverse className={collapsed ? "[&_span]:hidden" : ""} />
          <Button variant="nav" className="h-10 min-h-0 w-10 px-0 lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          {navigation.map(({ label, icon: Icon }) => (
            <Button key={label} variant="nav" data-active={active === label} onClick={() => selectNav(label)} title={collapsed ? label : undefined} className={`w-full px-3 ${collapsed ? "justify-center" : "justify-start"}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="nav" className={`w-full px-3 ${collapsed ? "justify-center" : "justify-start"}`} onClick={onLogout} title="Sair">
            <LogOut className="h-[18px] w-[18px] shrink-0" /><span className={collapsed ? "sr-only" : ""}>Sair</span>
          </Button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[270px]"}`}>
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex min-h-[74px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Button variant="ghost" className="h-10 min-h-0 w-10 shrink-0 px-0 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
            <Button variant="ghost" className="hidden h-10 min-h-0 w-10 shrink-0 px-0 lg:inline-flex" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}</Button>
            <div className="hidden w-[190px] shrink-0 md:block">
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger className="h-10 bg-card" aria-label="Selecionar mercado"><Store className="mr-2 h-4 w-4 text-primary" /><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os mercados</SelectItem>{markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="relative hidden min-w-[150px] max-w-sm flex-1 xl:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar" placeholder="Buscar mercado, gerente ou endereço" className="h-10 w-full rounded-md bg-muted pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <div className="hidden w-[148px] lg:block">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-10 bg-card" aria-label="Período analisado"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="today">Hoje</SelectItem><SelectItem value="7days">Últimos 7 dias</SelectItem><SelectItem value="30days">Últimos 30 dias</SelectItem></SelectContent>
                </Select>
              </div>
              <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild><Button variant="ghost" className="relative h-10 min-h-0 w-10 px-0" aria-label="Central de notificações"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-critical" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))] p-2">
                  <DropdownMenuLabel>Central de notificações</DropdownMenuLabel><DropdownMenuSeparator />
                  <Notification title="Estoque crítico" detail="4 produtos no Mercado Central" tone="critical" />
                  <Notification title="Validade próxima" detail="5 itens no Mercado Jardim" tone="warning" />
                  <Notification title="Sincronização concluída" detail="Mercado Avenida · há 12 min" tone="info" />
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-11 min-h-0 gap-2 px-1.5 sm:px-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-panel text-sm font-bold text-sidebar-foreground">MA</span><span className="hidden text-left sm:block"><strong className="block text-sm">Marina Alves</strong><span className="block text-xs font-normal text-muted-foreground">Proprietária</span></span><ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Minha conta</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setToast("Perfil selecionado.")}><Users /> Meu perfil</DropdownMenuItem><DropdownMenuItem onSelect={() => setToast("Configurações selecionadas.")}><Settings /> Configurações</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onLogout}><LogOut /> Sair</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-2 md:hidden">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}><SelectTrigger className="h-9 bg-card" aria-label="Selecionar mercado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os mercados</SelectItem>{markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}</SelectContent></Select>
            <Select value={period} onValueChange={setPeriod}><SelectTrigger className="h-9 bg-card" aria-label="Período analisado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Hoje</SelectItem><SelectItem value="7days">Últimos 7 dias</SelectItem><SelectItem value="30days">Últimos 30 dias</SelectItem></SelectContent></Select>
          </div>
        </header>

        {toast && <div role="status" className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-card"><CheckCircle2 className="h-5 w-5 text-success" /><span className="text-sm font-semibold">{toast}</span><Button variant="ghost" className="h-8 min-h-0 w-8 px-0" onClick={() => setToast("")} aria-label="Fechar aviso"><X className="h-4 w-4" /></Button></div>}

        {detailMarket ? <MarketDetail market={detailMarket} onBack={() => { setDetailMarket(null); setActive("Visão geral"); }} /> : (
          <DashboardOverview active={active} markets={markets} totals={totals} visibleMarkets={visibleMarkets} query={query} setQuery={setQuery} openMarket={openMarket} onAdd={() => { setToast(""); setAddingMarket(true); }} period={period} />
        )}
      </div>
    </main>
  );
}

function DashboardOverview({ active, markets, totals, visibleMarkets, query, setQuery, openMarket, onAdd, period }: { active: string; markets: Market[]; totals: ReturnType<typeof emptyTotals>; visibleMarkets: Market[]; query: string; setQuery: (value: string) => void; openMarket: (market: Market) => void; onAdd: () => void; period: string }) {
  const periodLabel = period === "today" ? "Hoje, 22 de setembro" : period === "7days" ? "Últimos 7 dias" : "Últimos 30 dias";
  const metrics = [
    { title: "Faturamento de hoje", value: money(totals.revenue), note: "+8,4% em relação a ontem", icon: CircleDollarSign, tone: "positive" },
    { title: "Vendas realizadas", value: totals.sales.toLocaleString("pt-BR"), note: "Pedidos concluídos", icon: ShoppingCart },
    { title: "Valor médio por venda", value: money(totals.sales ? totals.revenue / totals.sales : 0), note: "Ticket médio da rede", icon: ChartNoAxesColumnIncreasing },
    { title: "Estoque baixo", value: String(totals.stockAlerts), note: "Produtos exigem atenção", icon: PackageMinus, tone: "warning" },
    { title: "Próximos do vencimento", value: String(totals.expiryAlerts), note: "Itens em até 7 dias", icon: CalendarDays, tone: "warning" },
    { title: "Reposições pendentes", value: String(totals.replenishments), note: "Tarefas abertas", icon: RefreshCw },
    { title: "Inconsistências abertas", value: String(totals.inconsistencies), note: "Divergências a revisar", icon: AlertTriangle, tone: "critical" },
    { title: "Mercados em funcionamento", value: `${totals.open}/${totals.count}`, note: "Operando neste momento", icon: Building2, tone: "positive" },
    { title: "Produtos monitorados", value: "18.642", note: "Cadastro consolidado", icon: Tags },
  ];

  const maxRevenue = Math.max(1, ...markets.map((market) => market.revenue));
  return <section className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold text-primary">{periodLabel}</p><h1 className="mt-1 text-2xl font-extrabold tracking-normal sm:text-3xl">{active === "Meus mercados" ? "Meus mercados" : "Visão geral da rede"}</h1><p className="mt-1 text-base text-muted-foreground">Acompanhe todos os seus mercados em uma única tela.</p></div>
      <Button onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar novo mercado</Button>
    </div>

    <div className="relative mt-5 xl:hidden"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar mercados" placeholder="Buscar mercado, gerente ou endereço" className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">{metrics.map((metric) => <Metric key={metric.title} {...metric} />)}</div>

    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
      <ChartCard title="Vendas nos últimos sete dias" subtitle="Receita consolidada da rede" badge="+11,2%">
        <div className="mt-7 flex h-56 items-end gap-2 sm:gap-4" aria-label="Gráfico de vendas nos últimos sete dias">{[54, 68, 62, 79, 72, 91, 84].map((height, index) => <div key={index} className="grid h-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2"><div className="flex items-end"><div className="w-full rounded-t-sm bg-chart-bar transition hover:bg-primary" style={{ height: `${height}%` }} /></div><span className="text-center text-xs font-semibold text-muted-foreground">{["Qua", "Qui", "Sex", "Sáb", "Dom", "Seg", "Hoje"][index]}</span></div>)}</div>
      </ChartCard>
      <ChartCard title="Comparação entre mercados" subtitle="Participação no faturamento">
        <div className="mt-6 space-y-5">{markets.map((market, index) => <HorizontalBar key={market.id} label={market.name.replace("Mercado ", "")} value={market.revenue} max={maxRevenue} detail={money(market.revenue)} muted={index >= 2} />)}</div>
        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Atualização automática a cada 5 minutos</div>
      </ChartCard>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <RankCard title="Produtos mais vendidos" subtitle="Unidades hoje" icon={BarChart3} footer={`Dados consolidados de ${markets.length} mercados`} items={[{ name: "Leite integral 1L", value: "486 un.", width: 100 }, { name: "Arroz tipo 1 5kg", value: "352 un.", width: 72 }, { name: "Café tradicional 500g", value: "297 un.", width: 61 }]} />
      <RankCard title="Produtos com menor giro" subtitle="Últimos 30 dias" icon={PackageMinus} footer={`Dados consolidados de ${markets.length} mercados`} items={[{ name: "Azeitona premium 200g", value: "3 un.", width: 18 }, { name: "Molho especial 350ml", value: "5 un.", width: 28 }, { name: "Chá importado 20un", value: "7 un.", width: 38 }]} muted />
      <ChartCard title="Perdas e divergências" subtitle="Impacto financeiro neste mês">
        <div className="mt-6 flex items-center gap-5"><div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-[14px] border-warning border-r-critical border-t-primary"><div className="text-center"><strong className="block text-lg">R$ 4,8 mil</strong><span className="text-xs text-muted-foreground">total</span></div></div><div className="space-y-3 text-sm"><Legend color="bg-warning" label="Validade" value="46%" /><Legend color="bg-critical" label="Divergências" value="31%" /><Legend color="bg-primary" label="Avarias" value="23%" /></div></div>
      </ChartCard>
    </div>

    <div className="mt-8 flex items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold">Seus mercados</h2><p className="mt-1 text-sm text-muted-foreground">Detalhamento operacional por unidade</p></div><span className="text-sm font-semibold text-muted-foreground">{visibleMarkets.length} {visibleMarkets.length === 1 ? "unidade" : "unidades"}</span></div>
    {visibleMarkets.length ? <div className="mt-4 grid gap-5 xl:grid-cols-3">{visibleMarkets.map((market) => <MarketCard key={market.id} market={market} onOpen={() => openMarket(market)} />)}</div> : <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-10 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-bold">Nenhum mercado encontrado</h3><p className="mt-1 text-sm text-muted-foreground">Revise a busca ou selecione todos os mercados.</p></div>}
  </section>;
}

function emptyTotals() { return { revenue: 0, sales: 0, replenishments: 0, stockAlerts: 0, expiryAlerts: 0, inconsistencies: 0, open: 0, count: 0 }; }

function Metric({ title, value, note, icon: Icon, tone }: { title: string; value: string; note: string; icon: IconType; tone?: string }) {
  const color = tone === "critical" ? "bg-critical/10 text-critical" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary";
  return <article className="rounded-lg border border-border bg-card p-4 shadow-card"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-muted-foreground">{title}</p><strong className="mt-2 block text-2xl font-extrabold">{value}</strong></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${color}`}><Icon className="h-5 w-5" /></span></div><p className={`mt-3 text-sm font-medium ${tone === "positive" ? "text-success" : tone === "critical" ? "text-critical" : "text-muted-foreground"}`}>{note}</p></article>;
}

function ChartCard({ title, subtitle, badge, children }: { title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{badge && <span className="rounded-md bg-highlight-soft px-2.5 py-1 text-sm font-bold text-highlight-foreground">{badge}</span>}</div>{children}</section>;
}

function HorizontalBar({ label, value, max, detail, muted }: { label: string; value: number; max: number; detail: string; muted?: boolean }) {
  return <div><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{label}</span><strong>{detail}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${muted ? "bg-chart-bar" : "bg-primary"}`} style={{ width: `${Math.round(value / max * 100)}%` }} /></div></div>;
}

function RankCard({ title, subtitle, icon: Icon, items, muted, footer }: { title: string; subtitle: string; icon: IconType; items: Array<{ name: string; value: string; width: number }>; muted?: boolean; footer: string }) {
  return <ChartCard title={title} subtitle={subtitle}><div className="mt-5 space-y-4">{items.map((item, index) => <div key={item.name} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3"><span className={`grid h-6 w-6 place-items-center rounded-sm text-xs font-extrabold ${muted ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"}`}>{index + 1}</span><div className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name}</span><div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${muted ? "bg-warning" : "bg-primary"}`} style={{ width: `${item.width}%` }} /></div></div><strong className="text-sm">{item.value}</strong></div>)}</div><div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {footer}</div></ChartCard>;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) { return <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>; }

function MarketCard({ market, onOpen }: { market: Market; onOpen: () => void }) {
  const handleKey = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } };
  return <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKey} aria-label={`Abrir ${market.name}`} className="group cursor-pointer rounded-lg border border-border bg-card p-5 shadow-card outline-none transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-action focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-panel text-sidebar-foreground"><Store className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate font-extrabold">{market.name}</h3><span className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${market.status === "Aberto" ? "text-success" : "text-muted-foreground"}`}><span className={`h-2 w-2 rounded-full ${market.status === "Aberto" ? "bg-success" : "bg-muted-foreground"}`} />{market.status}</span></div></div><ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div>
    <div className="mt-4 space-y-1.5 border-b border-border pb-4 text-sm text-muted-foreground"><p>{market.address}</p><p>{market.phone}</p><p>Gerente: <span className="font-semibold text-foreground">{market.manager}</span></p></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-4"><MarketStat label="Faturamento" value={money(market.revenue)} /><MarketStat label="Vendas" value={market.sales.toLocaleString("pt-BR")} /><MarketStat label="Reposições" value={String(market.replenishments)} /><MarketStat label="Estoque" value={`${market.stockAlerts} alertas`} warning={market.stockAlerts > 2} /></div>
    <div className="grid grid-cols-2 gap-2 border-t border-border pt-4"><AlertPill label={`${market.expiryAlerts} validades`} tone="warning" /><AlertPill label={`${market.inconsistencies} inconsistências`} tone={market.inconsistencies > 1 ? "critical" : "neutral"} /></div>
    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Atualizado hoje às {market.updatedAt}</div>
  </article>;
}

function MarketStat({ label, value, warning }: { label: string; value: string; warning?: boolean }) { return <div><span className="block text-xs font-semibold text-muted-foreground">{label}</span><strong className={`mt-0.5 block text-sm ${warning ? "text-critical" : ""}`}>{value}</strong></div>; }
function AlertPill({ label, tone }: { label: string; tone: "warning" | "critical" | "neutral" }) { const color = tone === "warning" ? "bg-warning-soft text-warning" : tone === "critical" ? "bg-critical/10 text-critical" : "bg-muted text-muted-foreground"; return <span className={`rounded-md px-2 py-1.5 text-center text-xs font-bold ${color}`}>{label}</span>; }

function MarketDetail({ market, onBack }: { market: Market; onBack: () => void }) {
  return <section className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><Button variant="ghost" className="px-2" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Voltar para visão geral</Button><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-lg bg-brand-panel text-sidebar-foreground"><Store className="h-7 w-7" /></span><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold sm:text-3xl">{market.name}</h1><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${market.status === "Aberto" ? "bg-primary-soft text-success" : "bg-muted text-muted-foreground"}`}>{market.status}</span></div><p className="mt-1 text-muted-foreground">{market.address}</p></div></div><Button onClick={() => undefined}><Settings className="h-4 w-4" /> Gerenciar mercado</Button></div>
    <div className="mt-7 rounded-lg border border-primary/25 bg-primary-soft p-5"><div className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-bold">Página provisória da unidade</h2><p className="mt-1 text-sm text-muted-foreground">Os módulos operacionais específicos deste mercado serão adicionados nas próximas etapas.</p></div></div></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric title="Faturamento de hoje" value={money(market.revenue)} note="Operação da unidade" icon={CircleDollarSign} tone="positive" /><Metric title="Vendas realizadas" value={market.sales.toLocaleString("pt-BR")} note="Pedidos concluídos" icon={ShoppingCart} /><Metric title="Reposições pendentes" value={String(market.replenishments)} note="Tarefas abertas" icon={RefreshCw} /><Metric title="Alertas ativos" value={String(market.stockAlerts + market.expiryAlerts + market.inconsistencies)} note="Requerem acompanhamento" icon={AlertTriangle} tone="warning" /></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><ChartCard title="Dados da unidade" subtitle="Informações cadastrais"><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Detail label="Gerente" value={market.manager} /><Detail label="Telefone" value={market.phone} /><Detail label="Última atualização" value={`Hoje às ${market.updatedAt}`} /><Detail label="Status operacional" value={market.status} /></dl></ChartCard><ChartCard title="Resumo de alertas" subtitle="Pendências desta unidade"><div className="mt-5 space-y-3"><AlertLine label="Alertas de estoque" value={market.stockAlerts} tone="critical" /><AlertLine label="Produtos próximos da validade" value={market.expiryAlerts} tone="warning" /><AlertLine label="Inconsistências abertas" value={market.inconsistencies} tone="neutral" /></div></ChartCard></div>
  </section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-sm font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>; }
function AlertLine({ label, value, tone }: { label: string; value: number; tone: "critical" | "warning" | "neutral" }) { return <div className="flex items-center justify-between rounded-md bg-muted p-3.5"><span className="text-sm font-semibold">{label}</span><AlertPill label={String(value)} tone={tone} /></div>; }
function Notification({ title, detail, tone }: { title: string; detail: string; tone: "critical" | "warning" | "info" }) { const color = tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning" : "bg-primary"; return <DropdownMenuItem className="items-start p-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} /><span><strong className="block text-sm">{title}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span></DropdownMenuItem>; }
