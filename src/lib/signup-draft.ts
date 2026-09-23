// Rascunho do cadastro (RF-ACC-07, DEC-B1-05): salvo só no aparelho do usuário
// (localStorage), válido por 7 dias. Depois disso o rascunho é descartado.
const STORAGE_KEY = "mercadofacil_signup_draft_v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SignupDraft<T> = {
  data: T;
  savedAt: string;
  // Preenchido quando a conta já foi criada no Supabase mas ainda falta criar a
  // empresa (aguardando confirmação de e-mail antes de haver sessão).
  pendingCompanyForEmail?: string;
};

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function saveSignupDraft<T>(data: T, pendingCompanyForEmail?: string) {
  if (!hasStorage()) return;
  try {
    const draft: SignupDraft<T> = { data, savedAt: new Date().toISOString(), ...(pendingCompanyForEmail ? { pendingCompanyForEmail } : {}) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia etc.) — segue sem salvar.
  }
}

export function loadSignupDraft<T>(): SignupDraft<T> | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SignupDraft<T>;
    const savedAt = new Date(draft.savedAt).getTime();
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearSignupDraft() {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a fazer se o armazenamento não estiver disponível.
  }
}
