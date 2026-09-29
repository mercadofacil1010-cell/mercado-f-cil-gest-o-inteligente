// Camada de armazenamento local para funcionamento sem internet (B5.5,
// PA-39): guarda os últimos dados baixados (para continuar vendo tarefas e
// itens já contados sem rede) e uma fila de ações pendentes de sincronizar.
// IndexedDB puro (sem lib externa) — cada navegador guarda sua própria
// cópia, nunca sincronizada entre dispositivos por aqui.
const DB_NAME = "mercado-facil-offline";
const DB_VERSION = 1;
export const CACHE_STORE = "cache";
export const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** true quando IndexedDB não está disponível (SSR, navegador antigo) — tudo vira no-op. */
function unsupported(): boolean {
  return typeof indexedDB === "undefined";
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (unsupported()) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const request = tx.objectStore(CACHE_STORE).get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  if (unsupported()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // sem IndexedDB disponível — segue sem cache local
  }
}

export type OutboxItem<T = unknown> = {
  id: number;
  kind: "repositor" | "conferente";
  actionType: string;
  marketId: string;
  payload: T;
  createdAt: string;
};

export async function enqueueOutbox(
  item: Omit<OutboxItem, "id" | "createdAt">,
): Promise<number | null> {
  if (unsupported()) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      const request = tx.objectStore(OUTBOX_STORE).add({
        ...item,
        createdAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function listOutbox(): Promise<OutboxItem[]> {
  if (unsupported()) return [];
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const request = tx.objectStore(OUTBOX_STORE).getAll();
      request.onsuccess = () => resolve((request.result as OutboxItem[]) ?? []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeFromOutbox(id: number): Promise<void> {
  if (unsupported()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // sem IndexedDB — nada para remover
  }
}
