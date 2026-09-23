// Sessão real de autenticação (B1.1): login, logout, sessão persistente,
// recuperação de senha e bloqueio temporário por tentativas erradas (DEC-B1-01).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
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
        void supabase.rpc("log_security_event", { p_entity: "auth_login_locked", p_details: { email: normalizedEmail } });
        return { ok: false, reason: "locked", retryAfterSeconds };
      }

      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      // Registra o resultado para o bloqueio e a auditoria (AUD-01), sem travar
      // o retorno se essas chamadas falharem.
      void supabase.rpc("register_login_attempt", { p_email: normalizedEmail, p_success: !error });

      if (error) {
        void supabase.rpc("log_security_event", { p_entity: "auth_login_failed", p_details: { email: normalizedEmail } });
        if (error.message.toLowerCase().includes("email not confirmed")) {
          return { ok: false, reason: "email_not_confirmed", message: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
        }
        return { ok: false, reason: "invalid_credentials", message: "E-mail ou senha incorretos." };
      }
      void supabase.rpc("log_security_event", { p_entity: "auth_login_success" });
      return { ok: true };
    },

    async signOut() {
      await supabase.rpc("log_security_event", { p_entity: "auth_logout" });
      await supabase.auth.signOut();
    },

    async requestPasswordReset(email) {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
      void supabase.rpc("log_security_event", { p_entity: "auth_password_reset_requested", p_details: { email: email.trim() } });
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
      void supabase.rpc("log_security_event", { p_entity: "auth_password_updated" });
      return { ok: true, message: "Senha atualizada." };
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto, não é um componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
