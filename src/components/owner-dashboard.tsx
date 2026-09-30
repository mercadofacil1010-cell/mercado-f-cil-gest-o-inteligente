import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
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
  Clock3,
  FileChartColumn,
  HelpCircle,
  LayoutDashboard,
  Lock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AddMarketFlow,
  type BillingPreview,
  type NewMarketData,
} from "@/components/add-market-flow";
import { calculateMarketAdditionCost, calculateSubscriptionAmount } from "@/lib/subscription-api";
import {
  AlertPill,
  ChartCard,
  HorizontalBar,
  Legend,
  Metric,
  type IconType,
} from "@/components/dashboard-ui";
import { MarketPanel } from "@/components/market-panel";
import { ProductsModule } from "@/components/products-module";
import { ProductCatalogModule } from "@/components/product-catalog-module";
import { LocationsCatalogModule } from "@/components/locations-catalog-module";
import { ReceivingsCatalogModule } from "@/components/receivings-catalog-module";
import { ReplenishmentOverview } from "@/components/replenishment-overview";
import { IncidentsModule } from "@/components/incidents-module";
import { AlertsModule } from "@/components/alerts-module";
import { SalesModule } from "@/components/sales-module";
import { OwnerSection } from "@/components/owner-sections";
import { initialProducts, type Product } from "@/data/products";
import { money, type Market } from "@/data/markets";
import { useAuth } from "@/lib/auth-context";
import {
  getUserCompanyId,
  listMarkets,
  createMarket,
  updateMarket,
  inactivateMarket,
} from "@/lib/markets-api";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, type MemberRole } from "@/lib/invites-api";
import { getCompanyDashboard, type CompanyDashboard } from "@/lib/dashboard-indicators-api";

const initials = (name: string) =>
  name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

/** Converte o mercado (formato de tela) de volta no formato do formulário, para editar. */
function marketToFormData(market: Market): NewMarketData {
  return {
    unitName: market.name,
    legalName: market.legalName ?? "",
    cnpj: market.cnpj ?? "",
    cnpjType: market.cnpjType ?? "Próprio",
    internalCode: market.code,
    phone: market.phone,
    email: market.email ?? "",
    openingHours: market.openingHours ?? "",
    initialStatus: market.status,
    zipCode: market.zipCode ?? "",
    street: market.street ?? "",
    number: market.number ?? "",
    complement: market.complement ?? "",
    district: market.district ?? "",
    city: market.city ?? "",
    state: market.state ?? "",
    reference: market.reference ?? "",
    checkouts: market.checkouts ?? "",
    warehouses: market.warehouses ?? "",
    employees: market.employees ?? "",
    area: market.area ?? "",
    posSystem: market.posSystem ?? "",
    barcodeReaders: market.barcodeReaders ?? "Sim",
    labelPrinter: market.labelPrinter ?? "Não",
    billingAccepted: true,
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

// Matriz de permissões por perfil (B1.6, DEC-B1-10): o Conferente e o Repositor
// ainda não têm suas telas de trabalho reais (App do Conferente/Repositor,
// B4/B5), então por enquanto só veem visão geral, mercados e ajuda.
const allSectionLabels = navigation.map((item) => item.label);
const managerSections = allSectionLabels.filter(
  (label) => label !== "Assinatura" && label !== "Configurações",
);
const basicSections = ["Visão geral", "Meus mercados", "Ajuda e suporte"];
const sectionsByRole: Record<MemberRole, string[]> = {
  owner: allSectionLabels,
  manager: managerSections,
  receiver: basicSections,
  stocker: basicSections,
};

function canAccessSection(role: MemberRole | null, section: string): boolean {
  if (!role) return basicSections.includes(section);
  return sectionsByRole[role].includes(section);
}

export function OwnerDashboard({
  onLogout,
  onOpenStocker,
}: {
  onLogout: () => void;
  onOpenStocker: () => void;
}) {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<MemberRole | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [addingMarket, setAddingMarket] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | undefined>(undefined);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("Visão geral");
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [period, setPeriod] = useState("today");
  const [query, setQuery] = useState("");
  const [detailMarket, setDetailMarket] = useState<Market | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [companyDashboard, setCompanyDashboard] = useState<CompanyDashboard | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Mercados reais (B1.4): busca a empresa do usuário logado e os mercados dela no Supabase.
  useEffect(() => {
    let active = true;
    if (!user) {
      setLoadingMarkets(false);
      return;
    }
    setLoadingMarkets(true);
    void getUserCompanyId(user.id).then(async (id) => {
      if (!active) return;
      setCompanyId(id);
      if (!id) {
        setMarkets([]);
        setLoadingMarkets(false);
        return;
      }
      const [list, { data: memberRow }, { data: profileRow }] = await Promise.all([
        listMarkets(id),
        supabase
          .from("company_members")
          .select("role")
          .eq("company_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setMarkets(list);
      setCallerRole(memberRow?.role ?? null);
      setCallerName(profileRow?.full_name ?? null);
      setLoadingMarkets(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  // Indicadores reais da rede (B8.1) — recarrega quando a empresa ou o período mudam.
  useEffect(() => {
    if (!companyId) {
      setCompanyDashboard(null);
      return;
    }
    let active = true;
    const days = period === "today" ? 1 : period === "7days" ? 7 : 30;
    void getCompanyDashboard(companyId, days).then((result) => {
      if (active) setCompanyDashboard(result);
    });
    return () => {
      active = false;
    };
  }, [companyId, period]);

  const visibleMarkets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return markets.filter((market) => {
      const selected = selectedMarket === "all" || market.id === selectedMarket;
      const searched =
        !normalized ||
        `${market.name} ${market.address} ${market.manager}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return selected && searched;
    });
  }, [markets, query, selectedMarket]);

  const totals = useMemo(() => {
    const source =
      selectedMarket === "all" ? markets : markets.filter((market) => market.id === selectedMarket);
    const rows =
      selectedMarket === "all"
        ? (companyDashboard?.markets ?? [])
        : (companyDashboard?.markets ?? []).filter((row) => row.marketId === selectedMarket);
    return source.reduce(
      (sum, market) => ({
        ...sum,
        open: sum.open + Number(market.status === "Aberto"),
        count: sum.count + 1,
      }),
      rows.reduce(
        (sum, row) => ({
          ...sum,
          revenue: sum.revenue + row.dashboard.revenue,
          sales: sum.sales + row.dashboard.salesCount,
          replenishments: sum.replenishments + row.dashboard.pendingReplenishments,
          stockAlerts: sum.stockAlerts + row.dashboard.lowStockPositions,
          expiryAlerts: sum.expiryAlerts + row.dashboard.nearExpiryLots,
          inconsistencies: sum.inconsistencies + row.dashboard.openIncidents,
          losses: sum.losses + row.dashboard.losses,
        }),
        emptyTotals(),
      ),
    );
  }, [markets, selectedMarket, companyDashboard]);

  const selectNav = (label: string) => {
    setActive(label);
    setDetailMarket(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const openMarket = (market: Market) => {
    setDetailMarket(market);
    setActive("Meus mercados");
  };

  const finishAddOrEdit = (name: string, verb: "adicionado" | "atualizado") => {
    setAddingMarket(false);
    setEditingMarket(null);
    setSelectedMarket("all");
    setQuery("");
    setDetailMarket(null);
    setActive("Visão geral");
    setToast(`${name} ${verb} com sucesso.`);
  };

  const loadBillingPreview = async (id: string) => {
    const [summary, proratedAmount] = await Promise.all([
      calculateSubscriptionAmount(id),
      calculateMarketAdditionCost(id),
    ]);
    setBillingPreview({
      planName: summary?.planName ?? "",
      priced: summary?.priced ?? false,
      additionalMonthly: summary?.pricePerMarket ?? null,
      proratedAmount,
      nextBillingDate: summary?.cycleEnd
        ? new Date(summary.cycleEnd).toLocaleDateString("pt-BR")
        : "",
      estimatedTotal:
        summary?.priced && summary.total != null && summary.pricePerMarket != null
          ? summary.total + summary.pricePerMarket
          : null,
    });
  };

  const completeAddMarket = async (data: NewMarketData) => {
    if (!companyId)
      return {
        ok: false as const,
        message: "Não foi possível identificar sua empresa. Recarregue a página e tente de novo.",
      };
    const result = await createMarket(companyId, data);
    if (!result.ok) return result;
    setMarkets((current) => [...current, result.market]);
    return { ok: true as const };
  };

  const completeEditMarket = async (data: NewMarketData) => {
    if (!editingMarket) return { ok: false as const, message: "Mercado não encontrado." };
    const result = await updateMarket(editingMarket.id, data);
    if (!result.ok) return result;
    setMarkets((current) =>
      current.map((market) => (market.id === result.market.id ? result.market : market)),
    );
    setDetailMarket((current) => (current?.id === result.market.id ? result.market : current));
    return { ok: true as const };
  };

  const requestInactivate = async (market: Market) => {
    if (!window.confirm(`Inativar "${market.name}"? Essa ação não pode ser desfeita por aqui.`))
      return;
    const result = await inactivateMarket(market.id);
    if (!result.ok) {
      setToast(result.message);
      return;
    }
    setMarkets((current) =>
      current.map((item) =>
        item.id === market.id ? { ...item, status: "Fechado", lifecycleStatus: "inactive" } : item,
      ),
    );
    setDetailMarket(null);
    setActive("Visão geral");
    setToast(`${market.name} foi inativado.`);
  };

  if (addingMarket) {
    return (
      <AddMarketFlow
        onCancel={() => setAddingMarket(false)}
        onComplete={completeAddMarket}
        onDone={() => finishAddOrEdit("Mercado", "adicionado")}
        contractedMarkets={markets.length}
        {...(billingPreview ? { billingPreview } : {})}
      />
    );
  }
  if (editingMarket) {
    return (
      <AddMarketFlow
        mode="edit"
        initialData={marketToFormData(editingMarket)}
        onCancel={() => setEditingMarket(null)}
        onComplete={completeEditMarket}
        onDone={() => finishAddOrEdit(editingMarket.name, "atualizado")}
      />
    );
  }

  if (loadingMarkets) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {mobileMenuOpen && (
        <Button
          variant="ghost"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 h-auto w-full rounded-none bg-scrim p-0 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden bg-brand-panel text-sidebar-foreground transition-[width,transform] duration-300 ${collapsed ? "lg:w-[76px]" : "lg:w-[270px]"} w-[270px] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div
          className={`flex h-[74px] shrink-0 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-3" : "justify-between px-5"}`}
        >
          <BrandLogo inverse className={collapsed ? "[&_span]:hidden" : ""} />
          <Button
            variant="nav"
            className="h-10 min-h-0 w-10 px-0 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5"
          aria-label="Navegação principal"
        >
          {navigation
            .filter((item) => canAccessSection(callerRole, item.label))
            .map(({ label, icon: Icon }) => (
              <Button
                key={label}
                variant="nav"
                data-active={active === label}
                onClick={() => selectNav(label)}
                title={collapsed ? label : undefined}
                className={`w-full px-3 ${collapsed ? "justify-center" : "justify-start"}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
              </Button>
            ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="nav"
            className={`w-full px-3 ${collapsed ? "justify-center" : "justify-start"}`}
            onClick={onLogout}
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={collapsed ? "sr-only" : ""}>Sair</span>
          </Button>
        </div>
      </aside>

      <div
        className={`transition-[padding] duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[270px]"}`}
      >
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex min-h-[74px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Button
              variant="ghost"
              className="h-10 min-h-0 w-10 shrink-0 px-0 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="hidden h-10 min-h-0 w-10 shrink-0 px-0 lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
            <div className="hidden w-[190px] shrink-0 md:block">
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger className="h-10 bg-card" aria-label="Selecionar mercado">
                  <Store className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os mercados</SelectItem>
                  {markets.map((market) => (
                    <SelectItem key={market.id} value={market.id}>
                      {market.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative hidden min-w-[150px] max-w-sm flex-1 xl:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar"
                placeholder="Buscar mercado, gerente ou endereço"
                className="h-10 w-full rounded-md bg-muted pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <div className="hidden w-[148px] lg:block">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-10 bg-card" aria-label="Período analisado">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 min-h-0 w-10 px-0"
                    aria-label="Central de notificações"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-critical" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))] p-2">
                  <DropdownMenuLabel>Central de notificações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Notification
                    title="Estoque crítico"
                    detail="4 produtos no Mercado Central"
                    tone="critical"
                  />
                  <Notification
                    title="Validade próxima"
                    detail="5 itens no Mercado Jardim"
                    tone="warning"
                  />
                  <Notification
                    title="Sincronização concluída"
                    detail="Mercado Avenida · há 12 min"
                    tone="info"
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 min-h-0 gap-2 px-1.5 sm:px-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-panel text-sm font-bold text-sidebar-foreground">
                      {initials(callerName ?? user?.email ?? "")}
                    </span>
                    <span className="hidden text-left sm:block">
                      <strong className="block text-sm">
                        {callerName ?? user?.email ?? "Minha conta"}
                      </strong>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {callerRole ? roleLabel[callerRole] : ""}
                      </span>
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccessSection(callerRole, "Equipe e acessos") && (
                    <DropdownMenuItem onSelect={() => selectNav("Equipe e acessos")}>
                      <Users /> Meu perfil e equipe
                    </DropdownMenuItem>
                  )}
                  {canAccessSection(callerRole, "Configurações") && (
                    <DropdownMenuItem onSelect={() => selectNav("Configurações")}>
                      <Settings /> Configurações
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-2 md:hidden">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="h-9 bg-card" aria-label="Selecionar mercado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os mercados</SelectItem>
                {markets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 bg-card" aria-label="Período analisado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {toast && (
          <div
            role="status"
            className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-card [&_button]:pointer-events-auto"
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm font-semibold">{toast}</span>
            <Button
              variant="ghost"
              className="h-8 min-h-0 w-8 px-0"
              onClick={() => setToast("")}
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {detailMarket ? (
          <MarketPanel
            key={detailMarket.id}
            market={detailMarket}
            markets={markets}
            onBack={() => {
              setDetailMarket(null);
              setActive("Visão geral");
            }}
            onSwitch={setDetailMarket}
            notify={setToast}
            onEdit={() => setEditingMarket(detailMarket)}
            onInactivate={() => void requestInactivate(detailMarket)}
            renderTab={(tab, market) =>
              tab === "Estoque" ? (
                <ProductsModule
                  key={market.id}
                  markets={markets}
                  products={products}
                  onChange={setProducts}
                  notify={setToast}
                  fixedMarketId={market.id}
                  title="Estoque e produtos"
                />
              ) : tab === "Gôndolas" || tab === "Depósito" ? (
                <LocationsCatalogModule
                  key={`${market.id}-${tab}`}
                  companyId={companyId}
                  marketId={market.id}
                  marketName={market.name}
                  notify={setToast}
                  initialView={tab}
                />
              ) : tab === "Recebimentos" ? (
                <ReceivingsCatalogModule
                  key={market.id}
                  companyId={companyId}
                  marketId={market.id}
                  marketName={market.name}
                  notify={setToast}
                />
              ) : tab === "Reposições" ? (
                <ReplenishmentOverview
                  companyId={companyId}
                  market={market}
                  onOpenStocker={onOpenStocker}
                  notify={setToast}
                />
              ) : tab === "Inconsistências" ? (
                <IncidentsModule
                  key={market.id}
                  companyId={companyId}
                  marketId={market.id}
                  notify={setToast}
                />
              ) : tab === "Alertas" ? (
                <AlertsModule key={market.id} marketId={market.id} notify={setToast} />
              ) : tab === "Vendas" ? (
                <SalesModule
                  key={market.id}
                  companyId={companyId}
                  marketId={market.id}
                  notify={setToast}
                />
              ) : null
            }
          />
        ) : !canAccessSection(callerRole, active) ? (
          <AccessDenied />
        ) : active === "Produtos" ? (
          <ProductCatalogModule companyId={companyId} notify={setToast} />
        ) : active === "Estoque consolidado" || active === "Validades" ? (
          <section className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
            <ProductsModule
              key={active}
              markets={markets}
              products={products}
              onChange={setProducts}
              notify={setToast}
              title={active}
              initialExpiryFilter={active === "Validades" ? "30" : "all"}
            />
          </section>
        ) : active !== "Visão geral" && active !== "Meus mercados" ? (
          <OwnerSection
            section={active}
            markets={markets}
            companyId={companyId}
            callerRole={callerRole}
            notify={setToast}
          />
        ) : (
          <DashboardOverview
            active={active}
            markets={markets}
            totals={totals}
            companyDashboard={companyDashboard}
            visibleMarkets={visibleMarkets}
            query={query}
            setQuery={setQuery}
            openMarket={openMarket}
            onAdd={() => {
              setToast("");
              setBillingPreview(undefined);
              setAddingMarket(true);
              if (companyId) void loadBillingPreview(companyId);
            }}
            period={period}
          />
        )}
      </div>
    </main>
  );
}

function DashboardOverview({
  active,
  markets,
  totals,
  visibleMarkets,
  query,
  setQuery,
  openMarket,
  onAdd,
  period,
  companyDashboard,
}: {
  active: string;
  markets: Market[];
  totals: ReturnType<typeof emptyTotals>;
  visibleMarkets: Market[];
  query: string;
  setQuery: (value: string) => void;
  openMarket: (market: Market) => void;
  onAdd: () => void;
  period: string;
  companyDashboard: CompanyDashboard | null;
}) {
  const periodLabel =
    period === "today"
      ? "Hoje, 22 de setembro"
      : period === "7days"
        ? "Últimos 7 dias"
        : "Últimos 30 dias";
  const metrics = [
    {
      title: "Faturamento do período",
      value: money(totals.revenue),
      note: "Vendas processadas do PDV (B7)",
      icon: CircleDollarSign,
      tone: "positive",
    },
    {
      title: "Vendas realizadas",
      value: totals.sales.toLocaleString("pt-BR"),
      note: "Eventos de venda processados",
      icon: ShoppingCart,
    },
    {
      title: "Ticket médio da rede",
      value: money(totals.sales ? totals.revenue / totals.sales : 0),
      note: "Faturamento / vendas realizadas",
      icon: ChartNoAxesColumnIncreasing,
    },
    {
      title: "Estoque baixo",
      value: String(totals.stockAlerts),
      note: "Posições de gôndola no mínimo ou menos",
      icon: PackageMinus,
      tone: "warning",
    },
    {
      title: "Próximos do vencimento",
      value: String(totals.expiryAlerts),
      note: "Lotes dentro da janela da empresa",
      icon: CalendarDays,
      tone: "warning",
    },
    {
      title: "Reposições pendentes",
      value: String(totals.replenishments),
      note: "Tarefas ainda não concluídas",
      icon: RefreshCw,
    },
    {
      title: "Inconsistências abertas",
      value: String(totals.inconsistencies),
      note: "Divergências a revisar",
      icon: AlertTriangle,
      tone: "critical",
    },
    {
      title: "Mercados em funcionamento",
      value: `${totals.open}/${totals.count}`,
      note: "Operando neste momento",
      icon: Building2,
      tone: "positive",
    },
  ];

  const marketRevenues = (companyDashboard?.markets ?? []).map((row) => ({
    name: row.marketName,
    revenue: row.dashboard.revenue,
  }));
  const maxRevenue = Math.max(1, ...marketRevenues.map((item) => item.revenue));
  return (
    <section className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">{periodLabel}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-normal sm:text-3xl">
            {active === "Meus mercados" ? "Meus mercados" : "Visão geral da rede"}
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            Acompanhe todos os seus mercados em uma única tela.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" /> Adicionar novo mercado
        </Button>
      </div>

      <div className="relative mt-5 xl:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar mercados"
          placeholder="Buscar mercado, gerente ou endereço"
          className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((metric) => (
          <Metric key={metric.title} {...metric} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
        <ChartCard
          title="Comparação entre mercados"
          subtitle="Faturamento do período por unidade (RF-DSH-02)"
        >
          {marketRevenues.length ? (
            <div className="mt-6 space-y-5">
              {marketRevenues.map((item, index) => (
                <HorizontalBar
                  key={item.name}
                  label={item.name.replace("Mercado ", "")}
                  value={item.revenue}
                  max={maxRevenue}
                  detail={money(item.revenue)}
                  muted={index >= 2}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Carregando indicadores…</p>
          )}
        </ChartCard>
        <ChartCard
          title="Perdas do período"
          subtitle="Impacto em unidades — sem custo cadastrado (PA-48)"
        >
          <div className="mt-6 flex items-center gap-4">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[10px] border-critical/60">
              <div className="text-center">
                <strong className="block text-lg">{totals.losses.toLocaleString("pt-BR")}</strong>
                <span className="text-xs text-muted-foreground">unidades</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Total de perdas registradas na rede no período selecionado. Sem preço de custo
              cadastrado, o valor financeiro não é calculado (só faturamento e vendas, PA-48).
            </p>
          </div>
        </ChartCard>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        Ranking de produtos mais vendidos e sem giro fica disponível na aba "Visão geral" de cada
        mercado, junto com o feed de operação e os alertas prioritários daquela unidade.
      </p>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">Seus mercados</h2>
          <p className="mt-1 text-sm text-muted-foreground">Detalhamento operacional por unidade</p>
        </div>
        <span className="text-sm font-semibold text-muted-foreground">
          {visibleMarkets.length} {visibleMarkets.length === 1 ? "unidade" : "unidades"}
        </span>
      </div>
      {visibleMarkets.length ? (
        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          {visibleMarkets.map((market) => (
            <MarketCard key={market.id} market={market} onOpen={() => openMarket(market)} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-bold">Nenhum mercado encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise a busca ou selecione todos os mercados.
          </p>
        </div>
      )}
    </section>
  );
}

function emptyTotals() {
  return {
    revenue: 0,
    sales: 0,
    replenishments: 0,
    stockAlerts: 0,
    expiryAlerts: 0,
    inconsistencies: 0,
    losses: 0,
    open: 0,
    count: 0,
  };
}

function RankCard({
  title,
  subtitle,
  icon: Icon,
  items,
  muted,
  footer,
}: {
  title: string;
  subtitle: string;
  icon: IconType;
  items: Array<{ name: string; value: string; width: number }>;
  muted?: boolean;
  footer: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div
            key={item.name}
            className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3"
          >
            <span
              className={`grid h-6 w-6 place-items-center rounded-sm text-xs font-extrabold ${muted ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold">{item.name}</span>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${muted ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${item.width}%` }}
                />
              </div>
            </div>
            <strong className="text-sm">{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {footer}
      </div>
    </ChartCard>
  );
}

function MarketCard({ market, onOpen }: { market: Market; onOpen: () => void }) {
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      aria-label={`Abrir ${market.name}`}
      className="group cursor-pointer rounded-lg border border-border bg-card p-5 shadow-card outline-none transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-action focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-panel text-sidebar-foreground">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-extrabold">{market.name}</h3>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${market.status === "Aberto" ? "text-success" : "text-muted-foreground"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${market.status === "Aberto" ? "bg-success" : "bg-muted-foreground"}`}
              />
              {market.status}
            </span>
            {market.lifecycleStatus === "awaiting_billing" && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
                Aguardando confirmação de cobrança
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <div className="mt-4 space-y-1.5 border-b border-border pb-4 text-sm text-muted-foreground">
        <p>{market.address}</p>
        <p>{market.phone}</p>
        <p>
          Gerente: <span className="font-semibold text-foreground">{market.manager}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-4">
        <MarketStat label="Faturamento" value={money(market.revenue)} />
        <MarketStat label="Vendas" value={market.sales.toLocaleString("pt-BR")} />
        <MarketStat label="Reposições" value={String(market.replenishments)} />
        <MarketStat
          label="Estoque"
          value={`${market.stockAlerts} alertas`}
          warning={market.stockAlerts > 2}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
        <AlertPill label={`${market.expiryAlerts} validades`} tone="warning" />
        <AlertPill
          label={`${market.inconsistencies} inconsistências`}
          tone={market.inconsistencies > 1 ? "critical" : "neutral"}
        />
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" /> Atualizado hoje às {market.updatedAt}
      </div>
    </article>
  );
}

function MarketStat({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
      <strong className={`mt-0.5 block text-sm ${warning ? "text-critical" : ""}`}>{value}</strong>
    </div>
  );
}

/** Tela de "sem acesso" (B1.6, DEC-B1-10): mostrada se o perfil logado não pode ver a seção atual. */
function AccessDenied() {
  return (
    <section className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
      <div className="grid place-items-center rounded-lg border border-dashed border-border bg-card p-14 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-extrabold">Acesso restrito</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Seu perfil não tem permissão para ver esta tela. Se precisar de acesso, fale com o dono ou
          gerente da empresa.
        </p>
      </div>
    </section>
  );
}

function Notification({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "critical" | "warning" | "info";
}) {
  const color =
    tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <DropdownMenuItem className="items-start p-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
    </DropdownMenuItem>
  );
}
