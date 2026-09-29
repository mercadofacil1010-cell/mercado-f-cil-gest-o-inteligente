// Central de Inconsistências (B6.1, RF-INC-*/RN-INC-*) — substitui a tela
// de demonstração (dados fake em src/data/market-operations.ts) por leitura
// e gravação de verdade. Ocorrência nasce sozinha a partir de recebimento,
// reposição, inventário e validade (DECISOES.md); aqui só reconhece,
// investiga, atribui responsável/prazo, encerra (com justificativa) ou
// reabre — nunca mexe no estoque diretamente (RN-INC-02).
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertPill, ChartCard, type Tone } from "@/components/dashboard-ui";
import { listTeamMembers, type TeamMember } from "@/lib/invites-api";
import {
  acknowledgeIncident,
  assignIncident,
  incidentSeverityLabel,
  incidentSourceLabel,
  incidentStatusLabel,
  listIncidents,
  reopenIncident,
  resolveIncident,
  startIncidentInvestigation,
  syncExpiryIncidents,
  type Incident,
  type IncidentResolution,
} from "@/lib/incidents-api";

const severityTone: Record<Incident["severity"], Tone> = {
  baixa: "neutral",
  media: "warning",
  alta: "critical",
};

const statusTone: Record<Incident["status"], Tone> = {
  aberta: "critical",
  reconhecida: "warning",
  em_investigacao: "warning",
  encerrada: "positive",
};

export function IncidentsModule({
  companyId,
  marketId,
  notify,
}: {
  companyId: string | null;
  marketId: string;
  notify: (message: string) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveType, setResolveType] = useState<IncidentResolution>("corrigida");
  const [resolveNote, setResolveNote] = useState("");
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [reopenNote, setReopenNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [incidentList, memberList] = await Promise.all([
      listIncidents(marketId),
      companyId ? listTeamMembers(companyId) : Promise.resolve([]),
    ]);
    setIncidents(incidentList);
    setMembers(memberList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [marketId, companyId]);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncExpiryIncidents(marketId);
    setSyncing(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(
      result.created > 0
        ? `${result.created} nova(s) ocorrência(s) de validade encontrada(s).`
        : "Nenhum lote vencido novo com saldo.",
    );
    void reload();
  };

  const handleAcknowledge = async (id: string) => {
    setBusyId(id);
    const result = await acknowledgeIncident(id);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    void reload();
  };

  const handleInvestigate = async (id: string) => {
    setBusyId(id);
    const result = await startIncidentInvestigation(id);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    void reload();
  };

  const handleAssign = async (id: string) => {
    const userId = assignDrafts[id];
    if (!userId) {
      notify("Escolha um responsável.");
      return;
    }
    setBusyId(id);
    const result = await assignIncident(id, userId);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify("Responsável atribuído.");
    void reload();
  };

  const handleResolve = async (id: string) => {
    if (!resolveNote.trim()) {
      notify("Informe a justificativa para encerrar.");
      return;
    }
    setBusyId(id);
    const result = await resolveIncident(id, resolveType, resolveNote);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setResolvingId(null);
    setResolveNote("");
    notify("Inconsistência encerrada.");
    void reload();
  };

  const handleReopen = async (id: string) => {
    if (!reopenNote.trim()) {
      notify("Informe o motivo da reabertura.");
      return;
    }
    setBusyId(id);
    const result = await reopenIncident(id, reopenNote);
    setBusyId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setReopeningId(null);
    setReopenNote("");
    notify("Inconsistência reaberta.");
    void reload();
  };

  return (
    <ChartCard
      title="Central de inconsistências"
      subtitle="Ocorrências automáticas de recebimento, reposição, inventário e validade — nunca some sozinha, sempre reconhecida, investigada e encerrada com justificativa."
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleSync()} disabled={syncing}>
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" /> Sincronizar validade
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="grid place-items-center p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma inconsistência registrada.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{incidentSourceLabel[incident.source]}</strong>
                    {incident.productName && (
                      <span className="text-sm text-muted-foreground">
                        · {incident.productName}
                      </span>
                    )}
                    {incident.warehouseAddressCode && (
                      <span className="text-sm text-muted-foreground">
                        · {incident.warehouseAddressCode}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{incident.description}</p>
                  {(incident.expectedQuantity !== null || incident.countedQuantity !== null) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Esperado {incident.expectedQuantity ?? "—"} · Contado{" "}
                      {incident.countedQuantity ?? "—"} · Diferença {incident.difference ?? "—"}
                    </p>
                  )}
                  {incident.resolution && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {incident.resolution === "corrigida" ? "Corrigida" : "Descartada"}:{" "}
                      {incident.resolutionNote}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <AlertPill
                    label={incidentStatusLabel[incident.status]}
                    tone={statusTone[incident.status]}
                  />
                  <AlertPill
                    label={incidentSeverityLabel[incident.severity]}
                    tone={severityTone[incident.severity]}
                  />
                  {incident.isRecurring && <AlertPill label="Recorrente" tone="warning" />}
                </div>
              </div>

              {incident.status !== "encerrada" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {incident.status === "aberta" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === incident.id}
                      onClick={() => void handleAcknowledge(incident.id)}
                    >
                      Reconhecer
                    </Button>
                  )}
                  {(incident.status === "aberta" || incident.status === "reconhecida") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === incident.id}
                      onClick={() => void handleInvestigate(incident.id)}
                    >
                      Investigar
                    </Button>
                  )}
                  <Select
                    value={assignDrafts[incident.id] ?? ""}
                    onValueChange={(value) =>
                      setAssignDrafts((drafts) => ({ ...drafts, [incident.id]: value }))
                    }
                  >
                    <SelectTrigger className="h-9 w-[180px] bg-card">
                      <SelectValue placeholder="Atribuir a..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === incident.id}
                    onClick={() => void handleAssign(incident.id)}
                  >
                    Atribuir
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === incident.id}
                    onClick={() => {
                      setResolvingId(incident.id);
                      setResolveType("corrigida");
                      setResolveNote("");
                    }}
                  >
                    Encerrar
                  </Button>
                </div>
              )}

              {resolvingId === incident.id && (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <Select
                    value={resolveType}
                    onValueChange={(value) => setResolveType(value as IncidentResolution)}
                  >
                    <SelectTrigger className="h-9 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrigida">Corrigida</SelectItem>
                      <SelectItem value="descartada">Descartada</SelectItem>
                    </SelectContent>
                  </Select>
                  <textarea
                    value={resolveNote}
                    onChange={(event) => setResolveNote(event.target.value)}
                    placeholder="Justificativa (obrigatória)"
                    className="min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === incident.id}
                      onClick={() => void handleResolve(incident.id)}
                    >
                      Confirmar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResolvingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {incident.status === "encerrada" &&
                (reopeningId === incident.id ? (
                  <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                    <textarea
                      value={reopenNote}
                      onChange={(event) => setReopenNote(event.target.value)}
                      placeholder="Motivo da reabertura"
                      className="min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === incident.id}
                        onClick={() => void handleReopen(incident.id)}
                      >
                        Confirmar reabertura
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setReopeningId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => setReopeningId(incident.id)}
                  >
                    Reabrir
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
