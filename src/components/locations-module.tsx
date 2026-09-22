import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  LayoutGrid,
  MapPin,
  Pencil,
  Plus,
  Power,
  Search,
  Settings2,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPill, EmptyState, Modal } from "@/components/dashboard-ui";
import type { Market } from "@/data/markets";
import {
  addressLabel,
  movementTypes,
  shelfState,
  usedCapacity,
  type Gondola,
  type Movement,
  type MovementType,
  type ShelfPosition,
  type ShelfState,
  type WarehouseAddress,
} from "@/data/locations";
import { expiryLevel, formatDate } from "@/data/products";
import { cn } from "@/lib/utils";

export type LocationsView = "Depósito" | "Gôndolas" | "Movimentações";
const views: Array<{ id: LocationsView; icon: typeof Warehouse }> = [
  { id: "Depósito", icon: Warehouse },
  { id: "Gôndolas", icon: LayoutGrid },
  { id: "Movimentações", icon: ArrowRightLeft },
];

const inputClass = "h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-critical";
const selectClass = `${inputClass} appearance-none`;

const stateStyle: Record<ShelfState, { label: string; box: string; dot: string }> = {
  normal: { label: "Quantidade normal", box: "border-success/40 bg-highlight-soft", dot: "bg-success" },
  near: { label: "Próximo do mínimo", box: "border-warning/60 bg-warning-soft", dot: "bg-warning" },
  below: { label: "Abaixo do mínimo", box: "border-critical/50 bg-critical/10", dot: "bg-critical" },
  empty: { label: "Vazia ou desativada", box: "border-border bg-muted", dot: "bg-muted-foreground" },
};

export type LocationsData = { addresses: WarehouseAddress[]; gondolas: Gondola[]; movements: Movement[] };

type LocationsModuleProps = {
  data: LocationsData;
  onChange: (data: LocationsData) => void;
  market: Market;
  markets: Market[];
  notify: (message: string) => void;
  initialView?: LocationsView | undefined;
};

export function LocationsModule({ data, onChange, market, markets, notify, initialView = "Depósito" }: LocationsModuleProps) {
  const [view, setView] = useState<LocationsView>(initialView);
  const { addresses, gondolas, movements } = data;
  const setAddresses = (next: WarehouseAddress[]) => onChange({ ...data, addresses: next });
  const setGondolas = (next: Gondola[]) => onChange({ ...data, gondolas: next });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">Estrutura física e localização</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mapeamento do depósito e da área de vendas de {market.name}</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Estrutura física">
          {views.map(({ id, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition", view === id ? "bg-brand-panel text-sidebar-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <Icon className="hidden h-4 w-4 sm:block" />{id}
            </button>
          ))}
        </div>
      </div>

      {view === "Depósito" && <WarehouseView addresses={addresses} onChange={setAddresses} notify={notify} />}
      {view === "Gôndolas" && <GondolasView gondolas={gondolas} onChange={setGondolas} notify={notify} />}
      {view === "Movimentações" && <MovementsView market={market} markets={markets} addresses={addresses} gondolas={gondolas} movements={movements} onRegister={(movement) => { onChange({ ...data, movements: [movement, ...movements] }); notify(`Movimentação de ${movement.quantity} ${movement.unit} de ${movement.product} registrada.`); }} />}
    </div>
  );
}

/* ---------------------------------- Depósito ---------------------------------- */

function WarehouseView({ addresses, onChange, notify }: { addresses: WarehouseAddress[]; onChange: (addresses: WarehouseAddress[]) => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [street, setStreet] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<WarehouseAddress | null>(null);
  const [editing, setEditing] = useState<{ address: WarehouseAddress; isNew: boolean } | null>(null);

  const streets = useMemo(() => [...new Set(addresses.map((item) => item.street))].sort(), [addresses]);
  const filtered = addresses.filter((item) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const text = `${addressLabel(item)} ${item.sector} ${item.items.map((stored) => stored.product).join(" ")}`.toLocaleLowerCase("pt-BR");
    return (!normalized || text.includes(normalized)) && (street === "all" || item.street === street) && (status === "all" || (status === "active" ? item.active : !item.active));
  });

  const totals = addresses.reduce((sum, item) => ({ capacity: sum.capacity + (item.active ? item.capacity : 0), used: sum.used + usedCapacity(item), empty: sum.empty + Number(item.active && usedCapacity(item) === 0), inactive: sum.inactive + Number(!item.active) }), { capacity: 0, used: 0, empty: 0, inactive: 0 });

  function saveAddress(address: WarehouseAddress, isNew: boolean) {
    onChange(isNew ? [...addresses, address] : addresses.map((item) => (item.id === address.id ? address : item)));
    setEditing(null);
    setSelected(null);
    notify(isNew ? `Endereço ${addressLabel(address)} criado.` : "Endereço atualizado.");
  }

  function toggle(address: WarehouseAddress) {
    const next = { ...address, active: !address.active };
    onChange(addresses.map((item) => (item.id === address.id ? next : item)));
    setSelected(next);
    notify(next.active ? "Endereço reativado." : "Endereço desativado.");
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Endereços cadastrados" value={String(addresses.length)} />
        <Stat label="Ocupação do depósito" value={`${Math.round((totals.used / Math.max(1, totals.capacity)) * 100)}%`} detail={`${totals.used} de ${totals.capacity} volumes`} />
        <Stat label="Endereços vazios" value={String(totals.empty)} />
        <Stat label="Endereços desativados" value={String(totals.inactive)} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar endereços" placeholder="Buscar endereço, setor ou produto" className={cn(inputClass, "pl-10")} /></div>
          <select value={street} onChange={(event) => setStreet(event.target.value)} aria-label="Filtrar por rua" className={selectClass}><option value="all">Todas as ruas</option>{streets.map((item) => <option key={item} value={item}>Rua {item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status" className={selectClass}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Desativados</option></select>
          <Button onClick={() => setEditing({ address: { id: `a-${Date.now()}`, warehouse: "Depósito 1", sector: "", street: "", aisle: "", shelf: "", level: "", position: "", capacity: 40, items: [], active: true, lastMovement: "Sem movimentação" }, isNew: true })}><Plus className="h-4 w-4" /> Novo endereço</Button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState icon={MapPin} title="Nenhum endereço encontrado" description="Revise a busca ou os filtros." /> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((item) => {
            const used = usedCapacity(item);
            const percent = Math.round((used / Math.max(1, item.capacity)) * 100);
            return (
              <button key={item.id} type="button" onClick={() => setSelected(item)} className={cn("rounded-lg border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/60", item.active ? "border-border" : "border-dashed border-border opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.sector || "Sem setor"} · Corredor {item.aisle}</span><strong className="mt-1 block text-sm leading-snug">{addressLabel(item)}</strong></div>
                  <AlertPill label={item.active ? "Ativo" : "Desativado"} tone={item.active ? "positive" : "neutral"} />
                </div>
                <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>{used} de {item.capacity} volumes</span><span className={cn(percent >= 90 ? "text-critical" : "text-muted-foreground")}>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", percent >= 90 ? "bg-critical" : percent >= 70 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, percent)}%` }} /></div></div>
                <p className="mt-3 truncate text-sm text-muted-foreground">{item.items.length ? item.items.map((stored) => stored.product).join(", ") : "Endereço vazio"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Última movimentação: {item.lastMovement}</p>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <Modal title="Detalhes do endereço" description={addressLabel(selected)} onClose={() => setSelected(null)} wide footer={<><Button variant="outline" onClick={() => toggle(selected)}><Power className="h-4 w-4" /> {selected.active ? "Desativar" : "Reativar"}</Button><Button onClick={() => setEditing({ address: selected, isNew: false })}><Pencil className="h-4 w-4" /> Editar endereço</Button></>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Capacidade" value={String(selected.capacity)} />
            <Stat label="Espaço utilizado" value={String(usedCapacity(selected))} />
            <Stat label="Espaço disponível" value={String(Math.max(0, selected.capacity - usedCapacity(selected)))} />
            <Stat label="Status" value={selected.active ? "Ativo" : "Desativado"} />
          </div>
          <h4 className="mt-5 font-bold">Produtos armazenados</h4>
          {selected.items.length === 0 ? <p className="mt-2 rounded-md bg-muted p-4 text-sm text-muted-foreground">Nenhum produto neste endereço.</p> : (
            <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3">Qtd.</th><th className="py-2 pr-3">Lote</th><th className="py-2">Validade</th></tr></thead><tbody>{selected.items.map((stored) => { const level = expiryLevel(stored.expiresAt); return <tr key={`${stored.product}-${stored.lot}`} className="border-b border-border last:border-0"><td className="py-2.5 pr-3 font-semibold">{stored.product}</td><td className="py-2.5 pr-3">{stored.quantity} {stored.unit}</td><td className="py-2.5 pr-3">{stored.lot}</td><td className="py-2.5"><span className="mr-2">{formatDate(stored.expiresAt)}</span><AlertPill label={level} tone={level === "Vencido" || level === "30 dias" ? "critical" : level === "Em dia" ? "positive" : "warning"} /></td></tr>; })}</tbody></table></div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Última movimentação: <strong className="text-foreground">{selected.lastMovement}</strong></p>
        </Modal>
      )}

      {editing && <AddressForm initial={editing.address} isNew={editing.isNew} existing={addresses} onCancel={() => setEditing(null)} onSave={saveAddress} />}
    </div>
  );
}

function AddressForm({ initial, isNew, existing, onCancel, onSave }: { initial: WarehouseAddress; isNew: boolean; existing: WarehouseAddress[]; onCancel: () => void; onSave: (address: WarehouseAddress, isNew: boolean) => void }) {
  const [address, setAddress] = useState(initial);
  const [error, setError] = useState("");
  const fields: Array<[keyof WarehouseAddress, string, string]> = [["warehouse", "Depósito", "Depósito 1"], ["sector", "Setor", "Mercearia"], ["street", "Rua", "B"], ["aisle", "Corredor", "02"], ["shelf", "Estante", "03"], ["level", "Nível", "02"], ["position", "Posição", "04"]];

  function submit() {
    if (fields.some(([key]) => !String(address[key]).trim())) { setError("Preencha todos os campos do endereço."); return; }
    if (address.capacity < usedCapacity(address)) { setError("A capacidade não pode ser menor que o espaço utilizado."); return; }
    const duplicate = existing.some((item) => item.id !== address.id && addressLabel(item) === addressLabel(address));
    if (duplicate) { setError("Já existe um endereço com essa combinação."); return; }
    onSave({ ...address, street: address.street.toUpperCase() }, isNew);
  }

  return (
    <Modal title={isNew ? "Novo endereço" : "Editar endereço"} description="Exemplo: Depósito 1 / Rua B / Estante 03 / Nível 02 / Posição 04" onClose={onCancel} footer={<><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={submit}><CheckCircle2 className="h-4 w-4" /> Salvar endereço</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([key, label, placeholder]) => <Field key={key} label={label}><input value={String(address[key])} onChange={(event) => { setAddress((current) => ({ ...current, [key]: event.target.value })); setError(""); }} maxLength={30} placeholder={placeholder} className={inputClass} /></Field>)}
        <Field label="Capacidade (volumes)"><input type="number" min="1" value={address.capacity} onChange={(event) => { setAddress((current) => ({ ...current, capacity: Math.max(1, Number(event.target.value) || 1) })); setError(""); }} className={inputClass} /></Field>
      </div>
      <p className="mt-4 rounded-md bg-primary-soft p-3 text-sm font-semibold text-primary">{addressLabel(address)}</p>
      {error && <p className="mt-3 text-sm font-semibold text-critical" role="alert">{error}</p>}
    </Modal>
  );
}

/* ---------------------------------- Gôndolas ---------------------------------- */

function GondolasView({ gondolas, onChange, notify }: { gondolas: Gondola[]; onChange: (gondolas: Gondola[]) => void; notify: (message: string) => void }) {
  const [gondolaId, setGondolaId] = useState(gondolas[0]?.id ?? "");
  const [selected, setSelected] = useState<{ shelf: number; position: ShelfPosition } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const gondola = gondolas.find((item) => item.id === gondolaId) ?? gondolas[0];
  if (!gondola) return <EmptyState icon={LayoutGrid} title="Nenhuma gôndola cadastrada" description="Cadastre a primeira gôndola da área de vendas." />;

  const all = gondola.shelves.flat();
  const counts = { normal: 0, near: 0, below: 0, empty: 0 } as Record<ShelfState, number>;
  all.forEach((position) => { counts[shelfState(position)] += 1; });

  function updateGondola(next: Gondola) { onChange(gondolas.map((item) => (item.id === next.id ? next : item))); }

  function savePosition(shelfIndex: number, position: ShelfPosition) {
    if (!gondola) return;
    updateGondola({ ...gondola, shelves: gondola.shelves.map((shelf, index) => (index === shelfIndex ? shelf.map((item) => (item.id === position.id ? position : item)) : shelf)) });
    setSelected(null);
    notify("Limites da posição atualizados.");
  }

  function addShelf() {
    if (!gondola) return;
    const shelfNumber = gondola.shelves.length + 1;
    const positions = Array.from({ length: Math.max(1, gondola.modules * 2) }, (_, index): ShelfPosition => ({ id: `${gondola.id}-${shelfNumber}-${index + 1}-${Date.now()}`, module: Math.floor(index / 2) + 1, position: (index % 2) + 1, product: null, quantity: 0, min: 0, ideal: 0, max: 0, capacity: 0, faces: 1, priority: "Baixa", active: false }));
    updateGondola({ ...gondola, shelves: [...gondola.shelves, positions] });
    notify(`Prateleira ${shelfNumber} adicionada.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={gondola.id} onChange={(event) => { setGondolaId(event.target.value); setSelected(null); }} aria-label="Selecionar gôndola" className={cn(selectClass, "sm:w-64")}>{gondolas.map((item) => <option key={item.id} value={item.id}>Gôndola {item.number} · {item.sector}</option>)}</select>
          <span className="text-sm text-muted-foreground">Setor <strong className="text-foreground">{gondola.sector}</strong> · Corredor <strong className="text-foreground">{gondola.aisle}</strong> · Lado <strong className="text-foreground">{gondola.side}</strong> · {gondola.modules} módulos</span>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={addShelf}><Plus className="h-4 w-4" /> Prateleira</Button><Button variant="outline" onClick={() => setConfigOpen(true)}><Settings2 className="h-4 w-4" /> Configurar gôndola</Button></div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {(Object.keys(stateStyle) as ShelfState[]).map((state) => <span key={state} className="inline-flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", stateStyle[state].dot)} />{stateStyle[state].label} <strong>({counts[state]})</strong></span>)}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="min-w-[640px]">
          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `90px repeat(${gondola.modules}, minmax(0, 1fr))` }}>
            <span />
            {Array.from({ length: gondola.modules }, (_, index) => <span key={index} className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Módulo {index + 1}</span>)}
          </div>
          <div className="space-y-3 rounded-md border-x-8 border-brand-panel/80 bg-muted/60 p-3">
            {gondola.shelves.map((shelf, shelfIndex) => (
              <div key={shelfIndex} className="grid items-stretch gap-2" style={{ gridTemplateColumns: `78px repeat(${gondola.modules}, minmax(0, 1fr))` }}>
                <span className="flex items-center text-xs font-bold text-muted-foreground">Prateleira {shelfIndex + 1}</span>
                {Array.from({ length: gondola.modules }, (_, moduleIndex) => (
                  <div key={moduleIndex} className="flex gap-2 border-b-4 border-brand-panel/70 pb-2">
                    {shelf.filter((position) => position.module === moduleIndex + 1).map((position) => {
                      const state = shelfState(position);
                      return (
                        <button key={position.id} type="button" onClick={() => setSelected({ shelf: shelfIndex, position })} aria-label={`Prateleira ${shelfIndex + 1}, posição ${position.position}: ${position.product ?? "vazia"}, ${stateStyle[state].label}`} className={cn("min-h-[84px] min-w-0 flex-1 rounded-md border-2 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring", stateStyle[state].box)}>
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", stateStyle[state].dot)} />P{position.position} · {position.faces} {position.faces === 1 ? "face" : "faces"}</span>
                          <strong className="mt-1 line-clamp-2 block text-xs leading-snug">{position.product ?? (position.active ? "Sem produto" : "Desativada")}</strong>
                          {position.product && <span className="mt-1 block text-xs font-semibold">{position.quantity}/{position.ideal} <span className="font-normal text-muted-foreground">mín. {position.min}</span></span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && <PositionEditor shelfIndex={selected.shelf} position={selected.position} gondola={gondola} onClose={() => setSelected(null)} onSave={(position) => savePosition(selected.shelf, position)} />}
      {configOpen && <GondolaConfig gondola={gondola} onClose={() => setConfigOpen(false)} onSave={(next) => { updateGondola(next); setConfigOpen(false); notify(`Gôndola ${next.number} atualizada.`); }} />}
    </div>
  );
}

function PositionEditor({ shelfIndex, position, gondola, onClose, onSave }: { shelfIndex: number; position: ShelfPosition; gondola: Gondola; onClose: () => void; onSave: (position: ShelfPosition) => void }) {
  const [draft, setDraft] = useState(position);
  const [error, setError] = useState("");
  const state = shelfState(draft);
  const set = <K extends keyof ShelfPosition>(key: K, value: ShelfPosition[K]) => { setDraft((current) => ({ ...current, [key]: value })); setError(""); };
  const numberInput = (key: "quantity" | "min" | "ideal" | "max" | "capacity" | "faces", label: string) => <Field label={label}><input type="number" min="0" value={draft[key]} onChange={(event) => set(key, Math.max(0, Number(event.target.value) || 0))} className={inputClass} /></Field>;

  function submit() {
    if (draft.active && draft.product) {
      if (!(draft.min <= draft.ideal && draft.ideal <= draft.max)) { setError("Use mínimo ≤ ideal ≤ máximo."); return; }
      if (draft.max > draft.capacity) { setError("O máximo não pode ultrapassar a capacidade física."); return; }
      if (draft.faces < 1) { setError("Informe ao menos uma face."); return; }
    }
    onSave({ ...draft, product: draft.product?.trim() ? draft.product.trim() : null });
  }

  return (
    <Modal title={`Gôndola ${gondola.number} · Prateleira ${shelfIndex + 1} · Posição ${position.position}`} description={`Setor ${gondola.sector} · Corredor ${gondola.aisle} · Lado ${gondola.side} · Módulo ${position.module}`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit}><CheckCircle2 className="h-4 w-4" /> Salvar limites</Button></>}>
      <div className={cn("mb-4 flex items-center gap-2 rounded-md border-2 p-3 text-sm font-semibold", stateStyle[state].box)}><span className={cn("h-2.5 w-2.5 rounded-full", stateStyle[state].dot)} />{stateStyle[state].label}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Produto vinculado"><input value={draft.product ?? ""} onChange={(event) => set("product", event.target.value)} maxLength={120} placeholder="Nome do produto" className={inputClass} /></Field></div>
        {numberInput("quantity", "Quantidade atual")}
        {numberInput("faces", "Frentes (faces)")}
        {numberInput("min", "Quantidade mínima")}
        {numberInput("ideal", "Quantidade ideal")}
        {numberInput("max", "Quantidade máxima")}
        {numberInput("capacity", "Capacidade física")}
        <Field label="Prioridade de reposição"><select value={draft.priority} onChange={(event) => set("priority", event.target.value as ShelfPosition["priority"])} className={selectClass}><option>Alta</option><option>Média</option><option>Baixa</option></select></Field>
        <label className="flex items-center gap-3 self-end rounded-md border border-border p-3 text-sm font-semibold"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} className="h-4 w-4 accent-primary" /> Posição ativa</label>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-critical" role="alert">{error}</p>}
    </Modal>
  );
}

function GondolaConfig({ gondola, onClose, onSave }: { gondola: Gondola; onClose: () => void; onSave: (gondola: Gondola) => void }) {
  const [draft, setDraft] = useState({ sector: gondola.sector, aisle: gondola.aisle, number: gondola.number, side: gondola.side });
  const valid = draft.sector.trim() && draft.aisle.trim() && draft.number.trim();
  return (
    <Modal title={`Configurar gôndola ${gondola.number}`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!valid} onClick={() => onSave({ ...gondola, ...draft })}><CheckCircle2 className="h-4 w-4" /> Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Setor"><input value={draft.sector} onChange={(event) => setDraft((current) => ({ ...current, sector: event.target.value }))} maxLength={40} className={inputClass} /></Field>
        <Field label="Corredor"><input value={draft.aisle} onChange={(event) => setDraft((current) => ({ ...current, aisle: event.target.value }))} maxLength={10} className={inputClass} /></Field>
        <Field label="Número da gôndola"><input value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} maxLength={10} className={inputClass} /></Field>
        <Field label="Lado"><select value={draft.side} onChange={(event) => setDraft((current) => ({ ...current, side: event.target.value as Gondola["side"] }))} className={selectClass}><option value="A">Lado A</option><option value="B">Lado B</option></select></Field>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{gondola.modules} módulos · {gondola.shelves.length} prateleiras · {gondola.shelves.flat().length} posições</p>
    </Modal>
  );
}

/* -------------------------------- Movimentações -------------------------------- */

function MovementsView({ market, markets, addresses, gondolas, movements, onRegister }: { market: Market; markets: Market[]; addresses: WarehouseAddress[]; gondolas: Gondola[]; movements: Movement[]; onRegister: (movement: Movement) => void }) {
  const [type, setType] = useState<MovementType>("Depósito → Gôndola");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("un.");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");

  const activeAddresses = addresses.filter((item) => item.active).map((item) => addressLabel(item));
  const gondolaPositions = gondolas.flatMap((gondola) => gondola.shelves.flatMap((shelf, shelfIndex) => shelf.filter((position) => position.active).map((position) => `Gôndola ${gondola.number} · Prateleira ${shelfIndex + 1} · Módulo ${position.module} · Posição ${position.position}`)));
  const otherMarkets = markets.filter((item) => item.id !== market.id).map((item) => item.name);
  const receivings = ["Recebimento REC-2045", "Recebimento REC-2044", "Recebimento REC-2041"];

  const options: Record<MovementType, [string[], string[]]> = {
    "Recebimento → Depósito": [receivings, activeAddresses],
    "Endereço → Endereço": [activeAddresses, activeAddresses],
    "Depósito → Gôndola": [activeAddresses, gondolaPositions],
    "Mercado → Mercado": [[market.name], otherMarkets],
  };
  const [origins, destinations] = options[type].map((list) => [...new Set(list)]) as [string[], string[]];
  const productSuggestions = [...new Set(addresses.flatMap((item) => item.items.map((stored) => stored.product)))];

  function submit() {
    if (!product.trim()) { setError("Informe o produto."); return; }
    if (quantity <= 0) { setError("Informe uma quantidade maior que zero."); return; }
    if (!origin || !destination) { setError("Selecione a origem e o destino."); return; }
    if (origin === destination) { setError("A origem e o destino precisam ser diferentes."); return; }
    const now = new Date();
    onRegister({ id: `m-${Date.now()}`, type, product: product.trim(), quantity, unit, origin, destination, user: "Marina Alves", time: `Hoje, ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
    setProduct(""); setQuantity(1); setOrigin(""); setDestination(""); setError("");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-border bg-card p-5 shadow-card">
        <h3 className="font-extrabold">Nova movimentação</h3>
        <p className="mt-1 text-sm text-muted-foreground">Transferências simuladas entre locais</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {movementTypes.map((item) => <button key={item} type="button" onClick={() => { setType(item); setOrigin(""); setDestination(""); setError(""); }} aria-pressed={type === item} className={cn("rounded-md border p-2.5 text-left text-xs font-bold transition sm:text-sm", type === item ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:border-primary/40")}>{item}</button>)}
        </div>
        <div className="mt-4 space-y-3">
          <Field label="Produto"><input list="movement-products" value={product} onChange={(event) => { setProduct(event.target.value); setError(""); }} maxLength={120} placeholder="Digite ou selecione" className={inputClass} /><datalist id="movement-products">{productSuggestions.map((item) => <option key={item} value={item} />)}</datalist></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade"><input type="number" min="1" value={quantity} onChange={(event) => { setQuantity(Math.max(0, Number(event.target.value) || 0)); setError(""); }} className={inputClass} /></Field>
            <Field label="Embalagem"><select value={unit} onChange={(event) => setUnit(event.target.value)} className={selectClass}><option value="un.">Unidade</option><option value="pct">Pacote</option><option value="cx">Caixa</option><option value="fd">Fardo</option><option value="kg">Quilograma</option><option value="L">Litro</option></select></Field>
          </div>
          <Field label="Origem"><select value={origin} onChange={(event) => { setOrigin(event.target.value); setError(""); }} className={selectClass}><option value="">Selecione</option>{origins.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Destino"><select value={destination} onChange={(event) => { setDestination(event.target.value); setError(""); }} className={selectClass}><option value="">Selecione</option>{destinations.map((item) => <option key={item}>{item}</option>)}</select></Field>
          {destinations.length === 0 && <p className="text-sm text-muted-foreground">Não há destinos disponíveis para este tipo.</p>}
          {error && <p className="text-sm font-semibold text-critical" role="alert">{error}</p>}
          <Button className="w-full" onClick={submit}><ArrowRightLeft className="h-4 w-4" /> Registrar movimentação</Button>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-card">
        <h3 className="font-extrabold">Histórico de movimentações</h3>
        <p className="mt-1 text-sm text-muted-foreground">{movements.length} registros nesta sessão</p>
        <ol className="mt-4 space-y-3">
          {movements.map((movement) => (
            <li key={movement.id} className="rounded-md border border-border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><AlertPill label={movement.type} tone="neutral" /><span className="text-xs font-semibold text-muted-foreground">{movement.time} · {movement.user}</span></div>
              <strong className="mt-2 block text-sm">{movement.quantity} {movement.unit} · {movement.product}</strong>
              <div className="mt-1.5 grid gap-1 text-sm text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-2"><span className="font-semibold">De:</span><span className="break-words">{movement.origin}</span><span className="font-semibold">Para:</span><span className="break-words">{movement.destination}</span></div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-lg border border-border bg-card p-3.5 shadow-card"><span className="block text-xs font-semibold text-muted-foreground sm:text-sm">{label}</span><strong className="mt-1 block text-xl font-extrabold">{value}</strong>{detail && <span className="block text-xs text-muted-foreground">{detail}</span>}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-semibold">{label}</span>{children}</label>;
}

