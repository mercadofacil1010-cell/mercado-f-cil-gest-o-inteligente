// Sessão real de autenticação (B1.1): login, logout, sessão persistente,
// recuperação de senha e bloqueio temporário por tentativas erradas (DEC-B1-01).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { loadSignupDraft, clearSignupDraft } from "@/lib/signup-draft";
import { completeCompanySignup, userHasCompany, type CompanySignupData } from "@/lib/complete-signup";

type AuditRpc = "log_security_event" | "register_login_attempt";

type LoginResult =
  | { ok: true }
  | { ok: false; reason: "locked"; retryAfterSeconds: number }
  | { ok: false; reason: "invalid_credentials" | "email_not_confirmed" | "unknown"; message: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>;
  // Aviso de uma vez só sobre a empresa que acabou de ser criada ao retomar o
  // cadastro após a confirmação do e-mail (RF-ACC-07). A tela que exibir o
  // aviso deve chamar de volta para limpar.
  pendingSignupNotice: string | null;
  clearPendingSignupNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// As chamadas de auditoria não podem travar a ação principal (login, logout,
// recuperação de senha) se falharem — mas PRECISAM ser de fato enviadas.
// Importante: no supabase-js, o "builder" retornado por .rpc(...) só dispara
// a requisição quando é aguardado (await/.then); `void supabase.rpc(...)`
// não envia nada. Por isso este auxiliar sempre aguarda, só engolindo o erro.
async function logAuthEvent<T extends AuditRpc>(name: T, args: Database["public"]["Functions"][T]["Args"]) {
  try {
    await supabase.rpc(name, args);
  } catch {
    // Não bloqueia login/logout/recuperação por falha no registro de auditoria.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSignupNotice, setPendingSignupNotice] = useState<string | null>(null);

  // Retoma o cadastro (RF-ACC-07) quando o usuário confirma o e-mail e loga
  // depois: se havia um rascunho de empresa esperando por esta conta e ela
  // ainda não tem empresa nenhuma, cria a empresa agora.
  async function resumePendingSignup(nextSession: Session) {
    const email = nextSession.user.email;
    if (!email) return;
    const draft = loadSignupDraft<CompanySignupData>();
    if (!draft?.pendingCompanyForEmail || draft.pendingCompanyForEmail.toLowerCase() !== email.toLowerCase()) return;
    if (await userHasCompany(nextSession.user.id)) {
      clearSignupDraft();
      return;
    }
    const result = await completeCompanySignup(draft.data);
    if (result.ok) {
      clearSignupDraft();
      setPendingSignupNotice(`Sua empresa "${draft.data.tradeName}" foi criada com sucesso.`);
    }
    // Se falhar, o rascunho continua salvo (até os 7 dias) para tentar de novo no próximo login.
  }

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) void resumePendingSignup(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "SIGNED_IN" && nextSession) void resumePendingSignup(nextSession);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,

    async signIn(email, password) {
      const normalizedEmail = email.trim();

      // O bloqueio é decidido pelo banco (DEC-B1-01): consulta antes de tentar.
      const { data: lockData, error: lockError } = await supabase.rpc("check_login_lock", {
        p_email: normalizedEmail,
      });
      if (!lockError && lockData && typeof lockData === "object" && "locked" in lockData && lockData["locked"]) {
        const retryAfterSecondsValue = lockData["retry_after_seconds"];
        const retryAfterSeconds = typeof retryAfterSecondsValue === "number" ? retryAfterSecondsValue : 900;
        await logAuthEvent("log_security_event", { p_entity: "auth_login_locked", p_details: { email: normalizedEmail } });
        return { ok: false, reason: "locked", retryAfterSeconds };
      }

      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      // Registra o resultado para o bloqueio e a auditoria (AUD-01). Aguardado de
      // propósito: sem await, o supabase-js nem chega a enviar a requisição.
      await logAuthEvent("register_login_attempt", { p_email: normalizedEmail, p_success: !error });

      if (error) {
        await logAuthEvent("log_security_event", { p_entity: "auth_login_failed", p_details: { email: normalizedEmail } });
        if (error.message.toLowerCase().includes("email not confirmed")) {
          return { ok: false, reason: "email_not_confirmed", message: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
        }
        return { ok: false, reason: "invalid_credentials", message: "E-mail ou senha incorretos." };
      }
      await logAuthEvent("log_security_event", { p_entity: "auth_login_success" });
      return { ok: true };
    },

    async signOut() {
      await logAuthEvent("log_security_event", { p_entity: "auth_logout" });
      await supabase.auth.signOut();
    },

    async requestPasswordReset(email) {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
      await logAuthEvent("log_security_event", { p_entity: "auth_password_reset_requested", p_details: { email: email.trim() } });
      if (error) {
        return { ok: false, message: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." };
      }
      return { ok: true, message: "Se o e-mail existir, enviamos um link para redefinir a senha." };
    },

    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, message: error.message };
      }
      await logAuthEvent("log_security_event", { p_entity: "auth_password_updated" });
      return { ok: true, message: "Senha atualizada." };
    },

    pendingSignupNotice,
    clearPendingSignupNotice() {
      setPendingSignupNotice(null);
    },
  }), [session, loading, pendingSignupNotice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto, não é um componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
