import { useEffect, useState } from "react";
import { Clock3, LayoutGrid, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertPill, ChartCard, type Tone } from "@/components/dashboard-ui";
import type { Market } from "@/data/markets";
import { listGondolaPositions, type GondolaPosition } from "@/lib/locations-api";
import { listTeamMembers, type TeamMember } from "@/lib/invites-api";
import {
  assignReplenishmentTask,
  listReplenishmentTasks,
  recordGondolaBalance,
  replenishmentTaskStatusLabel,
  resolveReplenishmentInconsistency,
  type ReplenishmentTask,
  type ReplenishmentTaskStatus,
} from "@/lib/replenishment-api";

const statusTone: Record<ReplenishmentTaskStatus, Tone> = {
  pendente: "neutral",
  aceita: "neutral",
  em_transito: "warning",
  com_inconsistencia: "critical",
  concluida: "positive",
};

// Tarefas de reposição de verdade (B5.1/B5.2): nascem quando alguém registra
// o saldo de uma posição de gôndola e ele está no mínimo ou menos — sem PDV
// ainda, esse registro é manual (G-03). O repositor aceita/executa pelo
// aplicativo próprio (/repositor, Correção 1); aqui o dono/gerente também
// pode atribuir uma tarefa direto a um repositor (PA-12) e decidir uma
// inconsistência (RN-REP-08) quando as quantidades não fecham.
export function ReplenishmentOverview({
  companyId,
  market,
  onOpenStocker,
  notify,
}: {
  companyId: string | null;
  market: Market;
  onOpenStocker: () => void;
  notify: (message: string) => void;
}) {
  const [positions, setPositions] = useState<GondolaPosition[]>([]);
  const [tasks, setTasks] = useState<ReplenishmentTask[]>([]);
  const [stockers, setStockers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, string>>({});
  const [savingPositionId, setSavingPositionId] = useState<string | null>(null);
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [positionList, taskList, memberList] = await Promise.all([
      listGondolaPositions(market.id),
      listReplenishmentTasks(market.id),
      companyId ? listTeamMembers(companyId) : Promise.resolve([]),
    ]);
    setPositions(positionList.filter((position) => position.productId));
    setTasks(taskList);
    setStockers(
      memberList.filter(
        (member) => member.role === "stocker" && member.marketNames.includes(market.name),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [market.id, companyId]);

  const handleAssign = async (task: ReplenishmentTask) => {
    const stockerId = assignDrafts[task.id];
    if (!stockerId) {
      notify("Escolha um repositor.");
      return;
    }
    setBusyTaskId(task.id);
    const result = await assignReplenishmentTask(task.id, stockerId);
    setBusyTaskId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify("Tarefa atribuída ao repositor.");
    void reload();
  };

  const handleResolve = async (taskId: string) => {
    if (!resolutionNote.trim()) {
      notify("Informe uma observação sobre a decisão.");
      return;
    }
    setBusyTaskId(taskId);
    const result = await resolveReplenishmentInconsistency(taskId, resolutionNote);
    setBusyTaskId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setResolvingTaskId(null);
    setResolutionNote("");
    notify("Inconsistência decidida.");
    void reload();
  };

  const handleRecordBalance = async (position: GondolaPosition) => {
    const raw = balanceDrafts[position.id] ?? "";
    const value = Number(raw);
    if (!raw.trim() || value < 0) {
      notify("Informe um saldo válido (zero ou maior).");
      return;
    }
    setSavingPositionId(position.id);
    const result = await recordGondolaBalance(position.id, value);
    setSavingPositionId(null);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setBalanceDrafts((drafts) => ({ ...drafts, [position.id]: "" }));
    notify(
      result.taskCreated ? "Saldo registrado — tarefa de reposição criada." : "Saldo registrado.",
    );
    void reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg bg-brand-panel p-5 text-sidebar-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-brand-soft">
            <Smartphone className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">Aplicativo do repositor</h2>
            <p className="text-sm text-sidebar-muted">
              Experiência móvel usada pela equipe de {market.name}
            </p>
          </div>
        </div>
        <Button onClick={onOpenStocker}>
          <Smartphone className="h-4 w-4" /> Abrir aplicativo do repositor
        </Button>
      </div>

      <ChartCard
        title="Registrar saldo da gôndola"
        subtitle="Sem PDV ainda: confira a prateleira e registre o saldo atual — a tarefa nasce sozinha quando bate no mínimo."
        action={
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
          </Button>
        }
      >
        {positions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma posição de gôndola com produto atribuído ainda.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {positions.map((position) => (
              <li key={position.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate">{position.productName}</strong>
                    <span className="text-xs text-muted-foreground">
                      {position.code} · saldo atual {position.currentBalance} · mín{" "}
                      {position.minQuantity} · ideal {position.idealQuantity}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={balanceDrafts[position.id] ?? ""}
                    onChange={(event) =>
                      setBalanceDrafts((drafts) => ({
                        ...drafts,
                        [position.id]: event.target.value,
                      }))
                    }
                    placeholder="Saldo observado"
                    className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    size="sm"
                    disabled={savingPositionId === position.id}
                    onClick={() => void handleRecordBalance(position)}
                  >
                    {savingPositionId === position.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "Registrar"
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <ChartCard
        title="Reposições"
        subtitle={`${tasks.length} tarefas em andamento, por prioridade`}
      >
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma tarefa de reposição em andamento.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate">{task.productName}</strong>
                    <span className="text-xs text-muted-foreground">
                      sugerido {task.quantityNeeded} até o ideal
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <AlertPill
                      label={replenishmentTaskStatusLabel[task.status]}
                      tone={statusTone[task.status]}
                    />
                    {task.isRuptura && <AlertPill label="Ruptura" tone="critical" />}
                    {!task.isRuptura && task.isNearExpiry && (
                      <AlertPill label="Validade" tone="warning" />
                    )}
                  </div>
                </div>
                <p className="mt-2 flex gap-2 text-sm">
                  <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {task.gondolaPositionCode}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> Aguardando há {Math.round(task.waitingHours)}h
                </p>
                {task.lastImpedimentReason && (
                  <p className="mt-2 text-xs text-warning">
                    Último impedimento: {task.lastImpedimentReason}
                  </p>
                )}

                {task.status === "pendente" && stockers.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    <Select
                      value={assignDrafts[task.id] ?? ""}
                      onValueChange={(value) =>
                        setAssignDrafts((drafts) => ({ ...drafts, [task.id]: value }))
                      }
                    >
                      <SelectTrigger className="h-9 flex-1 bg-card text-xs">
                        <SelectValue placeholder="Atribuir a um repositor" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockers.map((stocker) => (
                          <SelectItem key={stocker.userId} value={stocker.userId}>
                            {stocker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={busyTaskId === task.id}
                      onClick={() => void handleAssign(task)}
                    >
                      Atribuir
                    </Button>
                  </div>
                )}

                {task.status === "com_inconsistencia" &&
                  (resolvingTaskId === task.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="Observação sobre a decisão"
                        className="min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyTaskId === task.id}
                          onClick={() => void handleResolve(task.id)}
                        >
                          Confirmar decisão
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResolvingTaskId(null);
                            setResolutionNote("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      onClick={() => setResolvingTaskId(task.id)}
                    >
                      Decidir inconsistência
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
