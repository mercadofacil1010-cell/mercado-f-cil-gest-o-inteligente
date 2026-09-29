// Sincronização das ações guardadas offline (B5.5, PA-39/PA-40). Quando o
// celular volta a ficar online, cada ação da fila é reaplicada chamando a
// mesma função de sempre (nenhum caminho novo de escrita). Se o servidor
// recusar por um motivo de negócio (não por falta de rede), a ação NUNCA
// sobrescreve silenciosamente — vira uma pendência de conciliação visível
// para dono/gerente (`record_sync_conflict`, mesmo padrão de fila de
// pending_stock_adjustments do B3.4).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enqueueOutbox, listOutbox, removeFromOutbox, type OutboxItem } from "@/lib/offline-db";
import {
  registerReplenishmentWithdrawal,
  registerReplenishmentReturn,
  registerReplenishmentImpediment,
} from "@/lib/replenishment-api";
import { addReceivingCount } from "@/lib/receiving-conference-api";

export type ReplenishmentWithdrawalPayload = {
  taskId: string;
  quantity: number;
  sourceWarehouseAddressId: string;
};
export type ReplenishmentReturnPayload = {
  taskId: string;
  quantityReturned: number;
  returnWarehouseAddressId?: string;
};
export type ReplenishmentImpedimentPayload = {
  taskId: string;
  reason: string;
  photoPath?: string | null;
};
export type ReceivingCountPayload = {
  receivingId: string;
  productId: string;
  packagingId: string;
  quantity: number;
  options?: Parameters<typeof addReceivingCount>[4];
};

type QueueableAction =
  | { actionType: "replenishment_withdrawal"; payload: ReplenishmentWithdrawalPayload }
  | { actionType: "replenishment_return"; payload: ReplenishmentReturnPayload }
  | { actionType: "replenishment_impediment"; payload: ReplenishmentImpedimentPayload }
  | { actionType: "receiving_count"; payload: ReceivingCountPayload };

/** Detecta falha de rede (offline de verdade) vs. recusa de negócio do servidor. */
function isNetworkFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    !navigator.onLine ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  );
}

/**
 * Tenta executar a ação agora; se falhar por falta de rede, guarda na fila
 * local para tentar de novo quando reconectar. Retorna o resultado real
 * quando dá para executar (online) ou `{ ok: true, queued: true }` quando
 * ficou só guardada para sincronizar depois.
 */
export async function runOrQueue(
  kind: "repositor" | "conferente",
  marketId: string,
  action: QueueableAction,
  run: () => Promise<{ ok: true } | { ok: false; message: string }>,
): Promise<{ ok: true; queued?: boolean } | { ok: false; message: string }> {
  const result = await run();
  if (result.ok) return result;
  if (!isNetworkFailure(result.message)) return result;

  await enqueueOutbox({ kind, marketId, actionType: action.actionType, payload: action.payload });
  return { ok: true, queued: true };
}

async function replay(item: OutboxItem): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (item.actionType) {
    case "replenishment_withdrawal": {
      const p = item.payload as ReplenishmentWithdrawalPayload;
      return registerReplenishmentWithdrawal(p.taskId, p.quantity, p.sourceWarehouseAddressId);
    }
    case "replenishment_return": {
      const p = item.payload as ReplenishmentReturnPayload;
      return registerReplenishmentReturn(p.taskId, p.quantityReturned, p.returnWarehouseAddressId);
    }
    case "replenishment_impediment": {
      const p = item.payload as ReplenishmentImpedimentPayload;
      return registerReplenishmentImpediment(p.taskId, p.reason, p.photoPath);
    }
    case "receiving_count": {
      const p = item.payload as ReceivingCountPayload;
      return addReceivingCount(p.receivingId, p.productId, p.packagingId, p.quantity, p.options);
    }
    default:
      return { ok: false, message: `Ação desconhecida: ${item.actionType}` };
  }
}

let flushing = false;

/**
 * Reaplica a fila em ordem. Para na primeira falha de rede (ainda offline,
 * tenta de novo depois); uma recusa de negócio vira pendência de
 * conciliação e a fila continua para os próximos itens.
 */
export async function flushOutbox(): Promise<{ synced: number; conflicts: number }> {
  if (flushing) return { synced: 0, conflicts: 0 };
  flushing = true;
  let synced = 0;
  let conflicts = 0;
  try {
    const queue = await listOutbox();
    for (const item of queue.sort((a, b) => a.id - b.id)) {
      const result = await replay(item);
      if (result.ok) {
        await removeFromOutbox(item.id);
        synced += 1;
        continue;
      }
      if (isNetworkFailure(result.message)) {
        break;
      }
      await supabase.rpc("record_sync_conflict", {
        p_market_id: item.marketId,
        p_action_type: item.actionType,
        p_payload: JSON.parse(JSON.stringify(item.payload)),
        p_error_message: result.message,
      });
      await removeFromOutbox(item.id);
      conflicts += 1;
    }
  } finally {
    flushing = false;
  }
  return { synced, conflicts };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flushOutbox();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

/** Quantas ações ainda estão na fila local esperando para sincronizar. */
export function usePendingSyncCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listOutbox().then((queue) => {
        if (active) setCount(queue.length);
      });
    };
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  return count;
}
