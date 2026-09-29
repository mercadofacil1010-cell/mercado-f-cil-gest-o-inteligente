// Indicador de conexão + fila de sincronização (B5.5) — usado em /repositor
// e /conferente, os dois apps que continuam funcionando sem internet.
import { WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStatus, usePendingSyncCount } from "@/lib/offline-sync";

export function OfflineStatusBadge() {
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();

  if (online && pending === 0) return null;

  return (
    <div
      className={
        online
          ? "flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"
          : "flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
      }
    >
      {online ? <RefreshCw className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online
        ? `Sincronizando ${pending} ação${pending === 1 ? "" : "ões"}...`
        : pending > 0
          ? `Offline · ${pending} ação${pending === 1 ? "" : "ões"} guardada${pending === 1 ? "" : "s"}`
          : "Você está offline"}
    </div>
  );
}
