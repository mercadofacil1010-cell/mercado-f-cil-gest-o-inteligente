import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite, getInvitePreview, roleLabel, type InvitePreview } from "@/lib/invites-api";
import { savePendingInvite } from "@/lib/pending-invite";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [{ title: "Aceitar convite | Mercado Fácil" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: z.object({ token: z.string().optional() }),
  component: AceitarConvite,
});

// Tela de aceite de convite de equipe (B1.5, RF-ORG-05): aberta a partir do
// link enviado à pessoa convidada. Quem já tem conta só confirma; quem ainda
// não tem cria uma (o e-mail já vem fixado pelo convite).
function AceitarConvite() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { session, signIn, signOut } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) {
      setPreview(null);
      return;
    }
    void getInvitePreview(token).then((result) => {
      if (active) setPreview(result);
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setError("");
    setAccepting(true);
    const result = await acceptInvite(token);
    setAccepting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAccepted(true);
  }

  if (!token || preview === null) {
    return (
      <InviteShell>
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Convite não encontrado</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Verifique se o link está completo ou peça um novo convite.
        </p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Ir para o login
        </Button>
      </InviteShell>
    );
  }

  if (preview === undefined) {
    return (
      <InviteShell>
        <div className="grid place-items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </InviteShell>
    );
  }

  if (accepted) {
    return (
      <InviteShell>
        <ShieldCheck className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Convite aceito</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Você agora faz parte de {preview.companyName}.
        </p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Ir para o painel <ArrowRight className="h-4 w-4" />
        </Button>
      </InviteShell>
    );
  }

  if (preview.status === "accepted") {
    return (
      <InviteShell>
        <ShieldCheck className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Convite já aceito</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Este convite já foi usado. Faça login normalmente.
        </p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Ir para o login
        </Button>
      </InviteShell>
    );
  }

  if (preview.status === "revoked") {
    return (
      <InviteShell>
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Convite revogado</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Quem convidou cancelou este convite. Peça um novo, se ainda fizer sentido.
        </p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Ir para o login
        </Button>
      </InviteShell>
    );
  }

  if (new Date(preview.expiresAt) < new Date()) {
    return (
      <InviteShell>
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Convite expirado</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Peça para quem convidou reenviar o convite (DEC-B1-06: o prazo é de 7 dias).
        </p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Ir para o login
        </Button>
      </InviteShell>
    );
  }

  const sessionEmail = session?.user.email?.toLowerCase();
  const inviteSummary = (
    <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
      <p>
        <strong>{preview.email}</strong> foi convidado para <strong>{preview.companyName}</strong>{" "}
        como <strong>{roleLabel[preview.role]}</strong>.
      </p>
    </div>
  );

  if (session) {
    if (sessionEmail !== preview.email.toLowerCase()) {
      return (
        <InviteShell>
          <Mail className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-center text-2xl font-extrabold">Conta diferente</h1>
          {inviteSummary}
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Você está logado como {session.user.email}. Saia e entre com a conta convidada para
            aceitar.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => void signOut()}>
            Sair e entrar com outra conta
          </Button>
        </InviteShell>
      );
    }
    return (
      <InviteShell>
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-center text-2xl font-extrabold">Você foi convidado</h1>
        {inviteSummary}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button className="mt-6 w-full" disabled={accepting} onClick={() => void handleAccept()}>
          {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar convite"}
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <Mail className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 text-center text-2xl font-extrabold">Você foi convidado</h1>
      {inviteSummary}
      <InviteAuthForms token={token} email={preview.email} onAccepted={() => setAccepted(true)} />
    </InviteShell>
  );
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-[440px]">
        <BrandLogo className="mx-auto mb-10" />
        {children}
      </div>
    </main>
  );
}

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres, com letra e número.")
  .regex(/[a-zA-Z]/)
  .regex(/[0-9]/);

// Quem já tem conta só confirma a senha; quem não tem cria uma agora (o
// e-mail vem fixo do convite, não é editável).
function InviteAuthForms({
  token,
  email,
  onAccepted,
}: {
  token: string;
  email: string;
  onAccepted: () => void;
}) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    if (!result.ok) {
      setSubmitting(false);
      setError(
        result.reason === "locked"
          ? "Muitas tentativas erradas. Tente novamente mais tarde."
          : result.message,
      );
      return;
    }
    const acceptResult = await acceptInvite(token);
    setSubmitting(false);
    if (!acceptResult.ok) {
      setError(acceptResult.message);
      return;
    }
    onAccepted();
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    const passwordCheck = passwordSchema.safeParse(password);
    if (!passwordCheck.success) {
      setError("A senha precisa ter no mínimo 8 caracteres, com letra e número.");
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (signUpError) {
      setSubmitting(false);
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? 'Este e-mail já tem uma conta. Use a opção "Já tenho conta".'
          : "Não foi possível criar sua conta agora. Tente novamente.",
      );
      return;
    }

    if (data.session) {
      const acceptResult = await acceptInvite(token);
      setSubmitting(false);
      if (!acceptResult.ok) {
        setError(acceptResult.message);
        return;
      }
      onAccepted();
      return;
    }

    savePendingInvite(token);
    setSubmitting(false);
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar e fazer
          login, o convite é aceito automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-md bg-muted p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`h-9 rounded-sm ${mode === "login" ? "bg-card shadow-card" : "text-muted-foreground"}`}
        >
          Já tenho conta
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`h-9 rounded-sm ${mode === "signup" ? "bg-card shadow-card" : "text-muted-foreground"}`}
        >
          Criar conta
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={(event) => void handleLogin(event)} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">E-mail</span>
            <input
              value={email}
              disabled
              className="h-11 w-full rounded-md border border-input bg-muted px-3.5 text-base text-muted-foreground"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Senha</span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 pr-11 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                variant="ghost"
                className="absolute right-1 top-0 h-11 min-h-0 w-10 px-0"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar e aceitar convite"}
          </Button>
        </form>
      ) : (
        <form onSubmit={(event) => void handleSignup(event)} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Nome</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">E-mail</span>
            <input
              value={email}
              disabled
              className="h-11 w-full rounded-md border border-input bg-muted px-3.5 text-base text-muted-foreground"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Crie uma senha</span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 pr-11 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                variant="ghost"
                className="absolute right-1 top-0 h-11 min-h-0 w-10 px-0"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">
              Mínimo 8 caracteres, com letra e número.
            </span>
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
              "Criar conta e aceitar convite"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
