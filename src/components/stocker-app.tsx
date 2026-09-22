import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Flag,
  ImagePlus,
  Keyboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  MapPin,
  Package,
  Play,
  ScanBarcode,
  Warehouse,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AlertPill, Modal, type Tone } from "@/components/dashboard-ui";
import { initialTasks, stockerProfile, type ReplenishmentTask, type TaskPriority, type TaskStatus } from "@/data/replenishment";
import { cn } from "@/lib/utils";

const inputClass = "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15";
const priorityTone: Record<TaskPriority, Tone> = { Urgente: "critical", Alta: "warning", Normal: "neutral" };
const statusTone: Record<TaskStatus, Tone> = { Pendente: "neutral", "Em andamento": "warning", Concluída: "positive", "Aguardando gerente": "critical", "Com ocorrência": "critical" };
const priorityOrder: Record<TaskPriority, number> = { Urgente: 0, Alta: 1, Normal: 2 };
const occurrenceTypes = ["Produto não encontrado", "Endereço incorreto", "Gôndola bloqueada", "Produto danificado"] as const;

const pad = (value: number) => String(value).padStart(2, "0");
const now = () => { const date = new Date(); return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`; };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");

type Step = "accept" | "enter-warehouse" | "scan-address" | "scan-product" | "withdraw" | "scan-gondola" | "count" | "replenish" | "confirm" | "done" | "manager";
const stepList: Array<{ id: Step; label: string }> = [
  { id: "accept", label: "Aceitar tarefa" },
  { id: "enter-warehouse", label: "Entrar no depósito" },
  { id: "scan-address", label: "Escanear endereço" },
  { id: "scan-product", label: "Escanear produto" },
  { id: "withdraw", label: "Retirar do depósito" },
  { id: "scan-gondola", label: "Escanear gôndola" },
  { id: "count", label: "Contar a prateleira" },
  { id: "replenish", label: "Repor e informar" },
  { id: "confirm", label: "Confirmar conclusão" },
];

type LogEntry = { time: string; text: string };
type Run = { task: ReplenishmentTask; step: Step; startedAt: number; log: LogEntry[]; withdrawn: number; placed: number; returned: number; attempts: number[]; counted: number | null; finishedAt: number | null };

export function StockerApp({ onExit }: { onExit: () => void }) {
  const [tasks, setTasks] = useState<ReplenishmentTask[]>(initialTasks);
  const [online, setOnline] = useState(true);
  const [completed, setCompleted] = useState(stockerProfile.completedToday);
  const [run, setRun] = useState<Run | null>(null);
  const [message, setMessage] = useState("");

  const pending = useMemo(() => tasks.filter((task) => task.status === "Pendente").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.waitingMinutes - a.waitingMinutes), [tasks]);
  const urgent = pending.filter((task) => task.priority === "Urgente").length;

  function start(task: ReplenishmentTask) {
    setRun({ task, step: "accept", startedAt: Date.now(), log: [], withdrawn: 0, placed: 0, returned: 0, attempts: [], counted: null, finishedAt: null });
    setMessage("");
  }

  function finishTask(status: TaskStatus, text: string) {
    if (!run) return;
    setTasks((current) => current.map((task) => (task.id === run.task.id ? { ...task, status } : task)));
    if (status === "Concluída") setCompleted((value) => value + 1);
    setMessage(text);
  }

  return (
    <main className="min-h-screen bg-background sm:bg-brand-panel sm:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background sm:min-h-[calc(100vh-4rem)] sm:overflow-hidden sm:rounded-2xl sm:shadow-visual">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-brand-panel px-4 py-3 text-sidebar-foreground">
          {run ? <Button variant="nav" size="icon" onClick={() => setRun(null)} aria-label="Voltar para tarefas"><ArrowLeft className="h-5 w-5" /></Button> : <BrandLogo inverse compact />}
          <div className="min-w-0 flex-1 text-center"><strong className="block truncate text-sm">{run ? `Tarefa ${run.task.id}` : "Aplicativo do repositor"}</strong><span className="block truncate text-xs text-sidebar-muted">{stockerProfile.market}</span></div>
          <Button variant="nav" size="icon" onClick={onExit} aria-label="Sair do aplicativo"><LogOut className="h-5 w-5" /></Button>
        </header>

        <div className="flex-1 p-4">
          {run ? (
            <TaskFlow run={run} onChange={setRun} onFinish={finishTask} onClose={() => setRun(null)} />
          ) : (
            <Home online={online} setOnline={setOnline} pending={pending} urgent={urgent} completed={completed} tasks={tasks} message={message} onStart={start} onDismiss={() => setMessage("")} />
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------ Início ------------------------------------ */

function Home({ online, setOnline, pending, urgent, completed, tasks, message, onStart, onDismiss }: { online: boolean; setOnline: (value: boolean) => void; pending: ReplenishmentTask[]; urgent: number; completed: number; tasks: ReplenishmentTask[]; message: string; onStart: (task: ReplenishmentTask) => void; onDismiss: () => void }) {
  const next = pending[0];
  const others = tasks.filter((task) => task.status !== "Pendente");
  return (
    <div className="space-y-4">
      {message && <div role="status" className="flex items-start justify-between gap-3 rounded-md bg-primary-soft p-3 text-sm font-semibold text-primary"><span>{message}</span><button type="button" onClick={onDismiss} className="shrink-0 text-xs underline">Ok</button></div>}

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-panel font-extrabold text-sidebar-foreground">{initials(stockerProfile.name)}</span>
          <div className="min-w-0 flex-1"><strong className="block truncate text-lg">{stockerProfile.name}</strong><span className="block truncate text-sm text-muted-foreground">Repositor · {stockerProfile.shift}</span></div>
          <button type="button" onClick={() => setOnline(!online)} aria-pressed={online} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", online ? "bg-highlight-soft text-success" : "bg-muted text-muted-foreground")}><span className={cn("h-2 w-2 rounded-full", online ? "bg-success" : "bg-muted-foreground")} />{online ? "Online" : "Offline"}</button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {stockerProfile.market}</p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Counter label="Pendentes" value={pending.length} />
        <Counter label="Urgentes" value={urgent} tone="critical" />
        <Counter label="Concluídas" value={completed} tone="positive" />
      </div>

      <Button className="h-14 w-full text-base" disabled={!next || !online} onClick={() => next && onStart(next)}><Play className="h-5 w-5" /> Iniciar próxima tarefa</Button>
      {!online && <p className="text-center text-sm text-muted-foreground">Fique online para receber e iniciar tarefas.</p>}

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-extrabold"><ListChecks className="h-5 w-5" /> Reposições pendentes</h2>
        {pending.length === 0 ? <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">Nenhuma tarefa pendente. Bom trabalho!</p> : (
          <ul className="space-y-2.5">{pending.map((task) => <li key={task.id}><TaskCard task={task} onOpen={online ? () => onStart(task) : undefined} /></li>)}</ul>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-2 font-extrabold">Tarefas de hoje</h2>
          <ul className="space-y-2">{others.map((task) => <li key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"><span className="min-w-0"><strong className="block truncate text-sm">{task.product}</strong><span className="text-xs text-muted-foreground">{task.id}</span></span><AlertPill label={task.status} tone={statusTone[task.status]} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  return <div className="rounded-lg border border-border bg-card p-3 text-center shadow-card"><strong className={cn("block text-2xl font-extrabold", tone === "critical" && "text-critical", tone === "positive" && "text-success")}>{value}</strong><span className="text-xs font-semibold text-muted-foreground">{label}</span></div>;
}

function TaskCard({ task, onOpen }: { task: ReplenishmentTask; onOpen?: (() => void) | undefined }) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary-soft text-sm font-extrabold text-primary" aria-hidden="true">{initials(task.product)}</span>
        <div className="min-w-0 flex-1"><strong className="block leading-snug">{task.product}</strong><span className="font-mono text-xs text-muted-foreground">{task.barcode}</span></div>
        <AlertPill label={task.priority} tone={priorityTone[task.priority]} />
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex gap-2"><LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dt className="sr-only">Gôndola</dt><dd>{task.gondola}</dd></div>
        <div className="flex gap-2"><Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dt className="sr-only">Depósito</dt><dd>{task.warehouse}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span>Sugerido: <strong>{task.suggested} {task.unit}</strong></span>
        <span className="flex items-center gap-1 text-muted-foreground"><Clock3 className="h-4 w-4" /> {task.requestedAt} · aguardando {task.waitingMinutes} min</span>
      </div>
    </>
  );
  return onOpen ? <button type="button" onClick={onOpen} className="block w-full rounded-lg border border-border bg-card p-4 text-left shadow-card transition hover:border-primary/60">{content}</button> : <div className="rounded-lg border border-border bg-card p-4 shadow-card">{content}</div>;
}

/* ------------------------------------ Fluxo ------------------------------------ */

function TaskFlow({ run, onChange, onFinish, onClose }: { run: Run; onChange: (run: Run) => void; onFinish: (status: TaskStatus, text: string) => void; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [issueOpen, setIssueOpen] = useState(false);
  const finished = run.step === "done" || run.step === "manager";

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - run.startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [run.startedAt, finished]);

  const total = Math.floor(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000);
  const advance = (step: Step, text: string, patch: Partial<Run> = {}) => onChange({ ...run, ...patch, step, log: [...run.log, { time: now(), text }] });
  const index = stepList.findIndex((item) => item.id === run.step);
  const { task } = run;

  return (
    <div className="space-y-4">
      {!finished && (
        <>
          <div className="flex items-center justify-between text-sm font-semibold"><span>Etapa {index + 1} de {stepList.length}</span><span className="flex items-center gap-1 text-muted-foreground"><Clock3 className="h-4 w-4" /> {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / stepList.length) * 100}%` }} /></div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3"><Package className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><strong className="block truncate text-sm">{task.product}</strong><span className="block truncate text-xs text-muted-foreground">{stepList[index]?.label}</span></div><AlertPill label={task.priority} tone={priorityTone[task.priority]} /></div>
        </>
      )}

      {run.step === "accept" && (
        <StepCard icon={Flag} title="Aceitar tarefa" description="Ao aceitar, o aplicativo registra a data e o horário de início.">
          <TaskCard task={task} />
          <Button className="mt-4 h-12 w-full" onClick={() => advance("enter-warehouse", "Tarefa aceita")}><CheckCircle2 className="h-5 w-5" /> Aceitar tarefa</Button>
        </StepCard>
      )}

      {run.step === "enter-warehouse" && (
        <StepCard icon={Warehouse} title="Vá até o depósito" description={task.warehouse}>
          <Button className="h-12 w-full" onClick={() => advance("scan-address", "Entrada no depósito confirmada")}><Warehouse className="h-5 w-5" /> Confirmar entrada no depósito</Button>
        </StepCard>
      )}

      {run.step === "scan-address" && (
        <ScanStep key="address" icon={MapPin} title="Escanear endereço" description={`Leia a etiqueta do endereço: ${task.warehouse}`} expected={task.warehouseCode} hint={task.warehouseCode} errorText="Endereço incorreto. Confira a etiqueta e leia novamente." onSuccess={() => advance("scan-product", `Endereço ${task.warehouseCode} confirmado`)} />
      )}

      {run.step === "scan-product" && (
        <ScanStep key="product" icon={ScanBarcode} title="Escanear produto" description={`Leia o código de barras de ${task.product}.`} expected={task.barcode} hint={task.barcode} errorText="Produto diferente do solicitado. Verifique a embalagem." onSuccess={() => advance("withdraw", "Produto confirmado no depósito")} />
      )}

      {run.step === "withdraw" && (
        <QuantityStep key="withdraw" icon={Warehouse} title="Quantidade retirada" description={`Informe quanto você retirou do depósito (${task.unit}). Sugerido: ${task.suggested}.`} button="Registrar saída do depósito" onSubmit={(value) => advance("scan-gondola", `Saída do depósito: ${value} ${task.unit}`, { withdrawn: value })} />
      )}

      {run.step === "scan-gondola" && (
        <ScanStep key="gondola" icon={LayoutGrid} title="Escanear a gôndola" description={`Vá até ${task.gondola} e leia a etiqueta da posição.`} expected={task.gondolaCode} hint={task.gondolaCode} errorText="Localização incorreta. Confira a gôndola e a prateleira." onSuccess={() => advance("count", `Chegada à gôndola ${task.gondolaCode}`)} />
      )}

      {run.step === "count" && <CountStep run={run} onChange={onChange} advance={advance} onManager={() => onFinish("Aguardando gerente", `Tarefa ${task.id} enviada para análise do gerente.`)} />}

      {run.step === "replenish" && <ReplenishStep run={run} advance={advance} />}

      {run.step === "confirm" && (
        <StepCard icon={CheckCircle2} title="Confirmar conclusão" description="Revise as quantidades antes de concluir.">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Retirado" value={`${run.withdrawn}`} /><Mini label="Colocado" value={`${run.placed}`} /><Mini label="Devolvido" value={`${run.returned}`} />
          </dl>
          <Button className="mt-4 h-12 w-full" onClick={() => { advance("done", "Reposição concluída", { finishedAt: Date.now() }); onFinish("Concluída", `Tarefa ${task.id} concluída.`); }}><CheckCircle2 className="h-5 w-5" /> Concluir reposição</Button>
        </StepCard>
      )}

      {run.step === "manager" && (
        <StepCard icon={AlertTriangle} title="Inconsistência enviada ao gerente" description="As três contagens divergiram. Uma ocorrência foi registrada automaticamente e a tarefa dependerá da análise do gerente." tone="critical">
          <Timeline log={run.log} />
          <Button className="mt-4 h-12 w-full" onClick={onClose}>Voltar para tarefas</Button>
        </StepCard>
      )}

      {run.step === "done" && (
        <StepCard icon={CheckCircle2} title="Reposição concluída!" description={`${task.product} · ${task.gondola}`} tone="positive">
          <dl className="grid grid-cols-2 gap-2 text-center">
            <Mini label="Tempo total" value={`${pad(Math.floor(total / 60))}:${pad(total % 60)}`} />
            <Mini label="Contado na prateleira" value={`${run.counted ?? 0} ${task.unit}`} />
            <Mini label="Retirado do depósito" value={`${run.withdrawn} ${task.unit}`} />
            <Mini label="Colocado na gôndola" value={`${run.placed} ${task.unit}`} />
            <Mini label="Sobra devolvida" value={`${run.returned} ${task.unit}`} />
            <Mini label="Prateleira agora" value={`${(run.counted ?? 0) + run.placed} ${task.unit}`} />
          </dl>
          <Timeline log={run.log} />
          <Button className="mt-4 h-12 w-full" onClick={onClose}>Voltar para tarefas</Button>
        </StepCard>
      )}

      {!finished && <Button variant="outline" className="h-12 w-full border-critical/40 text-critical hover:bg-critical/5" onClick={() => setIssueOpen(true)}><AlertTriangle className="h-5 w-5" /> Relatar problema</Button>}

      {issueOpen && <IssueModal onClose={() => setIssueOpen(false)} onSubmit={(type) => { setIssueOpen(false); onFinish("Com ocorrência", `Ocorrência "${type}" registrada na tarefa ${task.id}.`); onClose(); }} />}
    </div>
  );
}

function StepCard({ icon: Icon, title, description, children, tone }: { icon: typeof Flag; title: string; description: string; children: ReactNode; tone?: Tone }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <span className={cn("grid h-12 w-12 place-items-center rounded-lg", tone === "critical" ? "bg-critical/10 text-critical" : tone === "positive" ? "bg-highlight-soft text-success" : "bg-primary-soft text-primary")}><Icon className="h-6 w-6" /></span>
      <h2 className="mt-3 text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ScanStep({ icon, title, description, expected, hint, errorText, onSuccess }: { icon: typeof Flag; title: string; description: string; expected: string; hint: string; errorText: string; onSuccess: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const check = (input: string) => { if (input.trim().toUpperCase() === expected.toUpperCase()) { setError(""); onSuccess(); } else setError(input.trim() ? errorText : "Leia ou digite o código."); };
  return (
    <StepCard icon={icon} title={title} description={description}>
      <Button className="h-14 w-full text-base" onClick={() => setScanning(true)}><Camera className="h-5 w-5" /> Abrir scanner</Button>
      <div className="my-3 flex items-center gap-3 text-xs font-semibold uppercase text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">ou digite</div>
      <div className="flex gap-2"><div className="relative flex-1"><Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") check(value); }} aria-label="Código" placeholder="Código" className={cn(inputClass, "pl-10")} /></div><Button className="h-12" variant="outline" onClick={() => check(value)}>Confirmar</Button></div>
      {error && <p className="mt-3 rounded-md bg-critical/10 p-3 text-sm font-semibold text-critical" role="alert">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Demonstração: o código correto é <span className="font-mono font-bold">{hint}</span>.</p>
      {scanning && (
        <Modal title="Scanner" description="Simulação da câmera do celular." onClose={() => setScanning(false)}>
          <div className="relative mb-4 grid h-44 place-items-center overflow-hidden rounded-lg bg-brand-panel"><div className="h-24 w-56 rounded-md border-2 border-dashed border-brand-soft" /><div className="absolute inset-x-10 top-1/2 h-0.5 animate-pulse bg-critical" /></div>
          <div className="grid gap-2"><Button onClick={() => { setScanning(false); check(expected); }}><CheckCircle2 className="h-4 w-4" /> Simular leitura correta</Button><Button variant="outline" onClick={() => { setScanning(false); check("CODIGO-ERRADO"); }}>Simular leitura de outro código</Button></div>
        </Modal>
      )}
    </StepCard>
  );
}

function QuantityStep({ icon, title, description, button, onSubmit, max }: { icon: typeof Flag; title: string; description: string; button: string; onSubmit: (value: number) => void; max?: number }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  function submit() {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || value === "") { setError("Informe uma quantidade válida."); return; }
    if (max !== undefined && number > max) { setError(`O valor não pode passar de ${max}.`); return; }
    onSubmit(number);
  }
  return (
    <StepCard icon={icon} title={title} description={description}>
      <QuantityInput value={value} onChange={(next) => { setValue(next); setError(""); }} />
      {error && <p className="mt-3 text-sm font-semibold text-critical" role="alert">{error}</p>}
      <Button className="mt-4 h-12 w-full" onClick={submit}>{button}</Button>
    </StepCard>
  );
}

function QuantityInput({ value, onChange, label = "Quantidade" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const number = Number(value) || 0;
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] gap-2">
      <Button variant="outline" className="h-14 text-2xl" onClick={() => onChange(String(Math.max(0, number - 1)))} aria-label="Diminuir">−</Button>
      <input value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" aria-label={label} placeholder="0" className={cn(inputClass, "h-14 text-center text-2xl font-extrabold")} />
      <Button variant="outline" className="h-14 text-2xl" onClick={() => onChange(String(number + 1))} aria-label="Aumentar">+</Button>
    </div>
  );
}

function CountStep({ run, onChange, advance, onManager }: { run: Run; onChange: (run: Run) => void; advance: (step: Step, text: string, patch?: Partial<Run>) => void; onManager: () => void }) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; tone: Tone } | null>(null);
  const attempt = run.attempts.length + 1;

  function submit() {
    if (value === "") { setFeedback({ text: "Informe a quantidade contada.", tone: "critical" }); return; }
    const counted = Number(value);
    const attempts = [...run.attempts, counted];
    if (counted === run.task.shelfExpected) {
      advance("replenish", `Contagem da prateleira: ${counted} ${run.task.unit} (tentativa ${attempts.length})`, { attempts, counted });
      return;
    }
    const log = [...run.log, { time: now(), text: `Contagem ${attempts.length} divergente: ${counted} ${run.task.unit}` }];
    if (attempts.length >= 3) {
      onChange({ ...run, attempts, counted, step: "manager", log: [...log, { time: now(), text: "Ocorrência registrada automaticamente" }] });
      onManager();
      return;
    }
    onChange({ ...run, attempts, log });
    setValue("");
    setFeedback(attempts.length === 1 ? { text: "Contagem não confere. Conte novamente.", tone: "warning" } : { text: "Segunda tentativa registrada. Última tentativa disponível.", tone: "critical" });
  }

  return (
    <StepCard icon={ListChecks} title="Conte o que existe na prateleira" description="Conte os produtos antes de repor. O sistema não mostra a quantidade esperada.">
      <div className="mb-3 flex gap-1.5">{[1, 2, 3].map((item) => <span key={item} className={cn("h-2 flex-1 rounded-full", item < attempt ? "bg-critical" : item === attempt ? "bg-primary" : "bg-border")} />)}</div>
      <p className="mb-3 text-sm font-semibold">Tentativa {attempt} de 3</p>
      <QuantityInput value={value} onChange={(next) => { setValue(next); }} label="Quantidade contada na prateleira" />
      {feedback && <p className={cn("mt-3 rounded-md p-3 text-sm font-semibold", feedback.tone === "critical" ? "bg-critical/10 text-critical" : "bg-warning-soft")} role="alert">{feedback.text}</p>}
      <Button className="mt-4 h-12 w-full" onClick={submit}>Confirmar contagem</Button>
      <p className="mt-3 text-xs text-muted-foreground">Demonstração: a quantidade correta é <strong>{run.task.shelfExpected}</strong>.</p>
    </StepCard>
  );
}

function ReplenishStep({ run, advance }: { run: Run; advance: (step: Step, text: string, patch?: Partial<Run>) => void }) {
  const [placed, setPlaced] = useState(String(run.withdrawn));
  const [error, setError] = useState("");
  const placedNumber = Number(placed) || 0;
  const returned = Math.max(0, run.withdrawn - placedNumber);
  function submit() {
    if (placed === "") { setError("Informe a quantidade colocada."); return; }
    if (placedNumber > run.withdrawn) { setError(`Você retirou ${run.withdrawn} ${run.task.unit}. Não é possível colocar mais que isso.`); return; }
    advance("confirm", `Reposição: ${placedNumber} ${run.task.unit} colocados, ${returned} devolvidos`, { placed: placedNumber, returned });
  }
  return (
    <StepCard icon={LayoutGrid} title="Realize a reposição" description={`Coloque o produto em ${run.task.gondola} e informe as quantidades.`}>
      <span className="mb-2 block text-sm font-semibold">Quantidade colocada ({run.task.unit})</span>
      <QuantityInput value={placed} onChange={(next) => { setPlaced(next); setError(""); }} label="Quantidade colocada" />
      <div className="mt-4 flex items-center justify-between rounded-md bg-muted p-3 text-sm"><span>Sobra devolvida ao depósito</span><strong className="text-lg">{returned} {run.task.unit}</strong></div>
      {error && <p className="mt-3 text-sm font-semibold text-critical" role="alert">{error}</p>}
      <Button className="mt-4 h-12 w-full" onClick={submit}>Continuar</Button>
    </StepCard>
  );
}

function IssueModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (type: string) => void }) {
  const [type, setType] = useState<string>(occurrenceTypes[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  return (
    <Modal title="Relatar problema" description="O gerente será avisado e a tarefa ficará em análise." onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSubmit(type)}><Zap className="h-4 w-4" /> Enviar ocorrência</Button></>}>
      <div className="grid gap-2">{occurrenceTypes.map((item) => <label key={item} className={cn("flex cursor-pointer items-center gap-3 rounded-md border p-3.5 text-sm font-semibold", type === item ? "border-primary bg-primary-soft" : "border-border")}><input type="radio" name="occurrence" checked={type === item} onChange={() => setType(item)} className="h-4 w-4 accent-primary" />{item}</label>)}</div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm font-semibold text-primary"><ImagePlus className="h-5 w-5" />{photo ? "Foto anexada" : "Anexar foto"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setPhoto(Boolean(event.target.files?.length))} /></label>
      <label className="mt-3 block"><span className="mb-1.5 block text-sm font-semibold">Observação</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={3} className={cn(inputClass, "h-auto py-2.5")} /></label>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted p-2.5"><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-0.5 font-extrabold">{value}</dd></div>;
}

function Timeline({ log }: { log: LogEntry[] }) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-bold">Registro da tarefa</h3>
      <ol className="space-y-1.5 border-l-2 border-border pl-3">{log.map((entry, index) => <li key={`${entry.time}-${index}`} className="text-sm"><span className="font-mono text-xs text-muted-foreground">{entry.time}</span> · {entry.text}</li>)}</ol>
    </div>
  );
}
