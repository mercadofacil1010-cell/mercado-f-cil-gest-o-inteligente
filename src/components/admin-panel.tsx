import { useEffect, useState, type ReactNode } from "react";
import {
  BadgePercent,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileClock,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MoreVertical,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertPill,
  ChartCard,
  EmptyState,
  HorizontalBar,
  Metric,
  Modal,
  type IconType,
  type Tone,
} from "@/components/dashboard-ui";
import {
  allFeatures,
  auditLog,
  initialClients,
  initialPlans,
  integrations,
  payments,
  platformUsers,
  tickets,
  type Client,
  type Plan,
  type SubscriptionStatus,
} from "@/data/admin";
import {
  createCoupon,
  createPlan,
  deactivateCoupon,
  inactivatePlan,
  listCoupons,
  listPlans,
  setDefaultPlan,
  updatePlan,
  type Coupon as RealCoupon,
  type Plan as RealPlan,
  type PlanFormData,
} from "@/lib/plans-api";
import { getPlatformIndicators, type PlatformIndicators } from "@/lib/platform-api";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

const menu: Array<{ label: string; icon: IconType }> = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Clientes", icon: UsersRound },
  { label: "Empresas", icon: Building2 },
  { label: "Mercados", icon: Store },
  { label: "Planos", icon: Star },
  { label: "Assinaturas", icon: ClipboardList },
  { label: "Pagamentos", icon: CreditCard },
  { label: "Cupons", icon: BadgePercent },
  { label: "Usuários", icon: Users },
  { label: "Suporte", icon: LifeBuoy },
  { label: "Integrações", icon: Plug },
  { label: "Auditoria", icon: FileClock },
  { label: "Configurações", icon: Settings },
];

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15";
const selectClass = `${inputClass} appearance-none`;
const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusTone: Record<SubscriptionStatus, Tone> = {
  Ativa: "positive",
  "Em teste": "neutral",
  Atrasada: "critical",
  Suspensa: "warning",
  Cancelada: "neutral",
};

export function AdminPanel({ onExit }: { onExit: () => void }) {
  const [active, setActive] = useState("Visão geral");
  const [menuOpen, setMenuOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const select = (label: string) => {
    setActive(label);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-scrim lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-brand-panel text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-sidebar-border px-5">
          <BrandLogo inverse />
          <Button
            variant="nav"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mx-3 mt-4 flex items-center gap-2 rounded-md bg-highlight/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-highlight">
          <ShieldCheck className="h-4 w-4" /> Administração da Plataforma
        </div>
        <nav
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
          aria-label="Menu administrativo"
        >
          {menu.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="nav"
              data-active={active === label}
              onClick={() => select(label)}
              className="w-full justify-start px-3"
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="nav" className="w-full justify-start px-3" onClick={onExit}>
            <LogOut className="h-[18px] w-[18px]" /> Sair da administração
          </Button>
        </div>
      </aside>

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-20 flex min-h-[74px] items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-primary">
              Administração da Plataforma
            </span>
            <strong className="block truncate text-lg">{active}</strong>
          </div>
          <span className="hidden items-center gap-2 text-sm sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-panel text-sm font-bold text-sidebar-foreground">
              AD
            </span>
            <span>
              <strong className="block text-sm">Administrador</strong>
              <span className="block text-xs text-muted-foreground">
                Proprietário da plataforma
              </span>
            </span>
          </span>
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

        <section className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {active === "Visão geral" && <Overview onNavigate={select} />}
          {(active === "Clientes" || active === "Assinaturas") && (
            <ClientsSection
              title={active === "Clientes" ? "Clientes e assinaturas" : "Assinaturas"}
              clients={clients}
              plans={plans}
              onChange={setClients}
              notify={setToast}
            />
          )}
          {active === "Empresas" && <CompaniesSection clients={clients} />}
          {active === "Mercados" && <MarketsSection clients={clients} />}
          {active === "Planos" && <PlansSection notify={setToast} />}
          {active === "Pagamentos" && <PaymentsSection />}
          {active === "Cupons" && <CouponsSection notify={setToast} />}
          {active === "Usuários" && <UsersSection notify={setToast} />}
          {active === "Suporte" && <SupportSection />}
          {active === "Integrações" && <IntegrationsSection notify={setToast} />}
          {active === "Auditoria" && <AuditSection />}
          {active === "Configurações" && <SettingsSection notify={setToast} />}
        </section>
      </div>
    </main>
  );
}

/* --------------------------------- Visão geral --------------------------------- */
/* B9.4 (IND-ADM-01..09): indicadores reais via get_platform_indicators, no
 * lugar dos números fictícios calculados a partir da lista mocada de
 * clientes. "Previsão de receita" não inventa crescimento: é a MRR atual,
 * assumindo base estável (nenhum modelo de previsão foi decidido). */

function Overview({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [indicators, setIndicators] = useState<PlatformIndicators | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatformIndicators().then((result) => {
      setIndicators(result);
      setLoading(false);
    });
  }, []);

  if (loading || !indicators) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Visão geral da plataforma</h1>
        </div>
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      </div>
    );
  }

  const metrics = [
    {
      title: "Empresas cadastradas",
      value: String(indicators.companiesCount),
      note: "Total na plataforma",
      icon: Building2,
    },
    {
      title: "Mercados ativos",
      value: String(indicators.activeMarkets),
      note: "Cobrados na assinatura",
      icon: Store,
      tone: "positive",
    },
    {
      title: "Assinaturas ativas",
      value: String(indicators.activeSubscriptions),
      note: "Pagando em dia",
      icon: CheckCircle2,
      tone: "positive",
    },
    {
      title: "Assinaturas em teste",
      value: String(indicators.trialSubscriptions),
      note: "Período gratuito",
      icon: Gift,
    },
    {
      title: "Assinaturas atrasadas",
      value: String(indicators.pastDueSubscriptions),
      note: "Cobrança pendente",
      icon: CalendarClock,
      tone: "critical",
    },
    {
      title: "Cancelamentos",
      value: String(indicators.cancelledSubscriptions),
      note: "Total acumulado",
      icon: XCircle,
      tone: "warning",
    },
    {
      title: "Receita mensal recorrente",
      value: brl(indicators.mrr),
      note: "MRR atual",
      icon: CircleDollarSign,
      tone: "positive",
    },
    {
      title: "Previsão de receita",
      value: brl(indicators.revenueForecast),
      note: "Assumindo base estável",
      icon: TrendingUp,
    },
    {
      title: "Conversão do teste",
      value: indicators.trialConversionPct !== null ? `${indicators.trialConversionPct}%` : "—",
      note: "Teste → assinatura",
      icon: BarChart3,
    },
  ];
  const statusBuckets: Array<{ label: string; value: number; tone?: Tone; muted?: boolean }> = [
    { label: "Ativa", value: indicators.activeSubscriptions, tone: "positive" },
    { label: "Em teste", value: indicators.trialSubscriptions, muted: true },
    { label: "Atrasada", value: indicators.pastDueSubscriptions, tone: "critical" },
    { label: "Suspensa", value: indicators.suspendedSubscriptions, tone: "warning" },
    { label: "Cancelada", value: indicators.cancelledSubscriptions, muted: true },
  ];
  const totalSubscriptions = statusBuckets.reduce((sum, bucket) => sum + bucket.value, 0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Visão geral da plataforma</h1>
        <p className="mt-1 text-muted-foreground">
          Indicadores calculados a partir dos dados reais da plataforma. Nenhum pagamento real está
          conectado (gateway pendente).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Metric key={metric.title} {...metric} />
        ))}
      </div>
      <ChartCard title="Assinaturas por situação" subtitle="Distribuição atual">
        <div className="mt-6 space-y-4">
          {statusBuckets.map((bucket) => (
            <HorizontalBar
              key={bucket.label}
              label={bucket.label}
              value={bucket.value}
              max={totalSubscriptions || 1}
              detail={String(bucket.value)}
              tone={bucket.tone}
              muted={bucket.muted}
            />
          ))}
        </div>
        <Button variant="outline" className="mt-6 w-full" onClick={() => onNavigate("Clientes")}>
          Ver clientes e assinaturas
        </Button>
      </ChartCard>
    </div>
  );
}

/* ------------------------------ Clientes e assinaturas ------------------------------ */

type ClientAction = "open" | "plan" | "days" | "discount" | "payments" | "audit";

function ClientsSection({
  title,
  clients,
  plans,
  onChange,
  notify,
}: {
  title: string;
  clients: Client[];
  plans: Plan[];
  onChange: (clients: Client[]) => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState<{ action: ClientAction; client: Client } | null>(null);
  const [confirm, setConfirm] = useState<{
    client: Client;
    status: SubscriptionStatus;
    label: string;
  } | null>(null);
  const filtered = clients.filter((client) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return (
      (!normalized ||
        `${client.company} ${client.owner} ${client.cnpj}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized)) &&
      (status === "all" || client.status === status)
    );
  });
  const update = (client: Client, message: string) => {
    onChange(clients.map((item) => (item.id === client.id ? client : item)));
    notify(message);
    setDialog(null);
    setConfirm(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie as empresas clientes, planos e situação das assinaturas.
        </p>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar clientes"
            placeholder="Buscar empresa, responsável ou CNPJ"
            className={cn(inputClass, "pl-10")}
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar por situação"
          className={selectClass}
        >
          <option value="all">Todas as situações</option>
          {(["Ativa", "Em teste", "Atrasada", "Suspensa", "Cancelada"] as SubscriptionStatus[]).map(
            (item) => (
              <option key={item}>{item}</option>
            ),
          )}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nenhum cliente encontrado"
          description="Revise a busca ou o filtro."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-card lg:block">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  {[
                    "Empresa",
                    "Responsável",
                    "CNPJ",
                    "Plano",
                    "Mercados",
                    "Situação",
                    "Próxima cobrança",
                    "Valor mensal",
                    "Período de teste",
                    "Último acesso",
                  ].map((header) => (
                    <th key={header} className="px-3 py-3 font-bold">
                      {header}
                    </th>
                  ))}
                  <th className="sticky right-0 bg-card px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-border last:border-0 hover:bg-muted/60"
                  >
                    <td className="px-3 py-3 font-bold">{client.company}</td>
                    <td className="px-3 py-3">{client.owner}</td>
                    <td className="px-3 py-3 font-mono text-xs">{client.cnpj}</td>
                    <td className="px-3 py-3">{client.plan}</td>
                    <td className="px-3 py-3">{client.markets}</td>
                    <td className="px-3 py-3">
                      <AlertPill label={client.status} tone={statusTone[client.status]} />
                    </td>
                    <td className="px-3 py-3">{client.nextBilling}</td>
                    <td className="px-3 py-3">
                      <strong>{brl(client.monthly * (1 - client.discount / 100))}</strong>
                      {client.discount > 0 && (
                        <span className="block text-xs text-success">
                          {client.discount}% de desconto
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">{client.trial}</td>
                    <td className="px-3 py-3 text-muted-foreground">{client.lastAccess}</td>
                    <td className="sticky right-0 bg-card px-2 py-3 shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.25)]">
                      <ClientMenu
                        client={client}
                        onAction={(action) => setDialog({ action, client })}
                        onStatus={(next, label) => setConfirm({ client, status: next, label })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((client) => (
              <article
                key={client.id}
                className="rounded-lg border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block">{client.company}</strong>
                    <span className="block text-sm text-muted-foreground">{client.owner}</span>
                  </div>
                  <ClientMenu
                    client={client}
                    onAction={(action) => setDialog({ action, client })}
                    onStatus={(next, label) => setConfirm({ client, status: next, label })}
                  />
                </div>
                <div className="mt-2">
                  <AlertPill label={client.status} tone={statusTone[client.status]} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                  <Info label="CNPJ" value={client.cnpj} />
                  <Info label="Plano" value={`${client.plan} · ${client.markets} merc.`} />
                  <Info label="Próxima cobrança" value={client.nextBilling} />
                  <Info
                    label="Valor mensal"
                    value={brl(client.monthly * (1 - client.discount / 100))}
                  />
                  <Info label="Teste" value={client.trial} />
                  <Info label="Último acesso" value={client.lastAccess} />
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      {dialog && (
        <ClientDialog
          action={dialog.action}
          client={dialog.client}
          plans={plans}
          onClose={() => setDialog(null)}
          onSave={update}
        />
      )}
      {confirm && (
        <Modal
          title={`${confirm.label} assinatura?`}
          description={confirm.client.company}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                Voltar
              </Button>
              <Button
                variant={confirm.status === "Cancelada" ? "destructive" : "default"}
                onClick={() =>
                  update(
                    {
                      ...confirm.client,
                      status: confirm.status,
                      nextBilling: confirm.status === "Ativa" ? "22/10/2026" : "—",
                    },
                    `Assinatura de ${confirm.client.company}: ${confirm.status.toLowerCase()}.`,
                  )
                }
              >
                Confirmar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            A situação passará de <strong>{confirm.client.status}</strong> para{" "}
            <strong>{confirm.status}</strong>. Esta é uma simulação e nenhuma cobrança real será
            alterada.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ClientMenu({
  client,
  onAction,
  onStatus,
}: {
  client: Client;
  onAction: (action: ClientAction) => void;
  onStatus: (status: SubscriptionStatus, label: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${client.company}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => onAction("open")}>Abrir empresa</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("plan")}>Alterar plano</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("days")}>
          Conceder dias adicionais
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("discount")}>Aplicar desconto</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={client.status === "Suspensa" || client.status === "Cancelada"}
          onSelect={() => onStatus("Suspensa", "Suspender")}
        >
          Suspender
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={client.status === "Ativa"}
          onSelect={() => onStatus("Ativa", "Reativar")}
        >
          Reativar
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={client.status === "Cancelada"}
          onSelect={() => onStatus("Cancelada", "Cancelar")}
          className="text-critical"
        >
          Cancelar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction("payments")}>
          Visualizar pagamentos
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("audit")}>Acessar auditoria</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClientDialog({
  action,
  client,
  plans,
  onClose,
  onSave,
}: {
  action: ClientAction;
  client: Client;
  plans: Plan[];
  onClose: () => void;
  onSave: (client: Client, message: string) => void;
}) {
  const [plan, setPlan] = useState(client.plan);
  const [days, setDays] = useState(7);
  const [discount, setDiscount] = useState(client.discount);
  if (action === "open") {
    return (
      <Modal title={client.company} description={`CNPJ ${client.cnpj}`} onClose={onClose}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Responsável" value={client.owner} />
          <Info label="Plano" value={client.plan} />
          <Info label="Mercados" value={String(client.markets)} />
          <Info label="Situação" value={client.status} />
          <Info label="Próxima cobrança" value={client.nextBilling} />
          <Info label="Último acesso" value={client.lastAccess} />
        </dl>
      </Modal>
    );
  }
  if (action === "payments") {
    const list = payments.filter((payment) => payment.client === client.company);
    return (
      <Modal title="Pagamentos" description={client.company} onClose={onClose}>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <span>
                  <strong className="block">
                    {payment.id} · {brl(payment.value)}
                  </strong>
                  <span className="text-muted-foreground">
                    {payment.date} · {payment.method}
                  </span>
                </span>
                <AlertPill
                  label={payment.status}
                  tone={
                    payment.status === "Pago"
                      ? "positive"
                      : payment.status === "Em atraso"
                        ? "critical"
                        : "neutral"
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento registrado para este cliente.
          </p>
        )}
      </Modal>
    );
  }
  if (action === "audit") {
    const list = auditLog.filter((entry) => entry.target === client.company);
    return (
      <Modal title="Auditoria" description={client.company} onClose={onClose}>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((entry) => (
              <li
                key={`${entry.time}-${entry.action}`}
                className="rounded-md border border-border p-3 text-sm"
              >
                <strong className="block">{entry.action}</strong>
                <span className="text-muted-foreground">
                  {entry.time} · {entry.user}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum registro de auditoria para este cliente.
          </p>
        )}
      </Modal>
    );
  }
  const title =
    action === "plan"
      ? "Alterar plano"
      : action === "days"
        ? "Conceder dias adicionais"
        : "Aplicar desconto";
  const save = () => {
    if (action === "plan") {
      const selected = plans.find((item) => item.name === plan);
      onSave(
        {
          ...client,
          plan,
          monthly: selected
            ? selected.basePrice +
              Math.max(0, client.markets - selected.includedMarkets) * selected.perMarket
            : client.monthly,
        },
        `Plano de ${client.company} alterado para ${plan}.`,
      );
    } else if (action === "days")
      onSave(
        {
          ...client,
          trial: `${days} dias adicionais concedidos`,
          status: client.status === "Cancelada" ? client.status : "Em teste",
        },
        `${days} dias adicionais concedidos a ${client.company}.`,
      );
    else onSave({ ...client, discount }, `Desconto de ${discount}% aplicado a ${client.company}.`);
  };
  return (
    <Modal
      title={title}
      description={client.company}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>
            <CheckCircle2 className="h-4 w-4" /> Salvar
          </Button>
        </>
      }
    >
      {action === "plan" && (
        <Field label="Novo plano">
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            className={selectClass}
          >
            {plans
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
          </select>
        </Field>
      )}
      {action === "days" && (
        <Field label="Dias adicionais">
          <input
            type="number"
            min="1"
            max="90"
            value={days}
            onChange={(event) =>
              setDays(Math.min(90, Math.max(1, Number(event.target.value) || 1)))
            }
            className={inputClass}
          />
        </Field>
      )}
      {action === "discount" && (
        <Field label="Desconto (%)">
          <input
            type="number"
            min="0"
            max="100"
            value={discount}
            onChange={(event) =>
              setDiscount(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
            }
            className={inputClass}
          />
        </Field>
      )}
    </Modal>
  );
}

function CompaniesSection({ clients }: { clients: Client[] }) {
  return (
    <Section title="Empresas" subtitle="Empresas cadastradas na plataforma">
      <SimpleTable
        headers={["Empresa", "CNPJ", "Responsável", "Mercados", "Situação"]}
        rows={clients.map((client) => [
          <strong key="c">{client.company}</strong>,
          client.cnpj,
          client.owner,
          client.markets,
          <AlertPill key="s" label={client.status} tone={statusTone[client.status]} />,
        ])}
      />
    </Section>
  );
}

function MarketsSection({ clients }: { clients: Client[] }) {
  const rows = clients.flatMap((client) =>
    Array.from({ length: client.markets }, (_, index) => [
      <strong key="m">
        {client.company.split(" ")[0]} · Unidade {index + 1}
      </strong>,
      client.company,
      client.plan,
      <AlertPill
        key="s"
        label={
          client.status === "Ativa"
            ? "Ativo"
            : client.status === "Em teste"
              ? "Em teste"
              : "Inativo"
        }
        tone={
          client.status === "Ativa"
            ? "positive"
            : client.status === "Em teste"
              ? "neutral"
              : "warning"
        }
      />,
    ]),
  );
  return (
    <Section title="Mercados" subtitle={`${rows.length} mercados vinculados às empresas clientes`}>
      <SimpleTable headers={["Mercado", "Empresa", "Plano", "Situação"]} rows={rows} />
    </Section>
  );
}

/* ------------------------------------ Planos ------------------------------------ */
/* B9.1 (PA-28/29/31): dados reais via plans-api.ts. Preço é opcional — a
 * comercial ainda não fechou valores (ver docs/DECISOES.md). Teste grátis é
 * configurado por plano, não mais um interruptor único do sistema. */

const emptyPlanForm: PlanFormData = {
  name: "",
  description: "",
  basePrice: null,
  pricePerMarket: null,
  maxMarkets: null,
  features: [],
  trialDays: 15,
  requiresPaymentMethodForTrial: false,
};

function planFormFromPlan(plan: RealPlan): PlanFormData {
  return {
    name: plan.name,
    description: plan.description,
    basePrice: plan.basePrice,
    pricePerMarket: plan.pricePerMarket,
    maxMarkets: plan.maxMarkets,
    features: plan.features,
    trialDays: plan.trialDays,
    requiresPaymentMethodForTrial: plan.requiresPaymentMethodForTrial,
  };
}

function PlansSection({ notify }: { notify: (message: string) => void }) {
  const [plans, setPlans] = useState<RealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; data: PlanFormData } | null>(null);

  const reload = () => {
    listPlans().then((list) => {
      setPlans(list);
      setLoading(false);
    });
  };
  useEffect(() => {
    reload();
  }, []);

  const save = async (data: PlanFormData) => {
    const result = editing?.id ? await updatePlan(editing.id, data) : await createPlan(data);
    if (!result.ok) return result.message;
    notify(`Plano ${result.plan.name} salvo.`);
    setEditing(null);
    reload();
    return "";
  };

  const onSetDefault = async (plan: RealPlan) => {
    const result = await setDefaultPlan(plan.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`${plan.name} agora é o plano padrão.`);
    reload();
  };

  const onInactivate = async (plan: RealPlan) => {
    const result = await inactivatePlan(plan.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`Plano ${plan.name} inativado.`);
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Planos</h1>
          <p className="mt-1 text-muted-foreground">
            Estrutura de planos da plataforma. Preços comerciais podem ser cadastrados quando forem
            definidos.
          </p>
        </div>
        <Button onClick={() => setEditing({ id: null, data: emptyPlanForm })}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando planos...</p>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhum plano cadastrado"
          description="Cadastre o primeiro plano da plataforma."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-lg border bg-card p-5 shadow-card",
                plan.isDefault ? "border-primary ring-2 ring-primary/20" : "border-border",
                plan.status !== "active" && "opacity-60",
              )}
            >
              {plan.isDefault && (
                <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  Plano padrão
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold">{plan.name}</h2>
                <AlertPill
                  label={plan.status === "active" ? "Ativo" : "Inativo"}
                  tone={plan.status === "active" ? "positive" : "neutral"}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description || "Sem descrição."}
              </p>
              <p className="mt-4">
                {plan.basePrice !== null ? (
                  <>
                    <strong className="text-3xl font-extrabold">{brl(plan.basePrice)}</strong>
                    <span className="text-sm text-muted-foreground"> / mês</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Preço a definir
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {plan.maxMarkets
                  ? `Até ${plan.maxMarkets} ${plan.maxMarkets === 1 ? "mercado" : "mercados"}`
                  : "Sem limite de mercados"}
                {plan.pricePerMarket !== null &&
                  ` · ${brl(plan.pricePerMarket)} por mercado adicional`}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {plan.features.length ? (
                  plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">Nenhum recurso listado.</li>
                )}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Teste grátis: {plan.trialDays} {plan.trialDays === 1 ? "dia" : "dias"}
                {plan.requiresPaymentMethodForTrial ? " · exige cartão" : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing({ id: plan.id, data: planFormFromPlan(plan) })}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                {!plan.isDefault && (
                  <Button variant="outline" size="sm" onClick={() => onSetDefault(plan)}>
                    Tornar padrão
                  </Button>
                )}
                {!plan.isDefault && plan.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => onInactivate(plan)}>
                    Inativar
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <PlanForm
          isNew={editing.id === null}
          initial={editing.data}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function PlanForm({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: PlanFormData;
  isNew: boolean;
  onClose: () => void;
  onSave: (data: PlanFormData) => Promise<string>;
}) {
  const [plan, setPlan] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof PlanFormData>(key: K, value: PlanFormData[K]) => {
    setPlan((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const submit = async () => {
    if (plan.name.trim().length < 2) {
      setError("Informe o nome do plano.");
      return;
    }
    if (plan.trialDays < 0) {
      setError("Informe uma quantidade válida de dias de teste.");
      return;
    }
    const message = await onSave({ ...plan, name: plan.name.trim() });
    if (message) setError(message);
  };
  return (
    <Modal
      title={isNew ? "Novo plano" : `Editar plano ${initial.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            <CheckCircle2 className="h-4 w-4" /> Salvar plano
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input
            value={plan.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={40}
            className={inputClass}
          />
        </Field>
        <Field label="Dias de teste grátis">
          <input
            type="number"
            min="0"
            value={plan.trialDays}
            onChange={(event) => set("trialDays", Math.max(0, Number(event.target.value) || 0))}
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descrição">
            <input
              value={plan.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={160}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Valor base (R$) — opcional">
          <input
            type="number"
            min="0"
            step="0.01"
            value={plan.basePrice ?? ""}
            placeholder="A definir"
            onChange={(event) =>
              set(
                "basePrice",
                event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0),
              )
            }
            className={inputClass}
          />
        </Field>
        <Field label="Valor por mercado (R$) — opcional">
          <input
            type="number"
            min="0"
            step="0.01"
            value={plan.pricePerMarket ?? ""}
            placeholder="A definir"
            onChange={(event) =>
              set(
                "pricePerMarket",
                event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0),
              )
            }
            className={inputClass}
          />
        </Field>
        <Field label="Limite de mercados — opcional">
          <input
            type="number"
            min="1"
            value={plan.maxMarkets ?? ""}
            placeholder="Sem limite"
            onChange={(event) =>
              set(
                "maxMarkets",
                event.target.value === "" ? null : Math.max(1, Number(event.target.value) || 1),
              )
            }
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Recursos incluídos</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {allFeatures.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-2.5 rounded-md border border-border p-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={plan.features.includes(feature)}
                  onChange={(event) =>
                    set(
                      "features",
                      event.target.checked
                        ? [...plan.features, feature]
                        : plan.features.filter((item) => item !== feature),
                    )
                  }
                  className="h-4 w-4 accent-primary"
                />
                {feature}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2.5 rounded-md border border-border p-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={plan.requiresPaymentMethodForTrial}
            onChange={(event) => set("requiresPaymentMethodForTrial", event.target.checked)}
            className="h-4 w-4 accent-primary"
          />{" "}
          Exigir cartão para iniciar o teste
        </label>
      </div>
      {error && (
        <p className="mt-3 text-sm font-semibold text-critical" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

/* ------------------------------ Demais seções simples ------------------------------ */

function PaymentsSection() {
  const total = payments
    .filter((payment) => payment.status === "Pago")
    .reduce((sum, payment) => sum + payment.value, 0);
  return (
    <Section title="Pagamentos" subtitle={`Recebido no mês: ${brl(total)} · valores fictícios`}>
      <SimpleTable
        headers={["Código", "Cliente", "Valor", "Forma", "Data", "Situação"]}
        rows={payments.map((payment) => [
          <strong key="i">{payment.id}</strong>,
          payment.client,
          brl(payment.value),
          payment.method,
          payment.date,
          <AlertPill
            key="s"
            label={payment.status}
            tone={
              payment.status === "Pago"
                ? "positive"
                : payment.status === "Em atraso"
                  ? "critical"
                  : "neutral"
            }
          />,
        ])}
      />
    </Section>
  );
}

/* ------------------------------------ Cupons ------------------------------------ */
/* B9.1 (RN-BILL-06): dados reais via plans-api.ts — um cupom por empresa,
 * nunca cumulativo, sempre com limite de uso e/ou validade controlados. */

function CouponsSection({ notify }: { notify: (message: string) => void }) {
  const [coupons, setCoupons] = useState<RealCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    listCoupons().then((list) => {
      setCoupons(list);
      setLoading(false);
    });
  };
  useEffect(() => {
    reload();
  }, []);

  const onDeactivate = async (coupon: RealCoupon) => {
    const result = await deactivateCoupon(coupon.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`Cupom ${coupon.code} desativado.`);
    reload();
  };

  const discountLabel = (coupon: RealCoupon) =>
    coupon.discountType === "percentual" ? `${coupon.discountValue}%` : brl(coupon.discountValue);
  const usageLabel = (coupon: RealCoupon) =>
    coupon.usageLimit !== null
      ? `${coupon.timesUsed} / ${coupon.usageLimit}`
      : String(coupon.timesUsed);
  const validityLabel = (coupon: RealCoupon) =>
    coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString("pt-BR") : "Sem prazo";

  return (
    <Section
      title="Cupons"
      subtitle="Descontos promocionais para novos clientes, com limite de uso e validade"
      action={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      }
    >
      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Carregando cupons...</p>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title="Nenhum cupom cadastrado"
          description="Crie o primeiro cupom promocional."
        />
      ) : (
        <SimpleTable
          headers={["Código", "Desconto", "Usos", "Validade", "Situação", ""]}
          rows={coupons.map((coupon) => [
            <strong key="c" className="font-mono">
              {coupon.code}
            </strong>,
            discountLabel(coupon),
            usageLabel(coupon),
            validityLabel(coupon),
            <AlertPill
              key="s"
              label={coupon.status === "active" ? "Ativo" : "Encerrado"}
              tone={coupon.status === "active" ? "positive" : "neutral"}
            />,
            coupon.status === "active" ? (
              <Button key="a" variant="outline" size="sm" onClick={() => onDeactivate(coupon)}>
                Desativar
              </Button>
            ) : null,
          ])}
        />
      )}
      {creating && (
        <CouponForm
          onClose={() => setCreating(false)}
          onSave={async (data) => {
            const result = await createCoupon(
              data.code,
              data.discountType,
              data.discountValue,
              data.validUntil,
              data.usageLimit,
              data.eligibilityNote,
            );
            if (!result.ok) return result.message;
            notify(`Cupom ${result.coupon.code} criado.`);
            setCreating(false);
            reload();
            return "";
          }}
        />
      )}
    </Section>
  );
}

type CouponFormData = {
  code: string;
  discountType: Database["public"]["Enums"]["coupon_discount_type"];
  discountValue: number;
  validUntil: string | null;
  usageLimit: number | null;
  eligibilityNote: string;
};

function CouponForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: CouponFormData) => Promise<string>;
}) {
  const [data, setData] = useState<CouponFormData>({
    code: "",
    discountType: "percentual",
    discountValue: 10,
    validUntil: null,
    usageLimit: null,
    eligibilityNote: "",
  });
  const [error, setError] = useState("");
  const set = <K extends keyof CouponFormData>(key: K, value: CouponFormData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const submit = async () => {
    if (data.code.trim().length < 2) {
      setError("Informe o código do cupom.");
      return;
    }
    if (data.discountValue <= 0) {
      setError("Informe um valor de desconto maior que zero.");
      return;
    }
    const message = await onSave(data);
    if (message) setError(message);
  };
  return (
    <Modal
      title="Novo cupom"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            <CheckCircle2 className="h-4 w-4" /> Criar cupom
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código">
          <input
            value={data.code}
            onChange={(event) => set("code", event.target.value.toUpperCase())}
            maxLength={30}
            className={cn(inputClass, "font-mono uppercase")}
          />
        </Field>
        <Field label="Tipo de desconto">
          <select
            value={data.discountType}
            onChange={(event) =>
              set("discountType", event.target.value as CouponFormData["discountType"])
            }
            className={selectClass}
          >
            <option value="percentual">Percentual</option>
            <option value="valor_fixo">Valor fixo (R$)</option>
          </select>
        </Field>
        <Field label={data.discountType === "percentual" ? "Desconto (%)" : "Desconto (R$)"}>
          <input
            type="number"
            min="0"
            max={data.discountType === "percentual" ? 100 : undefined}
            step={data.discountType === "percentual" ? 1 : 0.01}
            value={data.discountValue}
            onChange={(event) => set("discountValue", Math.max(0, Number(event.target.value) || 0))}
            className={inputClass}
          />
        </Field>
        <Field label="Limite de uso — opcional">
          <input
            type="number"
            min="1"
            value={data.usageLimit ?? ""}
            placeholder="Sem limite"
            onChange={(event) =>
              set(
                "usageLimit",
                event.target.value === "" ? null : Math.max(1, Number(event.target.value) || 1),
              )
            }
            className={inputClass}
          />
        </Field>
        <Field label="Válido até — opcional">
          <input
            type="date"
            value={data.validUntil ?? ""}
            onChange={(event) => set("validUntil", event.target.value || null)}
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observação de elegibilidade — opcional">
            <input
              value={data.eligibilityNote}
              onChange={(event) => set("eligibilityNote", event.target.value)}
              maxLength={160}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm font-semibold text-critical" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

function UsersSection({ notify }: { notify: (message: string) => void }) {
  return (
    <Section
      title="Usuários da plataforma"
      subtitle="Equipe interna com acesso à administração"
      action={
        <Button size="sm" onClick={() => notify("Convite enviado (simulação).")}>
          <UserPlus className="h-4 w-4" /> Convidar
        </Button>
      }
    >
      <SimpleTable
        headers={["Nome", "E-mail", "Perfil", "Último acesso"]}
        rows={platformUsers.map((user) => [
          <strong key="n">{user.name}</strong>,
          user.email,
          user.role,
          user.lastAccess,
        ])}
      />
    </Section>
  );
}

function SupportSection() {
  return (
    <Section title="Suporte" subtitle="Chamados abertos pelos clientes">
      <SimpleTable
        headers={["Chamado", "Cliente", "Assunto", "Prioridade", "Situação", "Atualização"]}
        rows={tickets.map((ticket) => [
          <strong key="i">{ticket.id}</strong>,
          ticket.client,
          ticket.subject,
          <AlertPill
            key="p"
            label={ticket.priority}
            tone={ticket.priority === "Alta" ? "critical" : "neutral"}
          />,
          <AlertPill
            key="s"
            label={ticket.status}
            tone={
              ticket.status === "Resolvido"
                ? "positive"
                : ticket.status === "Aberto"
                  ? "warning"
                  : "neutral"
            }
          />,
          ticket.updated,
        ])}
      />
    </Section>
  );
}

function IntegrationsSection({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Integrações</h1>
        <p className="mt-1 text-muted-foreground">
          Nesta fase nenhuma integração real está conectada.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <article
            key={integration.name}
            className="flex items-start gap-4 rounded-lg border border-border bg-card p-5 shadow-card"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Plug className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{integration.name}</strong>
                <AlertPill label={integration.status} tone="neutral" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => notify(`${integration.name}: disponível na próxima fase.`)}
              >
                Configurar
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AuditSection() {
  return (
    <Section title="Auditoria" subtitle="Registro das ações administrativas">
      <SimpleTable
        headers={["Data e hora", "Usuário", "Ação", "Alvo"]}
        rows={auditLog.map((entry) => [
          entry.time,
          entry.user,
          <strong key="a">{entry.action}</strong>,
          entry.target,
        ])}
      />
    </Section>
  );
}

function SettingsSection({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState({
    name: "Mercado Fácil",
    email: "contato@mercadofacil.com.br",
    maintenance: false,
    twoFactor: true,
  });
  return (
    <Section title="Configurações da plataforma" subtitle="Dados gerais e segurança">
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nome da plataforma">
          <input
            value={settings.name}
            onChange={(event) =>
              setSettings((current) => ({ ...current, name: event.target.value }))
            }
            maxLength={60}
            className={inputClass}
          />
        </Field>
        <Field label="E-mail de contato">
          <input
            type="email"
            value={settings.email}
            onChange={(event) =>
              setSettings((current) => ({ ...current, email: event.target.value }))
            }
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-md border border-border p-4 text-sm">
          <span>
            <strong className="block">Autenticação em duas etapas</strong>
            <span className="text-muted-foreground">Obrigatória para administradores.</span>
          </span>
          <input
            type="checkbox"
            checked={settings.twoFactor}
            onChange={(event) =>
              setSettings((current) => ({ ...current, twoFactor: event.target.checked }))
            }
            className="h-5 w-5 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-md border border-border p-4 text-sm">
          <span>
            <strong className="block">Modo de manutenção</strong>
            <span className="text-muted-foreground">Exibe aviso para os clientes.</span>
          </span>
          <input
            type="checkbox"
            checked={settings.maintenance}
            onChange={(event) =>
              setSettings((current) => ({ ...current, maintenance: event.target.checked }))
            }
            className="h-5 w-5 accent-primary"
          />
        </label>
      </div>
      <Button className="mt-5" onClick={() => notify("Configurações salvas (simulação).")}>
        <CheckCircle2 className="h-4 w-4" /> Salvar configurações
      </Button>
    </Section>
  );
}

/* ------------------------------------ Auxiliares ------------------------------------ */

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      <section className="rounded-lg border border-border bg-card px-2 pb-2 shadow-card sm:px-4 sm:pb-4">
        {children}
      </section>
    </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="break-words font-semibold">{value}</dd>
    </div>
  );
}
