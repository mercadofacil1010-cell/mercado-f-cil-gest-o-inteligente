import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AdminPanel } from "@/components/admin-panel";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/admin-api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração da Plataforma | Mercado Fácil" },
      {
        name: "description",
        content: "Área exclusiva do proprietário da plataforma Mercado Fácil.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

// Acesso administrativo (B1.7, RF-ACC-06): separado do login de cliente — a
// mesma conta do Supabase Auth só entra aqui se estiver em platform_admins
// (RN-ACL-07/G-08: essa tabela só é alterada direto no painel do Supabase,
// nunca por uma tela do site, para não abrir uma porta de escalação de privilégio).
function AdminRoute() {
  const navigate = useNavigate();
  const { session, loading, signIn, signOut } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!session) {
      setCheckingAdmin(false);
      setIsAdmin(false);
      return;
    }
    setCheckingAdmin(true);
    void isPlatformAdmin(session.user.id).then((result) => {
      if (!active) return;
      setIsAdmin(result);
      setCheckingAdmin(false);
    });
    return () => {
      active = false;
    };
  }, [session, loading]);

  if (loading || checkingAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <AdminLogin onLoggedIn={() => setCheckingAdmin(true)} signIn={signIn} />;
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-8" />
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-extrabold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Esta conta não tem acesso à administração da plataforma.
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

  return <AdminPanel onExit={() => void navigate({ to: "/" })} />;
}

type SignIn = ReturnType<typeof useAuth>["signIn"];

function AdminLogin({ onLoggedIn, signIn }: { onLoggedIn: () => void; signIn: SignIn }) {
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
        <h1 className="text-2xl font-extrabold text-foreground">Acesso administrativo</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Área exclusiva da equipe do Mercado Fácil. Se você é dono de um mercado, use o
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="ml-1 font-semibold text-primary hover:underline"
          >
            login de cliente
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
