import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  EyeOff,
  ImagePlus,
  Keyboard,
  Lock,
  PackageSearch,
  Play,
  RotateCcw,
  ScanBarcode,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPill, EmptyState, Modal, type Tone } from "@/components/dashboard-ui";
import { daysUntil, formatDate, packagingUnits, type PackagingUnit } from "@/data/products";
import {
  receivingCatalog,
  receivingStatuses,
  type CatalogItem,
  type CountedItem,
  type ProductCondition,
  type Receiving,
  type ReceivingStatus,
  type ResultLine,
} from "@/data/receivings";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-critical";
const selectClass = `${inputClass} appearance-none`;

const statusTone: Record<ReceivingStatus, Tone> = {
  "Aguardando recebimento": "neutral",
  "Em conferência": "warning",
  "Com divergência": "critical",
  "Aguardando aprovação": "warning",
  Finalizado: "positive",
  Recusado: "critical",
};

const unitShort: Record<PackagingUnit, string> = { Unidade: "un.", Pacote: "pct", Caixa: "cx", Fardo: "fd", Quilograma: "kg", Litro: "L" };
const pad = (value: number) => String(value).padStart(2, "0");
const clock = () => { const now = new Date(); return `${pad(now.getHours())}:${pad(now.getMinutes())}`; };
const formatDuration = (minutes: number | null) => (minutes === null ? "—" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`);

/** Compara o que era esperado com o que foi contado (somente para usuário autorizado). */
export function buildResult(receiving: Receiving): ResultLine[] {
  const lines: ResultLine[] = receiving.expected.map((expected) => {
    const items = receiving.counted.filter((item) => item.barcode === expected.barcode);
    const total = items.reduce((sum, item) => sum + item.baseQuantity, 0);
    return {
      barcode: expected.barcode,
      product: expected.product,
      expected: expected.quantity,
      counted: total,
      unit: expected.unit,
      missing: Math.max(0, expected.quantity - total),
      surplus: Math.max(0, total - expected.quantity),
      notRequested: false,
      damaged: items.filter((item) => item.condition !== "Bom estado").reduce((sum, item) => sum + item.baseQuantity, 0),
      lotMismatch: items.some((item) => item.lot.trim() !== "" && item.lot.trim().toUpperCase() !== expected.lot.toUpperCase()),
      badExpiry: items.some((item) => item.condition === "Vencido" || (item.expiresAt !== "" && daysUntil(item.expiresAt) <= 30)),
      refused: receiving.refusedBarcodes.includes(expected.barcode),
    };
  });
  const extraBarcodes = [...new Set(receiving.counted.filter((item) => !receiving.expected.some((expected) => expected.barcode === item.barcode)).map((item) => item.barcode))];
  extraBarcodes.forEach((barcode) => {
    const items = receiving.counted.filter((item) => item.barcode === barcode);
    const first = items[0];
    if (!first) return;
    lines.push({ barcode, product: first.product, expected: 0, counted: items.reduce((sum, item) => sum + item.baseQuantity, 0), unit: receivingCatalog.find((item) => item.barcode === barcode)?.baseUnit ?? first.packaging, missing: 0, surplus: 0, notRequested: true, damaged: items.filter((item) => item.condition !== "Bom estado").reduce((sum, item) => sum + item.baseQuantity, 0), lotMismatch: false, badExpiry: false, refused: receiving.refusedBarcodes.includes(barcode) });
  });
  return lines;
}

const lineHasDivergence = (line: ResultLine) => line.missing > 0 || line.surplus > 0 || line.notRequested || line.damaged > 0 || line.lotMismatch || line.badExpiry;

type ReceivingModuleProps = {
  receivings: Receiving[];
  onChange: (receivings: Receiving[]) => void;
  notify: (message: string) => void;
  marketName: string;
};

type Screen = { kind: "list" } | { kind: "count"; id: string } | { kind: "result"; id: string };

export function ReceivingModule({ receivings, onChange, notify, marketName }: ReceivingModuleProps) {
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [authorized, setAuthorized] = useState(false);
  const update = (next: Receiving) => onChange(receivings.map((item) => (item.id === next.id ? next : item)));
  const current = screen.kind === "list" ? undefined : receivings.find((item) => item.id === screen.id);

  if (screen.kind === "count" && current) {
    return <BlindCount receiving={current} onBack={() => setScreen({ kind: "list" })} onSave={update} onFinish={(next) => { update(next); setScreen({ kind: "result", id: next.id }); notify(`Conferência de ${next.id} finalizada.`); }} />;
  }
  if (screen.kind === "result" && current) {
    return <ResultScreen receiving={current} authorized={authorized} onAuthorize={() => setAuthorized(true)} onBack={() => setScreen({ kind: "list" })} onChange={update} onRecount={() => setScreen({ kind: "count", id: current.id })} notify={notify} />;
  }
  return <ReceivingList receivings={receivings} marketName={marketName} onOpen={(receiving) => {
    if (receiving.status === "Aguardando recebimento" || receiving.status === "Em conferência") {
      if (receiving.status === "Aguardando recebimento") update({ ...receiving, status: "Em conferência", attempts: receiving.attempts + 1, time: clock() });
      setScreen({ kind: "count", id: receiving.id });
    } else setScreen({ kind: "result", id: receiving.id });
  }} />;
}

/* ------------------------------------ Lista ------------------------------------ */

function ReceivingList({ receivings, marketName, onOpen }: { receivings: Receiving[]; marketName: string; onOpen: (receiving: Receiving) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const filtered = receivings.filter((item) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return (!normalized || `${item.id} ${item.supplier} ${item.invoice} ${item.employee}`.toLocaleLowerCase("pt-BR").includes(normalized)) && (status === "all" || item.status === status);
  });
  const pending = receivings.filter((item) => item.status === "Aguardando recebimento" || item.status === "Em conferência");
  const actionLabel = (item: Receiving) => (item.status === "Aguardando recebimento" ? "Iniciar conferência" : item.status === "Em conferência" ? "Continuar conferência" : "Ver resultado");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-xl font-extrabold sm:text-2xl">Recebimento de mercadorias</h2><p className="mt-1 text-sm text-muted-foreground">Conferência cega das entregas de {marketName}</p></div>
        <Button onClick={() => setPickerOpen(true)} disabled={pending.length === 0}><ScanBarcode className="h-4 w-4" /> Nova conferência cega</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {receivingStatuses.map((item) => {
          const count = receivings.filter((receiving) => receiving.status === item).length;
          return <button key={item} type="button" onClick={() => setStatus(status === item ? "all" : item)} aria-pressed={status === item} className={cn("rounded-lg border bg-card p-3 text-left shadow-card transition hover:border-primary/50", status === item ? "border-primary ring-2 ring-primary/20" : "border-border")}><strong className="block text-xl font-extrabold">{count}</strong><span className="block text-xs font-semibold text-muted-foreground sm:text-sm">{item}</span></button>;
        })}
      </div>

      <div className="relative rounded-lg border border-border bg-card p-4 shadow-card"><Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar recebimentos" placeholder="Buscar por número, fornecedor, nota fiscal ou funcionário" className={cn(inputClass, "pl-10")} /></div>

      {filtered.length === 0 ? <EmptyState icon={Truck} title="Nenhum recebimento encontrado" description="Revise a busca ou o filtro de status." /> : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-card lg:block">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">{["Recebimento", "Fornecedor", "Nota fiscal", "Data e horário", "Responsável", "Volumes", "Status", "Divergências", "Tempo", ""].map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}</tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                  <td className="px-3 py-3 font-bold">{item.id}</td><td className="px-3 py-3">{item.supplier}</td><td className="px-3 py-3">{item.invoice}</td><td className="px-3 py-3">{item.date} · {item.time}</td><td className="px-3 py-3">{item.employee}</td><td className="px-3 py-3">{item.volumes}</td>
                  <td className="px-3 py-3"><AlertPill label={item.status} tone={statusTone[item.status]} /></td>
                  <td className="px-3 py-3">{item.divergences > 0 ? <strong className="text-critical">{item.divergences}</strong> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-3 py-3">{formatDuration(item.durationMinutes)}</td>
                  <td className="px-3 py-3 text-right"><Button size="sm" variant={item.status === "Aguardando recebimento" || item.status === "Em conferência" ? "default" : "outline"} onClick={() => onOpen(item)}>{actionLabel(item)}</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block">{item.id}</strong><span className="block truncate text-sm text-muted-foreground">{item.supplier}</span></div><AlertPill label={item.status} tone={statusTone[item.status]} /></div>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                  <Info label="Nota fiscal" value={item.invoice} /><Info label="Data e horário" value={`${item.date} · ${item.time}`} /><Info label="Responsável" value={item.employee} /><Info label="Volumes" value={String(item.volumes)} /><Info label="Divergências" value={String(item.divergences)} /><Info label="Tempo" value={formatDuration(item.durationMinutes)} />
                </dl>
                <Button className="mt-3 w-full" variant={item.status === "Aguardando recebimento" || item.status === "Em conferência" ? "default" : "outline"} onClick={() => onOpen(item)}>{actionLabel(item)}</Button>
              </article>
            ))}
          </div>
        </>
      )}

      {pickerOpen && (
        <Modal title="Nova conferência cega" description="Selecione a entrega que será conferida." onClose={() => setPickerOpen(false)}>
          <div className="space-y-2">{pending.map((item) => <button key={item.id} type="button" onClick={() => { setPickerOpen(false); onOpen(item); }} className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3.5 text-left hover:border-primary/50 hover:bg-primary-soft"><span className="min-w-0"><strong className="block">{item.id} · {item.supplier}</strong><span className="block text-sm text-muted-foreground">NF {item.invoice} · {item.status}</span></span><Play className="h-4 w-4 shrink-0 text-primary" /></button>)}</div>
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="truncate font-semibold">{value}</dd></div>;
}

/* ------------------------------- Conferência cega ------------------------------- */

type Draft = { packaging: PackagingUnit; quantity: string; lot: string; manufacturedAt: string; expiresAt: string; condition: ProductCondition; photo: string; note: string };
const emptyDraft = (unit: PackagingUnit): Draft => ({ packaging: unit, quantity: "", lot: "", manufacturedAt: "", expiresAt: "", condition: "Bom estado", photo: "", note: "" });

function BlindCount({ receiving, onBack, onSave, onFinish }: { receiving: Receiving; onBack: () => void; onSave: (receiving: Receiving) => void; onFinish: (receiving: Receiving) => void }) {
  const [code, setCode] = useState("");
  const [identified, setIdentified] = useState<CatalogItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft("Unidade"));
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  function identify(value: string) {
    const barcode = value.replace(/\D/g, "");
    const found = receivingCatalog.find((item) => item.barcode === barcode);
    if (!found) { setIdentified(null); setError(barcode ? "Código não encontrado no cadastro. Verifique ou digite novamente." : "Informe o código de barras."); return; }
    setCode(barcode);
    setIdentified(found);
    setDraft(emptyDraft(found.baseUnit));
    setError("");
  }

  function addItem() {
    if (!identified) return;
    const quantity = Number(draft.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Informe a quantidade contada."); return; }
    if (!draft.lot.trim()) { setError("Informe o lote."); return; }
    if (!draft.expiresAt) { setError("Informe a validade."); return; }
    if (draft.manufacturedAt && draft.manufacturedAt > draft.expiresAt) { setError("A fabricação não pode ser depois da validade."); return; }
    const factor = identified.factors[draft.packaging] ?? 1;
    const item: CountedItem = { id: `c-${Date.now()}`, barcode: identified.barcode, product: identified.product, packaging: draft.packaging, quantity, baseQuantity: quantity * factor, lot: draft.lot.trim().toUpperCase(), manufacturedAt: draft.manufacturedAt, expiresAt: draft.expiresAt, condition: draft.condition, photo: draft.photo, note: draft.note.trim() };
    onSave({ ...receiving, counted: [...receiving.counted, item] });
    setIdentified(null);
    setCode("");
    setDraft(emptyDraft("Unidade"));
    setError("");
  }

  function finish() {
    const draftReceiving = { ...receiving, durationMinutes: Math.max(1, Math.round(elapsed / 60)) };
    const divergences = buildResult(draftReceiving).filter(lineHasDivergence).length;
    onFinish({ ...draftReceiving, divergences, status: divergences > 0 ? "Com divergência" : "Aguardando aprovação" });
  }

  const availableUnits = identified ? packagingUnits.filter((unit) => identified.factors[unit] !== undefined) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para recebimentos"><ArrowLeft className="h-5 w-5" /></Button><div className="min-w-0"><h2 className="text-xl font-extrabold sm:text-2xl">Conferência cega</h2><p className="text-sm text-muted-foreground">As quantidades da nota e do pedido ficam ocultas durante a contagem.</p></div></div>

      <section className="grid grid-cols-2 gap-3 rounded-lg bg-brand-panel p-4 text-sidebar-foreground sm:grid-cols-4 sm:p-5">
        <HeaderStat label="Fornecedor" value={receiving.supplier} />
        <HeaderStat label="Recebimento" value={receiving.id} />
        <HeaderStat label="Volumes físicos" value={receiving.showVolumes ? String(receiving.volumes) : "Não autorizado"} />
        <HeaderStat label="Tempo de conferência" value={`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`} icon={<Clock3 className="h-4 w-4" />} />
      </section>

      <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm font-semibold"><EyeOff className="h-4 w-4 shrink-0 text-warning" /> Conte fisicamente cada item. O sistema não exibe quantidades esperadas.</div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
          <h3 className="font-extrabold">Identificar produto</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 14)); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") identify(code); }} inputMode="numeric" aria-label="Código de barras" placeholder="Leia ou digite o código de barras" className={cn(inputClass, "pl-10")} /></div>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" onClick={() => identify(code)}><Search className="h-4 w-4" /> Buscar</Button><Button onClick={() => setScannerOpen(true)}><Camera className="h-4 w-4" /> Abrir scanner</Button></div>
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-critical" role="alert">{error}</p>}

          {identified ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 rounded-md bg-primary-soft p-3.5"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><strong className="block">{identified.product}</strong><span className="font-mono text-xs text-muted-foreground">{identified.barcode}</span></div></div>
              <div>
                <span className="mb-2 block text-sm font-semibold">Tipo de embalagem</span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {packagingUnits.map((unit) => { const enabled = availableUnits.includes(unit); return <button key={unit} type="button" disabled={!enabled} onClick={() => setDraft((current) => ({ ...current, packaging: unit }))} aria-pressed={draft.packaging === unit} className={cn("rounded-md border p-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm", draft.packaging === unit ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40")}>{unit}</button>; })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Quantidade contada (${unitShort[draft.packaging]})`}><input value={draft.quantity} onChange={(event) => { setDraft((current) => ({ ...current, quantity: event.target.value.replace(/[^\d.,]/g, "") })); setError(""); }} inputMode="decimal" className={cn(inputClass, "text-lg font-bold")} /></Field>
                <Field label="Lote"><input value={draft.lot} onChange={(event) => setDraft((current) => ({ ...current, lot: event.target.value }))} maxLength={30} className={inputClass} /></Field>
                <Field label="Fabricação" optional><input type="date" value={draft.manufacturedAt} onChange={(event) => setDraft((current) => ({ ...current, manufacturedAt: event.target.value }))} className={inputClass} /></Field>
                <Field label="Validade"><input type="date" value={draft.expiresAt} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))} className={inputClass} /></Field>
                <Field label="Condição do produto"><select value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value as ProductCondition }))} className={selectClass}><option>Bom estado</option><option>Avariado</option><option>Embalagem violada</option><option>Vencido</option></select></Field>
                <Field label="Foto" optional><label className={cn(inputClass, "flex cursor-pointer items-center gap-2 text-sm text-muted-foreground")}><ImagePlus className="h-4 w-4" /><span className="truncate">{draft.photo ? "Foto anexada" : "Anexar foto"}</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDraft((current) => ({ ...current, photo: String(reader.result) })); reader.readAsDataURL(file); }} /></label></Field>
                <div className="sm:col-span-2"><Field label="Observação" optional><textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} maxLength={300} rows={2} className={cn(inputClass, "h-auto py-2.5")} /></Field></div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => { setIdentified(null); setCode(""); setError(""); }}>Cancelar item</Button><Button onClick={addItem}><ClipboardCheck className="h-4 w-4" /> Adicionar à conferência</Button></div>
            </div>
          ) : (
            <div className="mt-5 grid place-items-center rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><PackageSearch className="mb-2 h-8 w-8" />Leia um código de barras para registrar a contagem.</div>
          )}
        </section>

        <aside className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 lg:self-start">
          <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">Itens contados</h3><AlertPill label={`${receiving.counted.length} ${receiving.counted.length === 1 ? "registro" : "registros"}`} tone="neutral" /></div>
          {receiving.counted.length === 0 ? <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">Nenhum item contado ainda.</p> : (
            <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
              {receiving.counted.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2"><strong className="text-sm leading-snug">{item.product}</strong><Button variant="ghost" size="icon-sm" onClick={() => onSave({ ...receiving, counted: receiving.counted.filter((counted) => counted.id !== item.id) })} aria-label={`Remover ${item.product}`}><Trash2 className="h-4 w-4" /></Button></div>
                  <span className="block text-sm"><strong>{item.quantity.toLocaleString("pt-BR")} {unitShort[item.packaging]}</strong> · Lote {item.lot} · Val. {formatDate(item.expiresAt)}</span>
                  {item.condition !== "Bom estado" && <AlertPill label={item.condition} tone="critical" />}
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4 w-full" disabled={receiving.counted.length === 0} onClick={() => setConfirmFinish(true)}><CheckCircle2 className="h-4 w-4" /> Finalizar conferência</Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Conferente: {receiving.employee}</p>
        </aside>
      </div>

      {scannerOpen && (
        <Modal title="Scanner de código de barras" description="Simulação: escolha o produto que a câmera “leu”." onClose={() => setScannerOpen(false)}>
          <div className="relative mb-4 grid h-40 place-items-center overflow-hidden rounded-lg bg-brand-panel"><div className="h-20 w-56 rounded-md border-2 border-dashed border-brand-soft" /><div className="absolute inset-x-10 top-1/2 h-0.5 animate-pulse bg-critical" /><ScanBarcode className="absolute h-8 w-8 text-brand-soft" /></div>
          <div className="space-y-2">{receivingCatalog.map((item) => <button key={item.barcode} type="button" onClick={() => { setScannerOpen(false); identify(item.barcode); }} className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left text-sm hover:border-primary/50 hover:bg-primary-soft"><span className="font-semibold">{item.product}</span><span className="font-mono text-xs text-muted-foreground">{item.barcode}</span></button>)}</div>
        </Modal>
      )}

      {confirmFinish && (
        <Modal title="Finalizar conferência?" description="Depois de finalizar, a contagem segue para análise de um usuário autorizado." onClose={() => setConfirmFinish(false)} footer={<><Button variant="outline" onClick={() => setConfirmFinish(false)}>Continuar contando</Button><Button onClick={() => { setConfirmFinish(false); finish(); }}><CheckCircle2 className="h-4 w-4" /> Finalizar</Button></>}>
          <p className="text-sm">{receiving.counted.length} registros de contagem · tempo {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}</p>
        </Modal>
      )}
    </div>
  );
}

function HeaderStat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{label}</span><strong className="mt-1 flex items-center gap-1.5 truncate text-base">{icon}{value}</strong></div>;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>{children}</label>;
}

/* ----------------------------------- Resultado ----------------------------------- */

function ResultScreen({ receiving, authorized, onAuthorize, onBack, onChange, onRecount, notify }: { receiving: Receiving; authorized: boolean; onAuthorize: () => void; onBack: () => void; onChange: (receiving: Receiving) => void; onRecount: () => void; notify: (message: string) => void }) {
  const lines = useMemo(() => buildResult(receiving), [receiving]);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const divergent = lines.filter(lineHasDivergence);
  const closed = receiving.status === "Finalizado" || receiving.status === "Recusado";
  const canFinish = !closed && (divergent.length === 0 || receiving.approvedWithDivergence);

  if (!authorized) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Button variant="ghost" className="px-2" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Voltar para recebimentos</Button>
        <section className="rounded-lg border border-border bg-card p-7 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-brand-panel text-brand-soft"><Lock className="h-7 w-7" /></span>
          <h2 className="mt-4 text-xl font-extrabold">Resultado restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">A comparação entre o esperado e o contado de {receiving.id} só pode ser vista por gerente ou usuário autorizado.</p>
          <Button className="mt-5 w-full" onClick={onAuthorize}><ShieldCheck className="h-4 w-4" /> Entrar como gestor (demonstração)</Button>
        </section>
      </div>
    );
  }

  const setStatus = (status: ReceivingStatus, message: string, patch: Partial<Receiving> = {}) => { onChange({ ...receiving, ...patch, status }); notify(message); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para recebimentos"><ArrowLeft className="h-5 w-5" /></Button><div><h2 className="text-xl font-extrabold sm:text-2xl">Resultado da conferência</h2><p className="text-sm text-muted-foreground">{receiving.id} · {receiving.supplier} · NF {receiving.invoice}</p></div></div>
        <AlertPill label={receiving.status} tone={statusTone[receiving.status]} />
      </div>

      <div className="flex items-center gap-2 rounded-md bg-primary-soft p-3 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Visualização de usuário autorizado</div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={UserRound} label="Conferente" value={receiving.employee} />
        <Summary icon={Clock3} label="Data e horário" value={`${receiving.date} · ${receiving.time}`} />
        <Summary icon={Clock3} label="Duração" value={formatDuration(receiving.durationMinutes)} />
        <Summary icon={ClipboardCheck} label="Divergências" value={String(divergent.length)} tone={divergent.length ? "critical" : "positive"} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">{["Produto", "Esperado", "Contado", "Falta", "Sobra", "Ocorrências"].map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}</tr></thead>
          <tbody>{lines.map((line) => (
            <tr key={line.barcode} className={cn("border-b border-border last:border-0", line.refused && "opacity-60")}>
              <td className="px-3 py-3"><strong className="block">{line.product}</strong><span className="font-mono text-xs text-muted-foreground">{line.barcode}</span></td>
              <td className="px-3 py-3">{line.notRequested ? "—" : `${line.expected.toLocaleString("pt-BR")} ${unitShort[line.unit]}`}</td>
              <td className="px-3 py-3 font-bold">{line.counted.toLocaleString("pt-BR")} {unitShort[line.unit]}</td>
              <td className={cn("px-3 py-3", line.missing > 0 && "font-bold text-critical")}>{line.missing > 0 ? line.missing.toLocaleString("pt-BR") : "—"}</td>
              <td className={cn("px-3 py-3", line.surplus > 0 && "font-bold text-warning")}>{line.surplus > 0 ? line.surplus.toLocaleString("pt-BR") : "—"}</td>
              <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">
                {line.refused && <AlertPill label="Recusado" tone="critical" />}
                {line.notRequested && <AlertPill label="Produto não solicitado" tone="warning" />}
                {line.damaged > 0 && <AlertPill label={`Danificado: ${line.damaged}`} tone="critical" />}
                {line.lotMismatch && <AlertPill label="Lote divergente" tone="warning" />}
                {line.badExpiry && <AlertPill label="Validade inadequada" tone="critical" />}
                {!lineHasDivergence(line) && !line.refused && <AlertPill label="Conferido" tone="positive" />}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {receiving.approvedWithDivergence && !closed && <p className="rounded-md bg-warning-soft p-3 text-sm font-semibold">Divergências aprovadas pelo gestor. O recebimento já pode ser finalizado.</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:justify-end">
        <Button variant="outline" disabled={closed || divergent.length === 0 || receiving.approvedWithDivergence} onClick={() => setStatus("Aguardando aprovação", "Divergências aprovadas.", { approvedWithDivergence: true })}><CheckCircle2 className="h-4 w-4" /> Aprovar com divergência</Button>
        <Button variant="outline" disabled={closed} onClick={() => { onChange({ ...receiving, status: "Em conferência", counted: [], approvedWithDivergence: false, refusedBarcodes: [], attempts: receiving.attempts + 1 }); notify(`Recontagem de ${receiving.id} solicitada.`); onRecount(); }}><RotateCcw className="h-4 w-4" /> Solicitar recontagem</Button>
        <Button variant="outline" disabled={closed} onClick={() => setRefuseOpen(true)}><Ban className="h-4 w-4" /> Recusar produto</Button>
        <Button disabled={!canFinish} onClick={() => setStatus("Finalizado", `${receiving.id} finalizado e estoque atualizado (simulação).`)}><ClipboardCheck className="h-4 w-4" /> Finalizar recebimento</Button>
      </div>
      {!canFinish && !closed && <p className="text-right text-sm text-muted-foreground">Para finalizar com divergências, aprove-as ou solicite recontagem.</p>}

      {refuseOpen && (
        <Modal title="Recusar produto" description="Selecione o item que será devolvido ao fornecedor." onClose={() => setRefuseOpen(false)}>
          <div className="space-y-2">
            {lines.map((line) => <button key={line.barcode} type="button" disabled={line.refused} onClick={() => { const refusedBarcodes = [...receiving.refusedBarcodes, line.barcode]; const allRefused = lines.every((item) => refusedBarcodes.includes(item.barcode)); onChange({ ...receiving, refusedBarcodes, status: allRefused ? "Recusado" : receiving.status }); setRefuseOpen(false); notify(`${line.product} recusado.`); }} className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left text-sm hover:border-critical/50 disabled:opacity-50"><span className="font-semibold">{line.product}</span>{line.refused ? <AlertPill label="Recusado" tone="critical" /> : <Ban className="h-4 w-4 text-critical" />}</button>)}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string; tone?: Tone }) {
  return <div className="rounded-lg border border-border bg-card p-3.5 shadow-card"><span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:text-sm"><Icon className="h-4 w-4" />{label}</span><strong className={cn("mt-1 block truncate text-base font-extrabold sm:text-lg", tone === "critical" && "text-critical", tone === "positive" && "text-success")}>{value}</strong></div>;
}
