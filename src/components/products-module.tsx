import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  Copy,
  Download,
  Eye,
  ImagePlus,
  MoreVertical,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertPill, EmptyState, type Tone } from "@/components/dashboard-ui";
import type { Market } from "@/data/markets";
import {
  brl,
  categories,
  daysUntil,
  expiryLevel,
  formatDate,
  nearestLot,
  packagingUnits,
  stockLevel,
  suppliers,
  type ExpiryLevel,
  type Lot,
  type Packaging,
  type PackagingUnit,
  type Product,
  type StockLevel,
} from "@/data/products";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-critical";
const selectClass = `${inputClass} appearance-none`;

const expiryTone: Record<ExpiryLevel, Tone> = { Vencido: "critical", "30 dias": "critical", "60 dias": "warning", "90 dias": "warning", "Em dia": "positive", "Sem validade": "neutral" };
const stockTone: Record<StockLevel, Tone> = { "Sem estoque": "critical", "Abaixo do mínimo": "warning", Normal: "positive", "Acima do máximo": "neutral" };

const plural: Record<PackagingUnit, [string, string]> = {
  Unidade: ["unidade", "unidades"],
  Pacote: ["pacote", "pacotes"],
  Caixa: ["caixa", "caixas"],
  Fardo: ["fardo", "fardos"],
  Quilograma: ["quilograma", "quilogramas"],
  Litro: ["litro", "litros"],
};
export const packagingLabel = (unit: PackagingUnit, quantity: number) => (quantity === 1 ? plural[unit][0] : plural[unit][1]);

type ProductsModuleProps = {
  markets: Market[];
  products: Product[];
  onChange: (products: Product[]) => void;
  notify: (message: string) => void;
  /** Quando informado, o módulo trabalha somente com este mercado. */
  fixedMarketId?: string | undefined;
  initialExpiryFilter?: ExpiryFilter | undefined;
  title?: string | undefined;
};

type ExpiryFilter = "all" | "expired" | "30" | "60" | "90";

export function ProductsModule({ markets, products, onChange, notify, fixedMarketId, initialExpiryFilter = "all", title = "Produtos" }: ProductsModuleProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [stock, setStock] = useState("all");
  const [expiry, setExpiry] = useState<ExpiryFilter>(initialExpiryFilter);
  const [market, setMarket] = useState(fixedMarketId ?? "all");
  const [editing, setEditing] = useState<{ product: Product; isNew: boolean; tab: FormTab } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const scoped = useMemo(() => products.filter((product) => market === "all" || product.marketId === market), [products, market]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return scoped.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.barcode} ${product.sku} ${product.brand}`.toLocaleLowerCase("pt-BR").includes(normalized);
      const matchesExpiry = expiry === "all" || (expiry === "expired" && product.lots.some((item) => expiryLevel(item.expiresAt) === "Vencido")) || (expiry !== "expired" && product.lots.some((item) => { const days = daysUntil(item.expiresAt); const limit = Number(expiry); return days >= 0 && days <= limit && days > limit - 30; }));
      return matchesQuery && (category === "all" || product.category === category) && (supplier === "all" || product.supplier === supplier) && (stock === "all" || stockLevel(product) === stock) && matchesExpiry;
    });
  }, [scoped, query, category, supplier, stock, expiry]);

  const expirySummary = useMemo(() => {
    const lots = scoped.flatMap((product) => product.lots);
    const count = (predicate: (days: number) => boolean) => lots.filter((item) => predicate(daysUntil(item.expiresAt))).length;
    return { expired: count((days) => days < 0), d30: count((days) => days >= 0 && days <= 30), d60: count((days) => days > 30 && days <= 60), d90: count((days) => days > 60 && days <= 90) };
  }, [scoped]);

  const marketName = (id: string) => markets.find((item) => item.id === id)?.name ?? "—";
  const hasFilters = query || category !== "all" || supplier !== "all" || stock !== "all" || expiry !== "all" || (!fixedMarketId && market !== "all");

  function save(product: Product, isNew: boolean) {
    onChange(isNew ? [...products, product] : products.map((item) => (item.id === product.id ? product : item)));
    setEditing(null);
    notify(isNew ? `${product.name} cadastrado.` : `${product.name} atualizado.`);
  }

  function exportCsv() {
    const header = ["Código de barras", "SKU", "Nome", "Marca", "Categoria", "Fornecedor", "Mercado", "Estoque", "Estoque mínimo", "Custo", "Preço de venda", "Status"];
    const rows = filtered.map((product) => [product.barcode, product.sku, product.name, product.brand, product.category, product.supplier, marketName(product.marketId), product.stock, product.minStock, product.cost.toFixed(2), product.price.toFixed(2), product.status]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "produtos-mercado-facil.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify(`${filtered.length} produtos exportados.`);
  }

  if (editing) {
    return <ProductForm key={editing.product.id} initial={editing.product} isNew={editing.isNew} initialTab={editing.tab} markets={markets} fixedMarketId={fixedMarketId} onCancel={() => setEditing(null)} onSave={save} />;
  }

  const newProduct = () => setEditing({ product: blankProduct(fixedMarketId ?? (market !== "all" ? market : markets[0]?.id ?? "central")), isNew: true, tab: "Informações" });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{fixedMarketId ? `Catálogo e estoque de ${marketName(fixedMarketId)}` : "Catálogo, estoque, lotes e validades de toda a rede"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Importar produtos</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar</Button>
          <Button className="col-span-2 sm:col-auto" onClick={newProduct}><PackagePlus className="h-4 w-4" /> Cadastrar produto</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExpiryCard label="Lotes vencidos" value={expirySummary.expired} tone="critical" icon={CalendarX2} active={expiry === "expired"} onClick={() => setExpiry(expiry === "expired" ? "all" : "expired")} />
        <ExpiryCard label="Vencem em até 30 dias" value={expirySummary.d30} tone="critical" icon={AlertTriangle} active={expiry === "30"} onClick={() => setExpiry(expiry === "30" ? "all" : "30")} />
        <ExpiryCard label="Vencem em 31 a 60 dias" value={expirySummary.d60} tone="warning" icon={CalendarClock} active={expiry === "60"} onClick={() => setExpiry(expiry === "60" ? "all" : "60")} />
        <ExpiryCard label="Vencem em 61 a 90 dias" value={expirySummary.d90} tone="neutral" icon={CalendarClock} active={expiry === "90"} onClick={() => setExpiry(expiry === "90" ? "all" : "90")} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar produtos" placeholder="Buscar por nome, código de barras ou SKU" className={cn(inputClass, "pl-10")} />
        </div>
        <div className={cn("mt-3 grid gap-3 sm:grid-cols-2", fixedMarketId ? "lg:grid-cols-4" : "lg:grid-cols-5")}>
          <FilterSelect label="Categoria" value={category} onChange={setCategory} options={categories} />
          <FilterSelect label="Fornecedor" value={supplier} onChange={setSupplier} options={suppliers} />
          <FilterSelect label="Situação do estoque" value={stock} onChange={setStock} options={["Sem estoque", "Abaixo do mínimo", "Normal", "Acima do máximo"]} />
          <FilterSelect label="Validade" value={expiry} onChange={(value) => setExpiry(value as ExpiryFilter)} options={[["expired", "Vencidos"], ["30", "Vencem em até 30 dias"], ["60", "Vencem em 31 a 60 dias"], ["90", "Vencem em 61 a 90 dias"]]} />
          {!fixedMarketId && <FilterSelect label="Mercado" value={market} onChange={setMarket} options={markets.map((item) => [item.id, item.name] as [string, string])} />}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-muted-foreground">{filtered.length} {filtered.length === 1 ? "produto" : "produtos"}</span>
          {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all"); setSupplier("all"); setStock("all"); setExpiry("all"); if (!fixedMarketId) setMarket("all"); }}><X className="h-4 w-4" /> Limpar filtros</Button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto encontrado" description="Revise a busca ou os filtros selecionados." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-card lg:block">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  {["Foto", "Código de barras", "Nome", "Marca", "Categoria", "Estoque atual", "Estoque mín.", "Localização", "Lote mais próximo", "Custo", "Venda", "Status"].map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}<th className="sticky right-0 bg-card px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const lotItem = nearestLot(product);
                  const level = stockLevel(product);
                  return (
                    <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                      <td className="px-3 py-2.5"><ProductPhoto product={product} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs">{product.barcode}</td>
                      <td className="min-w-[180px] px-3 py-2.5"><strong className="block">{product.name}</strong><span className="text-xs text-muted-foreground">{product.sku}{!fixedMarketId && ` · ${marketName(product.marketId)}`}</span></td>
                      <td className="px-3 py-2.5">{product.brand}</td>
                      <td className="px-3 py-2.5">{product.category}</td>
                      <td className="px-3 py-2.5"><strong className={cn(level === "Sem estoque" || level === "Abaixo do mínimo" ? "text-critical" : "")}>{product.stock.toLocaleString("pt-BR")}</strong> <span className="text-xs text-muted-foreground">{packagingLabel(product.unit, product.stock)}</span></td>
                      <td className="px-3 py-2.5">{product.minStock.toLocaleString("pt-BR")}</td>
                      <td className="max-w-[180px] px-3 py-2.5 text-xs text-muted-foreground">{product.location}</td>
                      <td className="px-3 py-2.5"><LotBadge lot={lotItem} /></td>
                      <td className="px-3 py-2.5">{brl(product.cost)}</td>
                      <td className="px-3 py-2.5"><strong>{brl(product.promoPrice ?? product.price)}</strong>{product.promoPrice !== null && <span className="block text-xs text-muted-foreground line-through">{brl(product.price)}</span>}</td>
                      <td className="px-3 py-2.5"><div className="flex flex-col items-start gap-1"><AlertPill label={product.status} tone={product.status === "Ativo" ? "positive" : "neutral"} /><AlertPill label={level} tone={stockTone[level]} /></div></td>
                      <td className="sticky right-0 bg-card px-2 py-2.5 shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.25)]"><ProductActions product={product} onEdit={(tab) => setEditing({ product, isNew: false, tab })} onDuplicate={() => setEditing({ product: { ...product, id: `p-${Date.now()}`, name: `${product.name} (cópia)`, barcode: "", sku: `${product.sku}-C` }, isNew: true, tab: "Informações" })} onToggle={() => { onChange(products.map((item) => (item.id === product.id ? { ...item, status: item.status === "Ativo" ? "Inativo" : "Ativo" } : item))); notify(`${product.name} ${product.status === "Ativo" ? "desativado" : "ativado"}.`); }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((product) => {
              const level = stockLevel(product);
              return (
                <article key={product.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <ProductPhoto product={product} />
                    <div className="min-w-0 flex-1">
                      <strong className="block leading-snug">{product.name}</strong>
                      <span className="block text-xs text-muted-foreground">{product.brand} · {product.category}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{product.barcode}</span>
                    </div>
                    <ProductActions product={product} onEdit={(tab) => setEditing({ product, isNew: false, tab })} onDuplicate={() => setEditing({ product: { ...product, id: `p-${Date.now()}`, name: `${product.name} (cópia)`, barcode: "", sku: `${product.sku}-C` }, isNew: true, tab: "Informações" })} onToggle={() => { onChange(products.map((item) => (item.id === product.id ? { ...item, status: item.status === "Ativo" ? "Inativo" : "Ativo" } : item))); notify(`${product.name} ${product.status === "Ativo" ? "desativado" : "ativado"}.`); }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                    <div><dt className="text-xs font-semibold text-muted-foreground">Estoque atual / mín.</dt><dd className={cn("font-bold", (level === "Sem estoque" || level === "Abaixo do mínimo") && "text-critical")}>{product.stock} / {product.minStock}</dd></div>
                    <div><dt className="text-xs font-semibold text-muted-foreground">Custo / venda</dt><dd className="font-bold">{brl(product.cost)} / {brl(product.promoPrice ?? product.price)}</dd></div>
                    <div className="col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Localização</dt><dd>{product.location}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2"><LotBadge lot={nearestLot(product)} /><AlertPill label={level} tone={stockTone[level]} /><AlertPill label={product.status} tone={product.status === "Ativo" ? "positive" : "neutral"} /></div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {importOpen && <ImportPanel onClose={() => setImportOpen(false)} onImport={(name) => { setImportOpen(false); notify(`Arquivo "${name}" recebido. Importação simulada nesta demonstração.`); }} />}
    </div>
  );
}

function ExpiryCard({ label, value, tone, icon: Icon, active, onClick }: { label: string; value: number; tone: Tone; icon: typeof CalendarClock; active: boolean; onClick: () => void }) {
  const color = tone === "critical" ? "bg-critical/10 text-critical" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground";
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("flex items-center gap-3 rounded-lg border bg-card p-3.5 text-left shadow-card transition hover:border-primary/50", active ? "border-primary ring-2 ring-primary/20" : "border-border")}>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", color)}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0"><strong className="block text-xl font-extrabold">{value}</strong><span className="block text-xs font-semibold text-muted-foreground sm:text-sm">{label}</span></span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<string | [string, string]> }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cn(selectClass, "h-10 text-sm")}>
        <option value="all">Todos</option>
        {options.map((option) => { const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option]; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}
      </select>
    </label>
  );
}

function ProductPhoto({ product, size = "h-11 w-11" }: { product: Pick<Product, "photo" | "name" | "category">; size?: string }) {
  if (product.photo) return <img src={product.photo} alt={product.name} className={cn(size, "shrink-0 rounded-md border border-border object-cover")} />;
  const initials = product.name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "P";
  return <span className={cn(size, "grid shrink-0 place-items-center rounded-md bg-primary-soft text-sm font-extrabold text-primary")} aria-label={`Sem foto: ${product.name}`}>{initials}</span>;
}

function LotBadge({ lot }: { lot: Lot | undefined }) {
  if (!lot) return <span className="text-xs text-muted-foreground">Sem lote</span>;
  const level = expiryLevel(lot.expiresAt);
  const days = daysUntil(lot.expiresAt);
  return <div className="flex flex-col items-start gap-1"><span className="text-xs font-semibold">{lot.number} · {formatDate(lot.expiresAt)}</span><AlertPill label={days < 0 ? `Vencido há ${Math.abs(days)} d` : level === "Em dia" ? "Em dia" : `Vence em ${days} d`} tone={expiryTone[level]} /></div>;
}

function ProductActions({ product, onEdit, onDuplicate, onToggle }: { product: Product; onEdit: (tab: FormTab) => void; onDuplicate: () => void; onToggle: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${product.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onEdit("Informações")}><Pencil /> Editar produto</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit("Lotes e validade")}><Eye /> Ver lotes e validade</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit("Embalagens e conversões")}><Package /> Embalagens</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onToggle}><Power /> {product.status === "Ativo" ? "Desativar" : "Ativar"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ImportPanel({ onClose, onImport }: { onClose: () => void; onImport: (fileName: string) => void }) {
  const [file, setFile] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4" role="dialog" aria-modal="true" aria-label="Importar produtos">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">Importar produtos</h3><p className="mt-1 text-sm text-muted-foreground">Envie uma planilha CSV ou XLSX com o catálogo de produtos.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></Button></div>
        <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50">
          <Upload className="h-8 w-8 text-primary" />
          <strong className="text-sm">{file || "Selecionar arquivo"}</strong>
          <span className="text-xs text-muted-foreground">Colunas: código de barras, nome, marca, categoria, custo e preço</span>
          <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(event) => setFile(event.target.files?.[0]?.name ?? "")} />
        </label>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!file} onClick={() => onImport(file)}><Upload className="h-4 w-4" /> Importar</Button></div>
      </div>
    </div>
  );
}

/* ---------------------------------- Formulário ---------------------------------- */

const formTabs = ["Informações", "Embalagens e conversões", "Estoque", "Valores", "Lotes e validade"] as const;
type FormTab = (typeof formTabs)[number];

function blankProduct(marketId: string): Product {
  return {
    id: `p-${Date.now()}`, name: "", description: "", barcode: "", sku: "", brand: "", category: "", supplier: "", unit: "Unidade", weighable: false, photo: "",
    marketId, stock: 0, minStock: 0, idealStock: 0, maxStock: 0, reorderPoint: 0, allowNegative: false, lotControl: true, expiryControl: true, location: "", cost: 0, margin: 30, price: 0, promoPrice: null, promoStart: "", promoEnd: "", status: "Ativo",
    packagings: [], lots: [],
  };
}

const infoSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do produto").max(120),
  barcode: z.string().regex(/^\d{8,14}$/, "Use de 8 a 14 números"),
  sku: z.string().trim().min(2, "Informe o SKU").max(30),
  brand: z.string().trim().min(2, "Informe a marca").max(60),
  category: z.string().min(1, "Selecione a categoria"),
});
const stockSchema = z.object({ minStock: z.number().min(0), idealStock: z.number().min(0), maxStock: z.number().min(0) }).refine((data) => data.maxStock === 0 || (data.minStock <= data.idealStock && data.idealStock <= data.maxStock), { message: "Use mínimo ≤ ideal ≤ máximo", path: ["idealStock"] });
const valuesSchema = z.object({ cost: z.number().positive("Informe o custo"), price: z.number().positive("Informe o preço de venda") }).refine((data) => data.price >= data.cost, { message: "O preço de venda está abaixo do custo", path: ["price"] });

function ProductForm({ initial, isNew, initialTab, markets, fixedMarketId, onCancel, onSave }: { initial: Product; isNew: boolean; initialTab: FormTab; markets: Market[]; fixedMarketId?: string | undefined; onCancel: () => void; onSave: (product: Product, isNew: boolean) => void }) {
  const [product, setProduct] = useState<Product>(initial);
  const [tab, setTab] = useState<FormTab>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function setCost(cost: number) { setProduct((current) => ({ ...current, cost, price: round2(cost * (1 + current.margin / 100)) })); }
  function setMargin(margin: number) { setProduct((current) => ({ ...current, margin, price: round2(current.cost * (1 + margin / 100)) })); }
  function setPrice(price: number) { setProduct((current) => ({ ...current, price, margin: current.cost > 0 ? round2((price / current.cost - 1) * 100) : current.margin })); }

  function submit() {
    const checks: Array<[FormTab, z.ZodTypeAny]> = [["Informações", infoSchema], ["Estoque", stockSchema], ["Valores", valuesSchema]];
    for (const [checkTab, schema] of checks) {
      const result = schema.safeParse(product);
      if (!result.success) {
        const next: Record<string, string> = {};
        result.error.issues.forEach((issue) => { const key = String(issue.path[0]); if (!next[key]) next[key] = issue.message; });
        setErrors(next);
        setTab(checkTab);
        return;
      }
    }
    const invalidLot = product.lots.find((item) => !item.number.trim() || !item.expiresAt);
    if (invalidLot) { setErrors({ lots: "Preencha número e validade de todos os lotes." }); setTab("Lotes e validade"); return; }
    onSave({ ...product, name: product.name.trim(), stock: product.lots.length ? product.lots.reduce((sum, item) => sum + item.quantity, 0) : product.stock }, isNew);
  }

  const tabHasError = (item: FormTab) => (item === "Informações" && ["name", "barcode", "sku", "brand", "category"].some((key) => errors[key])) || (item === "Estoque" && ["minStock", "idealStock", "maxStock"].some((key) => errors[key])) || (item === "Valores" && ["cost", "price"].some((key) => errors[key])) || (item === "Lotes e validade" && Boolean(errors["lots"]));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Voltar para a lista"><ArrowLeft className="h-5 w-5" /></Button>
          <div><h2 className="text-xl font-extrabold sm:text-2xl">{isNew ? "Cadastrar produto" : "Editar produto"}</h2><p className="text-sm text-muted-foreground">{product.name || "Novo produto"}</p></div>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={submit}><Save className="h-4 w-4" /> Salvar produto</Button></div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Seções do cadastro">
        <div className="flex min-w-max gap-1 rounded-lg border border-border bg-card p-1">
          {formTabs.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={cn("relative rounded-md px-3.5 py-2 text-sm font-semibold transition", tab === item ? "bg-brand-panel text-sidebar-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {item}{tabHasError(item) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-critical" aria-label="Contém erros" />}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6" role="tabpanel" aria-label={tab}>
        {tab === "Informações" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Nome" error={errors["name"]}><input value={product.name} onChange={(event) => update("name", event.target.value)} maxLength={120} aria-invalid={Boolean(errors["name"])} className={inputClass} /></Field></div>
              <div className="sm:col-span-2"><Field label="Descrição" optional><textarea value={product.description} onChange={(event) => update("description", event.target.value)} maxLength={400} rows={3} className={cn(inputClass, "h-auto py-2.5")} /></Field></div>
              <Field label="Código de barras" error={errors["barcode"]}><input value={product.barcode} onChange={(event) => update("barcode", event.target.value.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" placeholder="7890000000000" aria-invalid={Boolean(errors["barcode"])} className={inputClass} /></Field>
              <Field label="SKU" error={errors["sku"]}><input value={product.sku} onChange={(event) => update("sku", event.target.value.toUpperCase())} maxLength={30} aria-invalid={Boolean(errors["sku"])} className={inputClass} /></Field>
              <Field label="Marca" error={errors["brand"]}><input value={product.brand} onChange={(event) => update("brand", event.target.value)} maxLength={60} aria-invalid={Boolean(errors["brand"])} className={inputClass} /></Field>
              <Field label="Categoria" error={errors["category"]}><select value={product.category} onChange={(event) => update("category", event.target.value)} aria-invalid={Boolean(errors["category"])} className={selectClass}><option value="">Selecione</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Unidade de medida"><select value={product.unit} onChange={(event) => update("unit", event.target.value as PackagingUnit)} className={selectClass}>{packagingUnits.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Fornecedor principal" optional><select value={product.supplier} onChange={(event) => update("supplier", event.target.value)} className={selectClass}><option value="">Selecione</option>{suppliers.map((item) => <option key={item}>{item}</option>)}</select></Field>
              {!fixedMarketId && <Field label="Mercado"><select value={product.marketId} onChange={(event) => update("marketId", event.target.value)} className={selectClass}>{markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
              <div className="sm:col-span-2"><Toggle label="Produto pesável" description="Vendido por peso na balança (ex.: frutas, frios)." checked={product.weighable} onChange={(value) => update("weighable", value)} /></div>
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">Foto</span>
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50">
                {product.photo ? <img src={product.photo} alt="Pré-visualização do produto" className="h-32 w-32 rounded-md object-cover" /> : <ImagePlus className="h-10 w-10 text-muted-foreground" />}
                <span className="text-sm font-semibold text-primary">{product.photo ? "Trocar foto" : "Enviar foto"}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update("photo", String(reader.result)); reader.readAsDataURL(file); }} />
              </label>
              {product.photo && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => update("photo", "")}><Trash2 className="h-4 w-4" /> Remover foto</Button>}
            </div>
          </div>
        )}

        {tab === "Embalagens e conversões" && <PackagingEditor product={product} onChange={(packagings) => update("packagings", packagings)} />}

        {tab === "Estoque" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Estoque mínimo" value={product.minStock} onChange={(value) => update("minStock", value)} error={errors["minStock"]} />
            <NumberField label="Estoque ideal" value={product.idealStock} onChange={(value) => update("idealStock", value)} error={errors["idealStock"]} />
            <NumberField label="Estoque máximo" value={product.maxStock} onChange={(value) => update("maxStock", value)} error={errors["maxStock"]} />
            <NumberField label="Ponto de pedido" value={product.reorderPoint} onChange={(value) => update("reorderPoint", value)} />
            {product.lots.length === 0 && <NumberField label="Estoque atual" value={product.stock} onChange={(value) => update("stock", value)} />}
            <div className={cn(product.lots.length === 0 ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-4")}><Field label="Localização principal" optional><input value={product.location} onChange={(event) => update("location", event.target.value)} maxLength={120} placeholder="Ex.: Depósito 1 / Rua B / Estante 03" className={inputClass} /></Field></div>
            <div className="grid gap-3 sm:col-span-2 lg:col-span-4 lg:grid-cols-3">
              <Toggle label="Permitir estoque negativo" description="Vendas continuam mesmo sem saldo." checked={product.allowNegative} onChange={(value) => update("allowNegative", value)} />
              <Toggle label="Controle por lote" description="Exige número de lote nas entradas." checked={product.lotControl} onChange={(value) => update("lotControl", value)} />
              <Toggle label="Controle por validade" description="Gera alertas de vencimento." checked={product.expiryControl} onChange={(value) => update("expiryControl", value)} />
            </div>
            {product.lots.length > 0 && <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">Estoque atual calculado pelos lotes: <strong className="text-foreground">{product.lots.reduce((sum, item) => sum + item.quantity, 0)} {packagingLabel(product.unit, 2)}</strong></p>}
          </div>
        )}

        {tab === "Valores" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField label="Custo" value={product.cost} onChange={setCost} error={errors["cost"]} />
            <NumberField label="Margem (%)" value={product.margin} onChange={setMargin} step="0.1" />
            <MoneyField label="Preço de venda" value={product.price} onChange={setPrice} error={errors["price"]} />
            <MoneyField label="Preço promocional" value={product.promoPrice ?? 0} onChange={(value) => update("promoPrice", value > 0 ? value : null)} optional />
            <Field label="Início da promoção" optional><input type="date" value={product.promoStart} onChange={(event) => update("promoStart", event.target.value)} className={inputClass} /></Field>
            <Field label="Fim da promoção" optional><input type="date" value={product.promoEnd} min={product.promoStart || undefined} onChange={(event) => update("promoEnd", event.target.value)} className={inputClass} /></Field>
            <div className="rounded-md bg-muted p-4 text-sm sm:col-span-3">Lucro bruto por {packagingLabel(product.unit, 1)}: <strong>{brl(Math.max(0, (product.promoPrice ?? product.price) - product.cost))}</strong>{product.promoPrice !== null && product.promoPrice < product.cost && <span className="ml-2 font-semibold text-critical">Promoção abaixo do custo</span>}</div>
          </div>
        )}

        {tab === "Lotes e validade" && <LotsEditor product={product} error={errors["lots"]} onChange={(lots) => { update("lots", lots); setErrors((current) => { const next = { ...current }; delete next["lots"]; return next; }); }} />}
      </div>
    </div>
  );
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function Field({ label, error, optional, children }: { label: string; error?: string | undefined; optional?: boolean | undefined; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>{children}{error && <span className="mt-1.5 block text-sm font-medium text-critical">{error}</span>}</label>;
}

function NumberField({ label, value, onChange, error, step = "1" }: { label: string; value: number; onChange: (value: number) => void; error?: string | undefined; step?: string }) {
  return <Field label={label} error={error}><input type="number" min="0" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} aria-invalid={Boolean(error)} className={inputClass} /></Field>;
}

function MoneyField({ label, value, onChange, error, optional }: { label: string; value: number; onChange: (value: number) => void; error?: string | undefined; optional?: boolean }) {
  return <Field label={label} error={error} optional={optional}><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R$</span><input type="number" min="0" step="0.01" value={value || ""} onChange={(event) => onChange(Math.max(0, round2(Number(event.target.value) || 0)))} aria-invalid={Boolean(error)} className={cn(inputClass, "pl-11")} /></div></Field>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3.5", checked ? "border-primary bg-primary-soft" : "border-border")}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span><strong className="block text-sm">{label}</strong><span className="block text-sm text-muted-foreground">{description}</span></span></label>;
}

function PackagingEditor({ product, onChange }: { product: Product; onChange: (packagings: Packaging[]) => void }) {
  const change = (id: string, patch: Partial<Packaging>) => onChange(product.packagings.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const totalBase = (packaging: Packaging, depth = 0): number | null => {
    if (packaging.of === product.unit) return packaging.quantity;
    if (depth > 5) return null;
    const inner = product.packagings.find((item) => item.unit === packaging.of);
    const innerTotal = inner ? totalBase(inner, depth + 1) : null;
    return innerTotal === null ? null : packaging.quantity * innerTotal;
  };
  return (
    <div className="space-y-5">
      <div className="rounded-md bg-primary-soft p-4 text-sm">
        <strong className="block">Como funcionam as conversões</strong>
        <span className="mt-1 block text-muted-foreground">Informe quantas embalagens menores cabem em cada embalagem. Exemplos: “1 caixa = 12 unidades”, “1 fardo = 6 pacotes”, “1 pacote = 4 unidades”.</span>
        <span className="mt-2 block">Unidade base deste produto: <strong>{product.unit}</strong></span>
      </div>
      {product.packagings.length === 0 && <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma embalagem cadastrada. O produto será movimentado somente em {packagingLabel(product.unit, 2)}.</p>}
      <div className="space-y-3">
        {product.packagings.map((packaging) => {
          const total = totalBase(packaging);
          return (
            <div key={packaging.id} className="grid items-end gap-3 rounded-md border border-border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_120px_1fr_1.2fr_auto]">
              <Field label="Embalagem"><select value={packaging.unit} onChange={(event) => change(packaging.id, { unit: event.target.value as PackagingUnit })} className={selectClass}>{packagingUnits.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <NumberField label="Contém" value={packaging.quantity} onChange={(value) => change(packaging.id, { quantity: Math.max(1, value) })} />
              <Field label="De"><select value={packaging.of} onChange={(event) => change(packaging.id, { of: event.target.value as PackagingUnit })} className={selectClass}>{packagingUnits.filter((item) => item !== packaging.unit).map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Código de barras da embalagem" optional><input value={packaging.barcode} onChange={(event) => change(packaging.id, { barcode: event.target.value.replace(/\D/g, "").slice(0, 14) })} inputMode="numeric" className={inputClass} /></Field>
              <Button variant="ghost" size="icon" className="justify-self-end" onClick={() => onChange(product.packagings.filter((item) => item.id !== packaging.id))} aria-label="Remover embalagem"><Trash2 className="h-4 w-4" /></Button>
              <p className="text-sm font-semibold text-primary sm:col-span-2 lg:col-span-5">1 {plural[packaging.unit][0]} = {packaging.quantity} {packagingLabel(packaging.of, packaging.quantity)}{total !== null && packaging.of !== product.unit && ` (${total} ${packagingLabel(product.unit, total)})`}</p>
            </div>
          );
        })}
      </div>
      <Button variant="outline" onClick={() => onChange([...product.packagings, { id: `k-${Date.now()}`, unit: product.unit === "Caixa" ? "Fardo" : "Caixa", quantity: 12, of: product.unit, barcode: "" }])}><Plus className="h-4 w-4" /> Adicionar embalagem</Button>
    </div>
  );
}

function LotsEditor({ product, error, onChange }: { product: Product; error?: string | undefined; onChange: (lots: Lot[]) => void }) {
  const change = (id: string, patch: Partial<Lot>) => onChange(product.lots.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const sorted = [...product.lots].sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <AlertPill label="Vencido" tone="critical" /><AlertPill label="Até 30 dias" tone="critical" /><AlertPill label="31 a 60 dias" tone="warning" /><AlertPill label="61 a 90 dias" tone="warning" /><AlertPill label="Em dia" tone="positive" />
      </div>
      {!product.lotControl && <p className="rounded-md bg-warning-soft p-3 text-sm">O controle por lote está desativado na aba Estoque. Os lotes abaixo são apenas informativos.</p>}
      {error && <p className="rounded-md bg-critical/10 p-3 text-sm font-semibold text-critical">{error}</p>}
      {sorted.length === 0 && <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum lote cadastrado.</p>}
      {sorted.map((item) => {
        const level = expiryLevel(item.expiresAt || undefined);
        const days = item.expiresAt ? daysUntil(item.expiresAt) : null;
        return (
          <div key={item.id} className={cn("rounded-md border p-4", level === "Vencido" || level === "30 dias" ? "border-critical/50 bg-critical/5" : level === "60 dias" || level === "90 dias" ? "border-warning/50 bg-warning-soft/40" : "border-border")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <AlertPill label={days === null ? "Sem validade" : days < 0 ? `Vencido há ${Math.abs(days)} dias` : level === "Em dia" ? `Em dia · ${days} dias` : `Vence em ${days} dias`} tone={expiryTone[level]} />
              <Button variant="ghost" size="icon" onClick={() => onChange(product.lots.filter((lotItem) => lotItem.id !== item.id))} aria-label={`Remover lote ${item.number}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Número do lote"><input value={item.number} onChange={(event) => change(item.id, { number: event.target.value.toUpperCase() })} maxLength={30} className={inputClass} /></Field>
              <Field label="Data de fabricação"><input type="date" value={item.manufacturedAt} onChange={(event) => change(item.id, { manufacturedAt: event.target.value })} className={inputClass} /></Field>
              <Field label="Data de validade"><input type="date" value={item.expiresAt} min={item.manufacturedAt || undefined} onChange={(event) => change(item.id, { expiresAt: event.target.value })} className={inputClass} /></Field>
              <NumberField label="Quantidade" value={item.quantity} onChange={(value) => change(item.id, { quantity: value })} />
              <Field label="Fornecedor"><select value={item.supplier} onChange={(event) => change(item.id, { supplier: event.target.value })} className={selectClass}><option value="">Selecione</option>{suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}</select></Field>
              <div className="lg:col-span-2"><Field label="Localização"><input value={item.location} onChange={(event) => change(item.id, { location: event.target.value })} maxLength={120} className={inputClass} /></Field></div>
              <Field label="Status"><select value={item.status} onChange={(event) => change(item.id, { status: event.target.value as Lot["status"] })} className={selectClass}><option>Liberado</option><option>Em análise</option><option>Bloqueado</option></select></Field>
            </div>
          </div>
        );
      })}
      <Button variant="outline" onClick={() => onChange([...product.lots, { id: `l-${Date.now()}`, number: "", manufacturedAt: "", expiresAt: "", quantity: 0, supplier: product.supplier, location: product.location, status: "Liberado" }])}><Plus className="h-4 w-4" /> Adicionar lote</Button>
    </div>
  );
}
