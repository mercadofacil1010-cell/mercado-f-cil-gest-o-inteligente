import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Mercado Fácil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenha,
});

// Aberta a partir do link enviado por e-mail (B1.1). O Supabase já estabelece
// a sessão de recuperação a partir do link (detectSessionInUrl); aqui só falta
// pedir a nova senha e confirmar.
function RedefinirSenha() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("A senha precisa ter no mínimo 8 caracteres, com letra e número.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-[420px]">
        <BrandLogo className="mb-10" />
        {done ? (
          <div>
            <h2 className="text-2xl font-extrabold text-foreground">Senha atualizada</h2>
            <p className="mt-2 text-base text-muted-foreground">Sua senha foi redefinida com sucesso.</p>
            <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>Ir para o login <ArrowRight className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold text-foreground">Defina sua nova senha</h2>
            <p className="mt-2 text-base text-muted-foreground">Mínimo 8 caracteres, com letra e número.</p>
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-foreground">Nova senha</span>
                <div className="relative">
                  <input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="h-12 w-full rounded-md border border-input bg-card px-4 pr-12 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
                  <Button type="button" variant="ghost" className="absolute right-1 top-0 h-12 min-h-0 w-11 px-0" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-foreground">Confirme a nova senha</span>
                <input required type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" />
              </label>
              {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
