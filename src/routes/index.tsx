import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Search,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  X,
} from "lucide-react";
import operationsImage from "@/assets/mercado-facil-operations.jpg";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { SignupFlow } from "@/components/signup-flow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mercado Fácil | Gestão de supermercados" },
      { name: "description", content: "Gestão integrada de estoque, recebimento, reposição, validade e vendas para redes de supermercados." },
      { property: "og:title", content: "Mercado Fácil | Gestão de supermercados" },
      { property: "og:description", content: "Controle todos os seus mercados em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MercadoFacil,
});

function MercadoFacil() {
  const [view, setView] = useState<"login" | "signup" | "dashboard">("login");
  if (view === "signup") return <SignupFlow onBack={() => setView("login")} onComplete={() => setView("dashboard")} />;
  return view === "dashboard" ? <Dashboard onLogout={() => setView("login")} /> : <Login onLogin={() => setView("dashboard")} onSignup={() => setView("signup")} />;
}

function Login({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin();
  }

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-brand-panel p-10 text-sidebar-foreground lg:flex lg:flex-col xl:p-14">
        <BrandLogo inverse />
        <div className="relative z-10 mt-14 max-w-2xl xl:mt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-sm font-semibold text-brand-soft">
            <span className="h-2 w-2 rounded-full bg-highlight" /> Gestão integrada para o varejo
          </span>
          <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-normal xl:text-5xl">
            Controle todos os seus mercados em um só lugar.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-sidebar-muted">
            Estoque, recebimento, reposição, validade e vendas acompanhados em tempo real.
          </p>
        </div>
        <div className="relative mt-10 min-h-0 flex-1 overflow-hidden rounded-lg border border-sidebar-border shadow-visual">
          <img src={operationsImage} alt="Operação integrada de estoque e gôndolas" className="h-full w-full object-cover object-center" width={1200} height={1408} />
          <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-3">
            {[['12', 'lojas conectadas'], ['98,4%', 'estoque preciso'], ['24h', 'em operação']].map(([value, label]) => (
              <div key={label} className="rounded-md border border-overlay-border bg-overlay p-3 backdrop-blur-md">
                <strong className="block text-lg text-sidebar-foreground">{value}</strong>
                <span className="text-xs font-medium text-sidebar-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
        <div className="w-full max-w-[470px]">
          <BrandLogo className="mb-10 lg:hidden" />
          <div className="mb-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-highlight-soft px-3 py-1.5 text-sm font-bold text-highlight-foreground">
              <Check className="h-4 w-4" /> Teste grátis disponível
            </div>
            <h2 className="text-3xl font-extrabold tracking-normal text-foreground">Acesse sua operação</h2>
            <p className="mt-2 text-base text-muted-foreground">Entre com seus dados para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">E-mail</span>
              <input required type="email" defaultValue="gestor@mercadofacil.com.br" className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">Senha</span>
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} defaultValue="mercado123" className="h-12 w-full rounded-md border border-input bg-card px-4 pr-12 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
                <Button type="button" variant="ghost" className="absolute right-1 top-0 h-12 min-h-0 w-11 px-0" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <label className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
                <input type="checkbox" defaultChecked className="h-4 w-4 shrink-0 accent-primary" /> Lembrar acesso
              </label>
              <button type="button" onClick={() => setNotice("Enviaremos as instruções para o e-mail cadastrado.")} className="font-semibold text-primary hover:underline">Esqueci minha senha</button>
            </div>
            {notice && <p role="status" className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">{notice}</p>}
            <Button type="submit" className="w-full">Entrar <ArrowRight className="h-4 w-4" /></Button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">ou continue com</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={onLogin}><span className="text-lg font-extrabold text-google">G</span> Google</Button>
            <Button variant="outline" onClick={onLogin}><span className="grid h-5 w-5 place-items-center rounded-full bg-facebook text-xs font-extrabold text-social-foreground">f</span> Facebook</Button>
          </div>
          <p className="mt-7 text-center text-sm text-muted-foreground">Ainda não possui acesso? <button type="button" onClick={onSignup} className="font-bold text-primary hover:underline">Criar minha conta</button></p>
          <div className="mt-8 border-t border-border pt-6 text-center">
            <button type="button" onClick={() => setNotice("Modo administrativo selecionado.")} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Acesso administrativo</button>
          </div>
        </div>
      </section>
    </main>
  );
}

const navItems = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Lojas", icon: Building2 },
  { label: "Estoque", icon: Boxes },
  { label: "Recebimento", icon: Truck },
  { label: "Reposição", icon: PackageCheck },
  { label: "Vendas", icon: ShoppingCart },
  { label: "Equipe", icon: Users },
  { label: "Relatórios", icon: BarChart3 },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("Visão geral");
  const selectNav = (label: string) => { setActive(label); setMenuOpen(false); };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {menuOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-brand-panel p-5 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
          <BrandLogo inverse />
          <Button variant="nav" className="h-10 min-h-0 w-10 px-0 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
        </div>
        <p className="mb-4 mt-9 px-3 text-xs font-bold uppercase tracking-widest text-sidebar-muted">Operação</p>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <Button key={label} variant="nav" data-active={active === label} onClick={() => selectNav(label)} className="w-full justify-start px-3">
              <Icon className="h-[18px] w-[18px]" /> {label}
            </Button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
          <Button variant="nav" className="w-full justify-start px-3"><Settings className="h-[18px] w-[18px]" /> Configurações</Button>
          <Button variant="nav" className="w-full justify-start px-3" onClick={onLogout}><LogOut className="h-[18px] w-[18px]" /> Sair</Button>
        </div>
      </aside>

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-20 grid h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" className="h-10 min-h-0 w-10 shrink-0 px-0 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
            <div className="relative hidden min-w-0 max-w-md flex-1 md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar" placeholder="Buscar produto, loja ou relatório" className="h-10 w-full rounded-md bg-muted pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <span className="truncate text-lg font-bold md:hidden">{active}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" className="relative h-10 min-h-0 w-10 px-0" aria-label="Notificações"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-critical" /></Button>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <button className="flex items-center gap-2 rounded-md p-1.5 hover:bg-accent">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-panel text-sm font-bold text-sidebar-foreground">MA</span>
              <span className="hidden text-left sm:block"><strong className="block text-sm">Marina Alves</strong><span className="block text-xs text-muted-foreground">Administradora</span></span>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </button>
          </div>
        </header>

        <section className="p-4 sm:p-7 lg:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0"><p className="text-sm font-semibold text-primary">Terça-feira, 22 de setembro</p><h1 className="mt-1 truncate text-2xl font-extrabold tracking-normal sm:text-3xl">Olá, Marina</h1><p className="mt-1 text-base text-muted-foreground">Acompanhe o desempenho da sua rede hoje.</p></div>
            <Button className="hidden sm:inline-flex"><BarChart3 className="h-4 w-4" /> Ver relatórios</Button>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Vendas hoje" value="R$ 184.290" note="12,8% vs. ontem" icon={TrendingUp} trend />
            <Metric title="Produtos em estoque" value="48.621" note="em 12 lojas" icon={Boxes} />
            <Metric title="Rupturas" value="27" note="8 precisam de ação" icon={AlertTriangle} warning />
            <Metric title="Recebimentos" value="14" note="5 em andamento" icon={Truck} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><h2 className="text-lg font-bold">Vendas da rede</h2><p className="text-sm text-muted-foreground">Últimos 7 dias</p></div><span className="shrink-0 rounded-md bg-highlight-soft px-2.5 py-1 text-sm font-bold text-highlight-foreground">+9,4%</span></div>
              <div className="mt-7 flex h-56 items-end gap-2 sm:gap-4" aria-label="Gráfico de vendas dos últimos sete dias">
                {[48, 62, 55, 76, 68, 88, 82].map((height, index) => <div key={index} className="grid h-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2"><div className="flex items-end"><div className="w-full rounded-t-sm bg-chart-bar transition hover:bg-primary" style={{ height: `${height}%` }} /></div><span className="text-center text-xs font-semibold text-muted-foreground">{['Qua','Qui','Sex','Sáb','Dom','Seg','Hoje'][index]}</span></div>)}
              </div>
            </section>
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Atenção necessária</h2><p className="text-sm text-muted-foreground">Prioridades da operação</p></div><HelpCircle className="h-5 w-5 text-muted-foreground" /></div>
              <div className="mt-5 space-y-3">
                <AlertItem tone="critical" title="8 produtos em ruptura" detail="Loja Centro · Estoque crítico" />
                <AlertItem tone="warning" title="23 itens próximos da validade" detail="Vencimento em até 5 dias" />
                <AlertItem tone="info" title="5 entregas em andamento" detail="Próxima chegada às 19:30" />
              </div>
              <Button variant="outline" className="mt-5 w-full">Ver central de alertas</Button>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value, note, icon: Icon, trend, warning }: { title: string; value: string; note: string; icon: typeof Boxes; trend?: boolean; warning?: boolean }) {
  return <article className="rounded-lg border border-border bg-card p-5 shadow-card"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{title}</p><strong className="mt-2 block text-2xl font-extrabold">{value}</strong></div><span className={`grid h-10 w-10 place-items-center rounded-md ${warning ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'}`}><Icon className="h-5 w-5" /></span></div><p className={`mt-3 text-sm font-medium ${trend ? 'text-success' : warning ? 'text-critical' : 'text-muted-foreground'}`}>{note}</p></article>;
}

function AlertItem({ tone, title, detail }: { tone: "critical" | "warning" | "info"; title: string; detail: string }) {
  const tones = { critical: "bg-critical", warning: "bg-warning", info: "bg-primary" };
  return <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md bg-muted p-3.5"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${tones[tone]}`} /><div className="min-w-0"><strong className="block text-sm">{title}</strong><span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span></div></div>;
}
