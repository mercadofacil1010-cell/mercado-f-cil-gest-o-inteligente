import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import operationsImage from "@/assets/mercado-facil-operations.jpg";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { SignupFlow } from "@/components/signup-flow";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { StockerApp } from "@/components/stocker-app";
import { useAuth } from "@/lib/auth-context";
import { userHasCompany } from "@/lib/complete-signup";

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

type View = "login" | "signup" | "dashboard" | "stocker";

function MercadoFacil() {
  const { session, loading, signOut } = useAuth();
  const [view, setView] = useState<View>("login");
  const [stockerReturn, setStockerReturn] = useState<View>("login");
  // null = ainda checando; só se aplica a quem entrou por login social (B1.3),
  // já que o cadastro por e-mail/senha cria a empresa no próprio fluxo (B1.2).
  const [needsSocialCompanySetup, setNeedsSocialCompanySetup] = useState<boolean | null>(null);

  const provider = session?.user.app_metadata["provider"];
  const isSocialUser = typeof provider === "string" && provider !== "email";

  // Sessão real (B1.1): quando ela existe (login ou recarregar a página com sessão salva),
  // a dashboard aparece sem precisar passar pela tela de login de novo.
  useEffect(() => {
    if (session && view === "login") setView("dashboard");
    if (!session && view === "dashboard") setView("login");
  }, [session, view]);

  // Login social (B1.3, RN-ACC-04): primeiro acesso de uma conta social ainda
  // não tem empresa nenhuma — falta CPF, nascimento e os dados da empresa,
  // que o Google/Facebook não fornecem.
  useEffect(() => {
    let active = true;
    if (!session || !isSocialUser) { setNeedsSocialCompanySetup(false); return; }
    setNeedsSocialCompanySetup(null);
    void userHasCompany(session.user.id).then((hasCompany) => {
      if (active) setNeedsSocialCompanySetup(!hasCompany);
    });
    return () => { active = false; };
  }, [session, isSocialUser]);

  const openStocker = (from: View) => { setStockerReturn(from); setView("stocker"); window.scrollTo({ top: 0 }); };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (view === "signup") return <SignupFlow onBack={() => setView("login")} onComplete={() => setView("dashboard")} />;
  if (view === "stocker") return <StockerApp onExit={() => setView(stockerReturn)} />;

  if (session && isSocialUser && needsSocialCompanySetup !== false) {
    if (needsSocialCompanySetup === null) {
      return (
        <div className="grid min-h-screen place-items-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    const socialMeta = session.user.user_metadata as Record<string, unknown>;
    const socialName = typeof socialMeta["full_name"] === "string" ? socialMeta["full_name"] : typeof socialMeta["name"] === "string" ? socialMeta["name"] : "";
    return (
      <SignupFlow
        socialUser={{ name: socialName, email: session.user.email ?? "" }}
        onBack={() => { void signOut(); setView("login"); }}
        onComplete={() => setNeedsSocialCompanySetup(false)}
      />
    );
  }

  return view === "dashboard" || session
    ? <OwnerDashboard onLogout={() => { void signOut(); setView("login"); }} onOpenStocker={() => openStocker("dashboard")} />
    : <Login onSignup={() => setView("signup")} onEmployee={() => openStocker("login")} />;
}

function Login({ onSignup, onEmployee }: { onSignup: () => void; onEmployee: () => void }) {
  const navigate = useNavigate();
  const { signIn, requestPasswordReset, signInWithProvider } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<"google" | "facebook" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSocialLogin(provider: "google" | "facebook") {
    setError("");
    setSocialSubmitting(provider);
    const result = await signInWithProvider(provider);
    if (!result.ok) {
      setSocialSubmitting(null);
      setError(result.message ?? "Não foi possível continuar com este provedor.");
    }
    // Em caso de sucesso o navegador é redirecionado; nada mais a fazer aqui.
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.ok) return;
    if (result.reason === "locked") {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      setError(`Muitas tentativas erradas. Tente novamente em ${minutes} minuto${minutes === 1 ? "" : "s"}.`);
      return;
    }
    setError(result.message);
  }

  async function handleForgotPassword() {
    setError("");
    if (!email.trim()) {
      setError("Informe seu e-mail para recuperar a senha.");
      return;
    }
    const result = await requestPasswordReset(email);
    setNotice(result.message);
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

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">E-mail</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">Senha</span>
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="h-12 w-full rounded-md border border-input bg-card px-4 pr-12 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
                <Button type="button" variant="ghost" className="absolute right-1 top-0 h-12 min-h-0 w-11 px-0" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <label className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
                <input type="checkbox" defaultChecked className="h-4 w-4 shrink-0 accent-primary" /> Lembrar acesso
              </label>
              <button type="button" onClick={() => void handleForgotPassword()} className="font-semibold text-primary hover:underline">Esqueci minha senha</button>
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">{notice}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">ou continue com</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" disabled={socialSubmitting !== null} onClick={() => void handleSocialLogin("google")}>
              {socialSubmitting === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="text-lg font-extrabold text-google">G</span> Continuar com Google</>}
            </Button>
            <Button variant="outline" disabled={socialSubmitting !== null} onClick={() => void handleSocialLogin("facebook")}>
              {socialSubmitting === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="grid h-5 w-5 place-items-center rounded-full bg-facebook text-xs font-extrabold text-social-foreground">f</span> Continuar com Facebook</>}
            </Button>
          </div>
          <p className="mt-7 text-center text-sm text-muted-foreground">Ainda não possui acesso? <button type="button" onClick={onSignup} className="font-bold text-primary hover:underline">Criar minha conta</button></p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-6 text-center">
            <button type="button" onClick={onEmployee} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Acesso do funcionário</button>
            <button type="button" onClick={() => void navigate({ to: "/admin" })} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Acesso administrativo</button>
          </div>
        </div>
      </section>
    </main>
  );
}
