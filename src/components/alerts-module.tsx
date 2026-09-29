// Motor de alertas (B6.2, RF-EST-06/RF-INC-06/RN-DSH-05) — feed único
// reunindo inconsistência aberta (B6.1), saldo negativo e gôndola no
// mínimo sem tarefa ativa. Nunca desaparece sozinho: só sincronizar
// (resolve o que já não é mais verdade) ou descartar manualmente mudam o
// estado — abrir esta tela não resolve nada.
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPill, ChartCard, type Tone } from "@/components/dashboard-ui";
import { alertTypeLabel, discardAlert, listAlerts, syncAlerts, type Alert } from "@/lib/alerts-api";

const statusTone: Record<Alert["status"], Tone> = {
  aberto: "critical",
  resolvido: "positive",
  descartado: "neutral",
};

const statusLabel: Record<Alert["status"], string> = {
  aberto: "Aberto",
  resolvido: "Resolvido",
  descartado: "Descartado",
};

export function AlertsModule({
  marketId,
  notify,
}: {
  marketId: string;
  notify: (message: string) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [discardNote, setDiscardNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setAlerts(await listAlerts(marketId));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [marketId]);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncAlerts(marketId);
    setSyncing(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(
      result.created > 0
        ? `${result.created} novo(s) alerta(s) encontrado(s).`
        : "Nenhum alerta novo — o que já não é mais verdade foi resolvido sozinho.",
    );
    void reload();
  };

  const handleDiscard = async (id: string) => {
    setBusyId(id);
    const result = await discardAlert(id, discardNote || undefined);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setDiscardingId(null);
    setDiscardNote("");
    notify("Alerta descartado.");
    void reload();
  };

  const openAlerts = alerts.filter((alert) => alert.status === "aberto");
  const otherAlerts = alerts.filter((alert) => alert.status !== "aberto");

  return (
    <ChartCard
      title="Alertas"
      subtitle="Sinais que precisam de atenção — inconsistência aberta, saldo negativo e gôndola no mínimo sem tarefa ativa. Um alerta nunca some sozinho por abrir esta tela."
      action={
        <Button size="sm" variant="outline" onClick={() => void handleSync()} disabled={syncing}>
          <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Sincronizar
        </Button>
      }
    >
      {loading ? (
        <div className="grid place-items-center p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum alerta ainda — clique em "Sincronizar" para verificar.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {openAlerts.length > 0 && (
            <ul className="space-y-3">
              {openAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-md border border-critical/40 bg-critical/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{alertTypeLabel[alert.alertType]}</strong>
                        {alert.productName && (
                          <span className="text-sm text-muted-foreground">
                            · {alert.productName}
                          </span>
                        )}
                        {alert.warehouseAddressCode && (
                          <span className="text-sm text-muted-foreground">
                            · {alert.warehouseAddressCode}
                          </span>
                        )}
                        {alert.gondolaPositionCode && (
                          <span className="text-sm text-muted-foreground">
                            · {alert.gondolaPositionCode}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                    <AlertPill label={statusLabel[alert.status]} tone={statusTone[alert.status]} />
                  </div>

                  {discardingId === alert.id ? (
                    <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                      <textarea
                        value={discardNote}
                        onChange={(event) => setDiscardNote(event.target.value)}
                        placeholder="Observação (opcional)"
                        className="min-h-[50px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === alert.id}
                          onClick={() => void handleDiscard(alert.id)}
                        >
                          Confirmar descarte
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDiscardingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDiscardingId(alert.id);
                        setDiscardNote("");
                      }}
                    >
                      Descartar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {otherAlerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolvidos e descartados
              </p>
              <ul className="mt-2 space-y-2">
                {otherAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground"
                  >
                    <span>
                      {alertTypeLabel[alert.alertType]}
                      {alert.productName && ` · ${alert.productName}`}
                      {alert.discardNote && ` · ${alert.discardNote}`}
                    </span>
                    <AlertPill label={statusLabel[alert.status]} tone={statusTone[alert.status]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
