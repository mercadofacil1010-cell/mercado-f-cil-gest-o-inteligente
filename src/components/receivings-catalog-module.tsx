// Recebimento de mercadoria real (B4.1): criar o recebimento e a lista de
// itens esperados. A conferência cega em si (contar, comparar só depois) e
// a decisão/aprovação chegam no B4.2/B4.3 — substitui, para este mercado, a
// demonstração antiga (src/components/receiving-module.tsx).
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertPill } from "@/components/dashboard-ui";
import { listProducts, type Product } from "@/lib/products-api";
import { listSuppliers, type Supplier } from "@/lib/catalog-support-api";
import {
  addReceivingItem,
  createReceiving,
  listReceivingItems,
  listReceivings,
  receivingStatusLabel,
  removeReceivingItem,
  type Receiving,
  type ReceivingItem,
  type ReceivingStatus,
} from "@/lib/receivings-api";

const statusTone: Record<ReceivingStatus, "neutral" | "warning" | "positive" | "critical"> = {
  aguardando_recebimento: "neutral",
  em_conferencia: "warning",
  com_divergencia: "critical",
  aguardando_aprovacao: "warning",
  finalizado: "positive",
  recusado: "critical",
};

export function ReceivingsCatalogModule({
  companyId,
  marketId,
  marketName,
  notify,
}: {
  companyId: string | null;
  marketId: string;
  marketName: string;
  notify: (message: string) => void;
}) {
  const [receivings, setReceivings] = useState<Receiving[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewingItemsOf, setViewingItemsOf] = useState<Receiving | null>(null);

  const reload = async () => {
    setLoading(true);
    const [receivingList, supplierList, productList] = await Promise.all([
      listReceivings(marketId),
      companyId ? listSuppliers(companyId) : Promise.resolve([]),
      companyId ? listProducts(companyId) : Promise.resolve([]),
    ]);
    setReceivings(receivingList);
    setSuppliers(supplierList);
    setProducts(productList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [marketId, companyId]);

  return (
    <section className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Recebimentos — {marketName}</h1>
          <p className="mt-1 text-muted-foreground">
            Crie o recebimento e a lista de itens esperados. A conferência cega chega numa próxima
            etapa.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo recebimento
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-lg border border-border bg-card p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : receivings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <h3 className="font-bold">Nenhum recebimento cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em "Novo recebimento" para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                {["Fornecedor", "Nota fiscal", "Pedido", "Situação", "Criado em", ""].map(
                  (header) => (
                    <th key={header} className="px-4 py-3 font-bold">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {receivings.map((receiving) => (
                <tr
                  key={receiving.id}
                  className="border-b border-border last:border-0 hover:bg-muted/60"
                >
                  <td className="px-4 py-3">
                    <strong>{receiving.supplierName || "—"}</strong>
                  </td>
                  <td className="px-4 py-3">
                    {receiving.invoiceNumber || (
                      <span className="text-muted-foreground">
                        Sem nota — {receiving.noInvoiceReason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{receiving.orderReference || "—"}</td>
                  <td className="px-4 py-3">
                    <AlertPill
                      label={receivingStatusLabel[receiving.status]}
                      tone={statusTone[receiving.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(receiving.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingItemsOf(receiving)}
                    >
                      Itens esperados
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateReceivingDialog
          marketId={marketId}
          suppliers={suppliers}
          onClose={() => setCreating(false)}
          onCreated={(receiving) => {
            setCreating(false);
            notify("Recebimento criado.");
            void reload();
            setViewingItemsOf(receiving);
          }}
        />
      )}
      {viewingItemsOf && (
        <ReceivingItemsDialog
          receiving={viewingItemsOf}
          products={products}
          onClose={() => setViewingItemsOf(null)}
          notify={notify}
        />
      )}
    </section>
  );
}

function CreateReceivingDialog({
  marketId,
  suppliers,
  onClose,
  onCreated,
}: {
  marketId: string;
  suppliers: Supplier[];
  onClose: () => void;
  onCreated: (receiving: Receiving) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [hasInvoice, setHasInvoice] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [noInvoiceReason, setNoInvoiceReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (hasInvoice && !invoiceNumber.trim()) {
      setError("Informe o número da nota fiscal, ou marque que o recebimento é sem nota.");
      return;
    }
    if (!hasInvoice && !noInvoiceReason.trim()) {
      setError("Informe o motivo do recebimento sem nota fiscal.");
      return;
    }
    setSubmitting(true);
    const result = await createReceiving(
      marketId,
      supplierId || null,
      hasInvoice ? invoiceNumber : "",
      orderReference,
      hasInvoice ? "" : noInvoiceReason,
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated({
      id: result.receivingId,
      marketId,
      supplierId: supplierId || null,
      supplierName: suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "",
      invoiceNumber: hasInvoice ? invoiceNumber : "",
      orderReference,
      noInvoiceReason: hasInvoice ? "" : noInvoiceReason,
      status: "aguardando_recebimento",
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Novo recebimento</DialogTitle>
          <DialogDescription>Fornecedor, nota fiscal ou pedido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-10 bg-card">
              <SelectValue placeholder="Fornecedor (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={hasInvoice ? "default" : "outline"}
              size="sm"
              onClick={() => setHasInvoice(true)}
            >
              Com nota fiscal
            </Button>
            <Button
              type="button"
              variant={!hasInvoice ? "default" : "outline"}
              size="sm"
              onClick={() => setHasInvoice(false)}
            >
              Sem nota fiscal
            </Button>
          </div>
          {hasInvoice ? (
            <input
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="Número da nota fiscal"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <input
              value={noInvoiceReason}
              onChange={(event) => setNoInvoiceReason(event.target.value)}
              placeholder="Motivo do recebimento sem nota fiscal"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <input
            value={orderReference}
            onChange={(event) => setOrderReference(event.target.value)}
            placeholder="Pedido (opcional)"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Criar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceivingItemsDialog({
  receiving,
  products,
  onClose,
  notify,
}: {
  receiving: Receiving;
  products: Product[];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canEdit = receiving.status === "aguardando_recebimento";

  const reload = async () => {
    setLoading(true);
    setItems(await listReceivingItems(receiving.id));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o recebimento muda
  }, [receiving.id]);

  const handleAdd = async () => {
    if (!productId) {
      notify("Escolha um produto.");
      return;
    }
    const value = Number(quantity);
    if (!quantity.trim() || value <= 0) {
      notify("Informe uma quantidade esperada maior que zero.");
      return;
    }
    setSubmitting(true);
    const result = await addReceivingItem(receiving.id, productId, value);
    setSubmitting(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setProductId("");
    setQuantity("");
    void reload();
  };

  const handleRemove = async (id: string) => {
    const result = await removeReceivingItem(id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    void reload();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens esperados — {receiving.supplierName || "Recebimento"}</DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Adicione os produtos e quantidades esperados desta entrega."
              : "A conferência já começou — os itens esperados não podem mais ser alterados."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="grid place-items-center p-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item esperado ainda.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                  >
                    <span>
                      {item.productName} — {item.expectedQuantity}
                    </span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleRemove(item.id)}
                        aria-label={`Remover ${item.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
            {canEdit && (
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Qtd."
                  className="h-10 w-24 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" disabled={submitting} onClick={() => void handleAdd()}>
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
              </div>
            )}
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
