import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import operationsImage from "@/assets/mercado-facil-operations.jpg";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { SignupFlow } from "@/components/signup-flow";
import { OwnerDashboard } from "@/components/owner-dashboard";

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
  return view === "dashboard" ? <OwnerDashboard onLogout={() => setView("login")} /> : <Login onLogin={() => setView("dashboard")} onSignup={() => setView("signup")} />;
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

