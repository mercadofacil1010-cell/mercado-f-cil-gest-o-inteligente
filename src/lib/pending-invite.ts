// Convite pendente de aceite (B1.5): quando quem foi convidado ainda não tem
// conta, o cadastro pede confirmação de e-mail antes de existir sessão (mesmo
// padrão do rascunho de cadastro em signup-draft.ts). O token fica guardado
// aqui até a confirmação, para aceitar o convite assim que a sessão existir.
const STORAGE_KEY = "mercadofacil_pending_invite_v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PendingInvite = { token: string; savedAt: string };

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function savePendingInvite(token: string) {
  if (!hasStorage()) return;
  try {
    const entry: PendingInvite = { token, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Armazenamento indisponível — segue sem salvar.
  }
}

export function loadPendingInvite(): string | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PendingInvite;
    const savedAt = new Date(entry.savedAt).getTime();
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry.token;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a fazer se o armazenamento não estiver disponível.
  }
}
