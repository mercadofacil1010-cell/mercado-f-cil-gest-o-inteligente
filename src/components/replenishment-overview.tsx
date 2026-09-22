import { Clock3, LayoutGrid, Smartphone, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPill, ChartCard, type Tone } from "@/components/dashboard-ui";
import type { Market } from "@/data/markets";
import { initialTasks, stockerProfile, type TaskPriority } from "@/data/replenishment";

const priorityTone: Record<TaskPriority, Tone> = { Urgente: "critical", Alta: "warning", Normal: "neutral" };

/** Visão do gestor sobre as reposições da unidade, com acesso ao aplicativo do repositor. */
export function ReplenishmentOverview({ market, onOpenStocker, notify }: { market: Market; onOpenStocker: () => void; notify: (message: string) => void }) {
  const tasks = initialTasks;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg bg-brand-panel p-5 text-sidebar-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-brand-soft"><Smartphone className="h-6 w-6" /></span><div><h2 className="text-lg font-extrabold">Aplicativo do repositor</h2><p className="text-sm text-sidebar-muted">Experiência móvel usada pela equipe de {market.name}</p></div></div>
        <Button onClick={onOpenStocker}><Smartphone className="h-4 w-4" /> Abrir aplicativo do repositor</Button>
      </div>
      <ChartCard title="Reposições pendentes" subtitle={`${tasks.length} tarefas na fila · repositor em turno: ${stockerProfile.name}`} action={<Button size="sm" variant="outline" onClick={() => notify("Nova tarefa de reposição criada (simulação).")}>Nova tarefa</Button>}>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block">{task.product}</strong><span className="text-xs text-muted-foreground">{task.id} · sugerido {task.suggested} {task.unit}</span></div><AlertPill label={task.priority} tone={priorityTone[task.priority]} /></div>
              <p className="mt-2 flex gap-2 text-sm"><LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{task.gondola}</p>
              <p className="mt-1 flex gap-2 text-sm"><Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{task.warehouse}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Solicitada às {task.requestedAt} · aguardando {task.waitingMinutes} min</p>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}
