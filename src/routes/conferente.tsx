import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, PackageSearch, ShieldAlert, Truck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AlertPill } from "@/components/dashboard-ui";
import { useAuth } from "@/lib/auth-context";
import { getConferenteContext, type ConferenteContext } from "@/lib/conferente-api";
import { listReceivings, receivingStatusLabel, type Receiving } from "@/lib/receivings-api";

export const Route = createFileRoute("/conferente")({
  head: () => ({
    meta: [{ title: "App do Conferente | Mercado Fácil" }, { name: "robots", content: "noindex" }],
  }),
  component: ConferenteRoute,
});

// Experiência própria do conferente (Correção 1/DEC-B4-01): rota separada do
// painel do dono, não uma aba dentro dele. O acabamento visual completo de
// app mobile (menu inferior, Correção 2) fica para um refinamento
// posterior — aqui já nasce a separação de acesso e de dados corretamente.
function ConferenteRoute() {
  const navigate = useNavigate();
  const { session, loading, signIn, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [context, setContext] = useState<ConferenteContext>(null);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!session) {
      setChecking(false);
      setContext(null);
      return;
    }
    setChecking(true);
    void getConferenteContext(session.user.id).then((result) => {
      if (!active) return;
      setContext(result);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [session, loading]);

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <ConferenteLogin onLoggedIn={() => setChecking(true)} signIn={signIn} />;
  }

  if (!context) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-8" />
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-extrabold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Esta conta não está cadastrada como conferente em nenhum mercado.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => void signOut()}>
              Sair e entrar com outra conta
            </Button>
            <Button onClick={() => void navigate({ to: "/" })}>Ir para o login de cliente</Button>
          </div>
        </div>
      </div>
    );
  }

  return <ConferenteHome markets={context.markets} onSignOut={() => void signOut()} />;
}

type SignIn = ReturnType<typeof useAuth>["signIn"];

function ConferenteLogin({ onLoggedIn, signIn }: { onLoggedIn: () => void; signIn: SignIn }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      if (result.reason === "locked") {
        const minutes = Math.ceil(result.retryAfterSeconds / 60);
        setError(
          `Muitas tentativas erradas. Tente novamente em ${minutes} minuto${minutes === 1 ? "" : "s"}.`,
        );
        return;
      }
      setError(result.message);
      return;
    }
    onLoggedIn();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px]">
        <BrandLogo className="mb-8" />
        <h1 className="text-2xl font-extrabold text-foreground">App do Conferente</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Login de quem recebe mercadoria. Se você é dono ou gerente, use o
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="ml-1 font-semibold text-primary hover:underline"
          >
            painel do dono
          </button>
          .
        </p>
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">E-mail</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">Senha</span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="h-12 w-full rounded-md border border-input bg-card px-4 pr-12 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
              <Button
                type="button"
                variant="ghost"
                className="absolute right-1 top-0 h-12 min-h-0 w-11 px-0"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Entrar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}

function ConferenteHome({
  markets,
  onSignOut,
}: {
  markets: { id: string; name: string }[];
  onSignOut: () => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.id ?? "");
  const [receivings, setReceivings] = useState<Receiving[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedMarket) {
      setReceivings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void listReceivings(selectedMarket).then((list) => {
      setReceivings(list);
      setLoading(false);
    });
  }, [selectedMarket]);

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-5 bg-background p-5">
      <div className="flex items-center justify-between">
        <BrandLogo />
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sair
        </Button>
      </div>
      <h1 className="text-xl font-extrabold">Recebimentos</h1>

      {markets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não está vinculado a nenhum mercado.
        </p>
      ) : (
        <>
          {markets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {markets.map((market) => (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => setSelectedMarket(market.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                    selectedMarket === market.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {market.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : receivings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum recebimento cadastrado neste mercado ainda.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {receivings.map((receiving) => (
                <li
                  key={receiving.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate">
                        {receiving.supplierName || "Fornecedor não informado"}
                      </strong>
                      <span className="block text-sm text-muted-foreground">
                        {receiving.invoiceNumber
                          ? `NF ${receiving.invoiceNumber}`
                          : "Sem nota fiscal"}
                      </span>
                    </div>
                    <AlertPill label={receivingStatusLabel[receiving.status]} tone="neutral" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-muted p-2.5 text-sm text-muted-foreground">
                    <PackageSearch className="h-4 w-4 shrink-0" />
                    Conferência cega chega numa próxima etapa.
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
