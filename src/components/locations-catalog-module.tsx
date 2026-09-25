// Endereçamento real de depósito e gôndola por mercado (B3.1), com o livro
// de movimentos e saldo real dos endereços de depósito (B3.2). Substitui,
// para este mercado, os dados de demonstração de "Gôndolas"/"Depósito" por
// leitura e gravação de verdade no Supabase.
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Undo2, X } from "lucide-react";
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
import {
  createGondolaPosition,
  createWarehouseAddress,
  inactivateGondolaPosition,
  inactivateWarehouseAddress,
  listGondolaPositions,
  listWarehouseAddresses,
  updateGondolaPositionLimits,
  updateGondolaPositionProduct,
  updateWarehouseAddress,
  updateWarehouseAddressCapacity,
  type GondolaPosition,
  type GondolaPositionFormData,
  type WarehouseAddress,
  type WarehouseAddressFormData,
} from "@/lib/locations-api";
import {
  approvePendingAdjustment,
  listPendingAdjustments,
  listStockBalances,
  listStockMovements,
  registerStockMovement,
  registerStockTransfer,
  rejectPendingAdjustment,
  reverseStockMovement,
  stockMovementTypeLabel,
  type PendingAdjustment,
  type StockBalance,
  type StockMovement,
  type StockMovementType,
} from "@/lib/stock-movements-api";
import { getOrCreateLot, listLots, type Lot } from "@/lib/lots-api";
import {
  finalizeInventoryCount,
  getOpenInventoryCount,
  setInventoryCountItem,
  startInventoryCount,
  type InventoryCount,
  type InventoryCountItem,
} from "@/lib/inventory-counts-api";

const emptyAddressForm: WarehouseAddressFormData = {
  warehouseName: "Depósito 1",
  sector: "",
  street: "",
  aisle: "",
  shelf: "",
  level: "",
  position: "",
  code: "",
  capacity: "",
};

const emptyPositionForm: GondolaPositionFormData = {
  sector: "",
  aisle: "",
  gondolaNumber: "",
  side: "A",
  moduleNumber: "1",
  shelfNumber: "1",
  positionNumber: "1",
  code: "",
  productId: null,
  minQuantity: "0",
  idealQuantity: "0",
  maxQuantity: "0",
  capacity: "",
};

export function LocationsCatalogModule({
  companyId,
  marketId,
  marketName,
  initialView,
  notify,
}: {
  companyId: string | null;
  marketId: string;
  marketName: string;
  initialView: "Gôndolas" | "Depósito";
  notify: (message: string) => void;
}) {
  const [view, setView] = useState<"Gôndolas" | "Depósito">(initialView);
  const [addresses, setAddresses] = useState<WarehouseAddress[]>([]);
  const [positions, setPositions] = useState<GondolaPosition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<WarehouseAddress | null>(null);
  const [changingCapacityOf, setChangingCapacityOf] = useState<WarehouseAddress | null>(null);
  const [viewingMovementsOf, setViewingMovementsOf] = useState<WarehouseAddress | null>(null);
  const [countingAddress, setCountingAddress] = useState<WarehouseAddress | null>(null);
  const [positionFormOpen, setPositionFormOpen] = useState(false);
  const [changingLimitsOf, setChangingLimitsOf] = useState<GondolaPosition | null>(null);

  const reload = async () => {
    setLoading(true);
    const [addressList, positionList, productList] = await Promise.all([
      listWarehouseAddresses(marketId),
      listGondolaPositions(marketId),
      companyId ? listProducts(companyId) : Promise.resolve([]),
    ]);
    setAddresses(addressList);
    setPositions(positionList);
    setProducts(productList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [marketId, companyId]);

  const requestInactivateAddress = async (address: WarehouseAddress) => {
    if (!window.confirm(`Inativar o endereço "${address.code}"?`)) return;
    const result = await inactivateWarehouseAddress(address.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`Endereço ${address.code} foi inativado.`);
    void reload();
  };

  const requestInactivatePosition = async (position: GondolaPosition) => {
    if (!window.confirm(`Inativar a posição "${position.code}"?`)) return;
    const result = await inactivateGondolaPosition(position.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`Posição ${position.code} foi inativada.`);
    void reload();
  };

  return (
    <section className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Endereçamento — {marketName}</h1>
          <p className="mt-1 text-muted-foreground">
            {view === "Depósito"
              ? "Endereços do depósito: podem guardar vários produtos e lotes."
              : "Posições de gôndola: cada uma tem um único produto-alvo, com mínimo/ideal/máximo."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "Depósito" ? "default" : "outline"}
            onClick={() => setView("Depósito")}
          >
            Depósito
          </Button>
          <Button
            variant={view === "Gôndolas" ? "default" : "outline"}
            onClick={() => setView("Gôndolas")}
          >
            Gôndolas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-lg border border-border bg-card p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === "Depósito" ? (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setAddressFormOpen(true)}>
              <Plus className="h-4 w-4" /> Novo endereço
            </Button>
          </div>
          {addresses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <h3 className="font-bold">Nenhum endereço de depósito cadastrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Clique em "Novo endereço" para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    {["Código", "Setor", "Endereço", "Capacidade", "Situação", ""].map((header) => (
                      <th key={header} className="px-4 py-3 font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {addresses.map((address) => (
                    <tr
                      key={address.id}
                      className="border-b border-border last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3">
                        <strong>{address.code}</strong>
                      </td>
                      <td className="px-4 py-3">{address.sector}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {address.warehouseName} / Rua {address.street} / Corredor {address.aisle} /
                        Estante {address.shelf} / Nível {address.level} / Posição {address.position}
                      </td>
                      <td className="px-4 py-3">{address.capacity}</td>
                      <td className="px-4 py-3">
                        <AlertPill
                          label={address.status === "active" ? "Ativo" : "Inativo"}
                          tone={address.status === "active" ? "positive" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAddress(address)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setChangingCapacityOf(address)}
                          >
                            Alterar capacidade
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingMovementsOf(address)}
                          >
                            Movimentos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCountingAddress(address)}
                          >
                            Inventário
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void requestInactivateAddress(address)}
                          >
                            Inativar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setPositionFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nova posição
            </Button>
          </div>
          {positions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <h3 className="font-bold">Nenhuma posição de gôndola cadastrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Clique em "Nova posição" para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    {[
                      "Código",
                      "Produto-alvo",
                      "Mín. / Ideal / Máx.",
                      "Capacidade",
                      "Situação",
                      "",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr
                      key={position.id}
                      className="border-b border-border last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3">
                        <strong>{position.code}</strong>
                      </td>
                      <td className="px-4 py-3">{position.productName || "— (livre)"}</td>
                      <td className="px-4 py-3">
                        {position.minQuantity} / {position.idealQuantity} / {position.maxQuantity}
                      </td>
                      <td className="px-4 py-3">{position.capacity}</td>
                      <td className="px-4 py-3">
                        <AlertPill
                          label={position.status === "active" ? "Ativo" : "Inativo"}
                          tone={position.status === "active" ? "positive" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setChangingLimitsOf(position)}
                          >
                            Editar limites
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void requestInactivatePosition(position)}
                          >
                            Inativar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {(addressFormOpen || editingAddress) && (
        <AddressDialog
          marketId={marketId}
          address={editingAddress}
          onClose={() => {
            setAddressFormOpen(false);
            setEditingAddress(null);
          }}
          onSaved={(verb) => {
            setAddressFormOpen(false);
            setEditingAddress(null);
            notify(`Endereço ${verb} com sucesso.`);
            void reload();
          }}
        />
      )}
      {changingCapacityOf && (
        <CapacityDialog
          address={changingCapacityOf}
          onClose={() => setChangingCapacityOf(null)}
          onSaved={() => {
            setChangingCapacityOf(null);
            notify("Capacidade atualizada.");
            void reload();
          }}
        />
      )}
      {viewingMovementsOf && (
        <MovementsDialog
          address={viewingMovementsOf}
          addresses={addresses}
          products={products}
          onClose={() => setViewingMovementsOf(null)}
          notify={notify}
        />
      )}
      {countingAddress && (
        <InventoryCountDialog
          address={countingAddress}
          products={products}
          onClose={() => setCountingAddress(null)}
          notify={notify}
        />
      )}
      {positionFormOpen && (
        <PositionDialog
          marketId={marketId}
          products={products}
          onClose={() => setPositionFormOpen(false)}
          onSaved={() => {
            setPositionFormOpen(false);
            notify("Posição cadastrada com sucesso.");
            void reload();
          }}
        />
      )}
      {changingLimitsOf && (
        <LimitsDialog
          position={changingLimitsOf}
          products={products}
          onClose={() => setChangingLimitsOf(null)}
          onSaved={() => {
            setChangingLimitsOf(null);
            notify("Limites da posição atualizados.");
            void reload();
          }}
          notify={notify}
        />
      )}
    </section>
  );
}

function AddressDialog({
  marketId,
  address,
  onClose,
  onSaved,
}: {
  marketId: string;
  address: WarehouseAddress | null;
  onClose: () => void;
  onSaved: (verb: "cadastrado" | "atualizado") => void;
}) {
  const [form, setForm] = useState<WarehouseAddressFormData>(
    address
      ? {
          warehouseName: address.warehouseName,
          sector: address.sector,
          street: address.street,
          aisle: address.aisle,
          shelf: address.shelf,
          level: address.level,
          position: address.position,
          code: address.code,
          capacity: String(address.capacity),
        }
      : emptyAddressForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<WarehouseAddressFormData>) =>
    setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async () => {
    setError("");
    if (!form.code.trim()) {
      setError("Informe o código do endereço.");
      return;
    }
    if (!address && (!form.capacity.trim() || Number(form.capacity) <= 0)) {
      setError("Informe uma capacidade maior que zero.");
      return;
    }
    setSubmitting(true);
    const result = address
      ? await updateWarehouseAddress(address.id, form)
      : await createWarehouseAddress(marketId, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(address ? "atualizado" : "cadastrado");
  };

  const field = (label: string, key: keyof WarehouseAddressFormData) => (
    <label className="block text-sm">
      <span className="mb-1.5 block font-semibold">{label}</span>
      <input
        value={form[key]}
        onChange={(event) =>
          update({ [key]: event.target.value } as Partial<WarehouseAddressFormData>)
        }
        className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{address ? "Editar endereço" : "Novo endereço de depósito"}</DialogTitle>
          <DialogDescription>
            Depósito, setor, rua, corredor, estante, nível e posição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field("Depósito", "warehouseName")}
            {field("Setor", "sector")}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {field("Rua", "street")}
            {field("Corredor", "aisle")}
            {field("Estante", "shelf")}
            {field("Nível", "level")}
            {field("Posição", "position")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Código único", "code")}
            {!address && (
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">Capacidade</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.capacity}
                  onChange={(event) => update({ capacity: event.target.value })}
                  className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
          </div>
          {address && (
            <p className="text-xs text-muted-foreground">
              Para trocar a capacidade, use "Alterar capacidade" na lista (exige justificativa).
            </p>
          )}
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
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar endereço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapacityDialog({
  address,
  onClose,
  onSaved,
}: {
  address: WarehouseAddress;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [capacity, setCapacity] = useState(String(address.capacity));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!capacity.trim() || Number(capacity) <= 0) {
      setError("Informe uma capacidade maior que zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Informe a justificativa da mudança de capacidade.");
      return;
    }
    setSubmitting(true);
    const result = await updateWarehouseAddressCapacity(address.id, capacity, reason);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Alterar capacidade — {address.code}</DialogTitle>
          <DialogDescription>
            Toda mudança de capacidade exige uma justificativa (fica na auditoria).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Nova capacidade</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Justificativa</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex: reorganização do depósito"
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
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
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PositionDialog({
  marketId,
  products,
  onClose,
  onSaved,
}: {
  marketId: string;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GondolaPositionFormData>(emptyPositionForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<GondolaPositionFormData>) =>
    setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async () => {
    setError("");
    if (!form.code.trim()) {
      setError("Informe o código da posição.");
      return;
    }
    const min = Number(form.minQuantity);
    const ideal = Number(form.idealQuantity);
    const max = Number(form.maxQuantity);
    if (!(min >= 0 && min <= ideal && ideal <= max)) {
      setError("O mínimo precisa ser ≤ ideal, e o ideal ≤ máximo (nenhum valor negativo).");
      return;
    }
    if (!form.capacity.trim() || Number(form.capacity) <= 0) {
      setError("Informe uma capacidade maior que zero.");
      return;
    }
    setSubmitting(true);
    const result = await createGondolaPosition(marketId, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova posição de gôndola</DialogTitle>
          <DialogDescription>
            Setor, corredor, gôndola, lado, módulo, prateleira e posição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Setor</span>
              <input
                value={form.sector}
                onChange={(event) => update({ sector: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Corredor</span>
              <input
                value={form.aisle}
                onChange={(event) => update({ aisle: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Gôndola</span>
              <input
                value={form.gondolaNumber}
                onChange={(event) => update({ gondolaNumber: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Lado</span>
              <Select
                value={form.side}
                onValueChange={(value) => update({ side: value as "A" | "B" })}
              >
                <SelectTrigger className="h-11 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Módulo</span>
              <input
                type="number"
                min="1"
                value={form.moduleNumber}
                onChange={(event) => update({ moduleNumber: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Prateleira</span>
              <input
                type="number"
                min="1"
                value={form.shelfNumber}
                onChange={(event) => update({ shelfNumber: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Posição</span>
              <input
                type="number"
                min="1"
                value={form.positionNumber}
                onChange={(event) => update({ positionNumber: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Código único</span>
              <input
                value={form.code}
                onChange={(event) => update({ code: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Produto-alvo (opcional)</span>
            <Select
              value={form.productId ?? ""}
              onValueChange={(value) => update({ productId: value || null })}
            >
              <SelectTrigger className="h-11 bg-card">
                <SelectValue placeholder="Posição livre" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Mínimo</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.minQuantity}
                onChange={(event) => update({ minQuantity: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Ideal</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.idealQuantity}
                onChange={(event) => update({ idealQuantity: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Máximo</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.maxQuantity}
                onChange={(event) => update({ maxQuantity: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Capacidade</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.capacity}
                onChange={(event) => update({ capacity: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
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
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar posição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LimitsDialog({
  position,
  products,
  onClose,
  onSaved,
  notify,
}: {
  position: GondolaPosition;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string) => void;
}) {
  const [productId, setProductId] = useState(position.productId ?? "");
  const [minQuantity, setMinQuantity] = useState(String(position.minQuantity));
  const [idealQuantity, setIdealQuantity] = useState(String(position.idealQuantity));
  const [maxQuantity, setMaxQuantity] = useState(String(position.maxQuantity));
  const [capacity, setCapacity] = useState(String(position.capacity));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const min = Number(minQuantity);
    const ideal = Number(idealQuantity);
    const max = Number(maxQuantity);
    if (!(min >= 0 && min <= ideal && ideal <= max)) {
      setError("O mínimo precisa ser ≤ ideal, e o ideal ≤ máximo (nenhum valor negativo).");
      return;
    }
    if (!capacity.trim() || Number(capacity) <= 0) {
      setError("Informe uma capacidade maior que zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Informe a justificativa da mudança de limites.");
      return;
    }
    setSubmitting(true);
    if (productId !== (position.productId ?? "")) {
      const productResult = await updateGondolaPositionProduct(position.id, productId || null);
      if (!productResult.ok) {
        setSubmitting(false);
        setError(productResult.message);
        return;
      }
    }
    const result = await updateGondolaPositionLimits(
      position.id,
      { minQuantity, idealQuantity, maxQuantity, capacity },
      reason,
    );
    setSubmitting(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    onSaved();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar limites — {position.code}</DialogTitle>
          <DialogDescription>
            Toda mudança de limites exige uma justificativa (fica na auditoria).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Produto-alvo</span>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-11 bg-card">
                <SelectValue placeholder="Posição livre" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Mínimo</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={minQuantity}
                onChange={(event) => setMinQuantity(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Ideal</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={idealQuantity}
                onChange={(event) => setIdealQuantity(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Máximo</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={maxQuantity}
                onChange={(event) => setMaxQuantity(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Capacidade</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Justificativa</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex: ajuste de planograma pós-inventário"
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
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
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emptyMovementForm = {
  productId: "",
  type: "entrada" as StockMovementType,
  quantity: "",
  reference: "",
  reason: "",
  ajusteSign: "positivo" as "positivo" | "negativo",
  lotId: "",
  newBatchNumber: "",
  newExpiresAt: "",
  destinationAddressId: "",
};

function MovementsDialog({
  address,
  addresses,
  products,
  onClose,
  notify,
}: {
  address: WarehouseAddress;
  addresses: WarehouseAddress[];
  products: Product[];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const destinationOptions = addresses.filter(
    (candidate) => candidate.id !== address.id && candidate.status === "active",
  );
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyMovementForm);
  const [creatingLot, setCreatingLot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const selectedProduct = products.find((product) => product.id === form.productId) ?? null;

  const reload = async () => {
    setLoading(true);
    const [balanceList, movementList, pendingList] = await Promise.all([
      listStockBalances(address.id),
      listStockMovements(address.id),
      listPendingAdjustments(address.id),
    ]);
    setBalances(balanceList);
    setMovements(movementList);
    setPendingAdjustments(pendingList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o endereço muda
  }, [address.id]);

  useEffect(() => {
    if (!selectedProduct?.tracksBatchExpiry) {
      setLots([]);
      return;
    }
    void listLots(address.id, selectedProduct.id).then(setLots);
  }, [address.id, selectedProduct?.id, selectedProduct?.tracksBatchExpiry]);

  const update = (patch: Partial<typeof emptyMovementForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async () => {
    setError("");
    if (!form.productId) {
      setError("Escolha um produto.");
      return;
    }
    const rawQuantity = Number(form.quantity);
    if (!form.quantity.trim() || rawQuantity === 0) {
      setError("Informe uma quantidade diferente de zero.");
      return;
    }
    if (form.type === "transferencia" && !form.destinationAddressId) {
      setError("Escolha o endereço de destino da transferência.");
      return;
    }

    const signedQuantity =
      form.type === "entrada" || form.type === "transferencia"
        ? Math.abs(rawQuantity)
        : form.type === "ajuste"
          ? form.ajusteSign === "positivo"
            ? Math.abs(rawQuantity)
            : -Math.abs(rawQuantity)
          : -Math.abs(rawQuantity);

    let lotId = form.lotId || undefined;
    if (selectedProduct?.tracksBatchExpiry) {
      if (form.type === "transferencia") {
        if (!lotId) {
          setError("Este produto controla lote — escolha o lote de origem da transferência.");
          return;
        }
      } else if (creatingLot) {
        if (!form.newBatchNumber.trim()) {
          setError("Informe o número do novo lote.");
          return;
        }
        setSubmitting(true);
        const lotResult = await getOrCreateLot(
          address.id,
          selectedProduct.id,
          form.newBatchNumber,
          form.newExpiresAt || null,
        );
        setSubmitting(false);
        if (!lotResult.ok) {
          setError(lotResult.message);
          return;
        }
        lotId = lotResult.lot.id;
      } else if (!lotId) {
        setError("Este produto controla lote — escolha um lote ou crie um novo.");
        return;
      }
    }

    setSubmitting(true);
    const result =
      form.type === "transferencia"
        ? await registerStockTransfer(
            address.id,
            form.destinationAddressId,
            form.productId,
            signedQuantity,
            form.reference,
            form.reason,
            lotId,
          )
        : await registerStockMovement(
            address.id,
            form.productId,
            form.type,
            signedQuantity,
            form.reference,
            form.reason,
            lotId,
          );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setNeedsReason(Boolean(result.needsReason));
      return;
    }
    setForm(emptyMovementForm);
    setNeedsReason(false);
    setCreatingLot(false);
    notify(
      "pending" in result && result.pending
        ? "Acima do limite da empresa — enviado para aprovação. O estoque só muda quando for aprovado."
        : form.type === "transferencia"
          ? "Transferência registrada."
          : "Movimento registrado.",
    );
    void reload();
    if (selectedProduct?.tracksBatchExpiry)
      void listLots(address.id, selectedProduct.id).then(setLots);
  };

  const handleResolve = async (id: string, decision: "approve" | "reject") => {
    if (decision === "reject" && !resolveNote.trim()) {
      notify("Informe o motivo da recusa.");
      return;
    }
    setResolving(true);
    const result =
      decision === "approve"
        ? await approvePendingAdjustment(id, resolveNote || undefined)
        : await rejectPendingAdjustment(id, resolveNote);
    setResolving(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setResolvingId(null);
    setResolveNote("");
    notify(decision === "approve" ? "Pedido aprovado." : "Pedido recusado.");
    void reload();
  };

  const handleReverse = async (movementId: string) => {
    if (!reverseReason.trim()) {
      notify("Informe a justificativa do estorno.");
      return;
    }
    setReversing(true);
    const result = await reverseStockMovement(movementId, reverseReason);
    setReversing(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setReversingId(null);
    setReverseReason("");
    notify("Movimento estornado.");
    void reload();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[680px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimentos — {address.code}</DialogTitle>
          <DialogDescription>
            Entradas, saídas, ajustes, perdas e devoluções ao fornecedor deste endereço.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="grid place-items-center p-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {balances.length > 0 && (
              <div className="space-y-1 rounded-md border border-border p-3 text-sm">
                <p className="font-semibold">Saldo atual</p>
                {balances.map((balance) => (
                  <div key={balance.productId} className="flex justify-between">
                    <span>{balance.productName}</span>
                    <span className={balance.balance < 0 ? "text-destructive" : ""}>
                      {balance.balance}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-semibold">Registrar movimento</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={form.productId}
                  onValueChange={(value) => update({ productId: value })}
                >
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
                <Select
                  value={form.type}
                  onValueChange={(value) => update({ type: value as StockMovementType })}
                >
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(stockMovementTypeLabel) as StockMovementType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {stockMovementTypeLabel[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={(event) => update({ quantity: event.target.value })}
                  placeholder="Quantidade"
                  className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={form.reference}
                  onChange={(event) => update({ reference: event.target.value })}
                  placeholder="Referência (opcional)"
                  className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {form.type === "ajuste" && (
                <Select
                  value={form.ajusteSign}
                  onValueChange={(value) =>
                    update({ ajusteSign: value as "positivo" | "negativo" })
                  }
                >
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positivo">Ajuste positivo (encontrou a mais)</SelectItem>
                    <SelectItem value="negativo">Ajuste negativo (encontrou a menos)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form.type === "transferencia" && (
                <Select
                  value={form.destinationAddressId}
                  onValueChange={(value) => update({ destinationAddressId: value })}
                >
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue placeholder="Endereço de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedProduct?.tracksBatchExpiry && (
                <div className="space-y-2 rounded-md border border-dashed border-border p-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Este produto controla lote e validade
                  </p>
                  {creatingLot && form.type !== "transferencia" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={form.newBatchNumber}
                        onChange={(event) => update({ newBatchNumber: event.target.value })}
                        placeholder="Número do lote"
                        className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="date"
                        value={form.newExpiresAt}
                        onChange={(event) => update({ newExpiresAt: event.target.value })}
                        className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="col-span-2 justify-self-start"
                        onClick={() => {
                          setCreatingLot(false);
                          update({ newBatchNumber: "", newExpiresAt: "" });
                        }}
                      >
                        Usar um lote existente
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={form.lotId}
                        onValueChange={(value) => update({ lotId: value })}
                      >
                        <SelectTrigger className="h-9 flex-1 bg-card">
                          <SelectValue placeholder="Escolha o lote" />
                        </SelectTrigger>
                        <SelectContent>
                          {lots.map((lot) => (
                            <SelectItem key={lot.id} value={lot.id}>
                              {lot.batchNumber}
                              {lot.expiresAt ? ` · vence ${lot.expiresAt}` : ""}
                              {lot.status === "blocked" ? " (bloqueado)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.type !== "transferencia" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCreatingLot(true);
                            update({ lotId: "" });
                          }}
                        >
                          Novo lote
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {needsReason && (
                <input
                  value={form.reason}
                  onChange={(event) => update({ reason: event.target.value })}
                  placeholder="Justificativa (saldo ficaria negativo)"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button size="sm" disabled={submitting} onClick={() => void handleSubmit()}>
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Registrar"}
                </Button>
              </div>
            </div>
            {pendingAdjustments.length > 0 && (
              <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
                <p className="text-sm font-semibold">Pendentes de aprovação</p>
                {pendingAdjustments.map((pending) => (
                  <div
                    key={pending.id}
                    className="rounded-md border border-border bg-card p-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong>{pending.productName}</strong>
                        <span className="ml-2 text-muted-foreground">
                          {stockMovementTypeLabel[pending.type]}
                        </span>
                        <div>
                          {pending.quantity > 0 ? "+" : ""}
                          {pending.quantity} · {pending.reason}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setResolvingId(resolvingId === pending.id ? null : pending.id)
                        }
                      >
                        Analisar
                      </Button>
                    </div>
                    {resolvingId === pending.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={resolveNote}
                          onChange={(event) => setResolveNote(event.target.value)}
                          placeholder="Observação (obrigatória para recusar)"
                          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolving}
                          onClick={() => void handleResolve(pending.id, "reject")}
                        >
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          disabled={resolving}
                          onClick={() => void handleResolve(pending.id, "approve")}
                        >
                          {resolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Aprovar"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Extrato</p>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p>
              ) : (
                movements.map((movement) => {
                  const isReversal = Boolean(movement.reversalOf);
                  const alreadyReversed = movements.some((m) => m.reversalOf === movement.id);
                  return (
                    <div key={movement.id} className="rounded-md border border-border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong>{movement.productName}</strong>
                          <span className="ml-2 text-muted-foreground">
                            {stockMovementTypeLabel[movement.type]}
                            {isReversal && " (estorno)"}
                          </span>
                          <div className={movement.quantity < 0 ? "text-destructive" : ""}>
                            {movement.quantity > 0 ? "+" : ""}
                            {movement.quantity}
                            {movement.lotBatchNumber && ` · lote ${movement.lotBatchNumber}`}
                            {movement.reference && ` · ${movement.reference}`}
                          </div>
                        </div>
                        {!isReversal && !alreadyReversed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setReversingId(reversingId === movement.id ? null : movement.id)
                            }
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Estornar
                          </Button>
                        )}
                      </div>
                      {reversingId === movement.id && (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={reverseReason}
                            onChange={(event) => setReverseReason(event.target.value)}
                            placeholder="Justificativa do estorno"
                            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                          <Button
                            size="sm"
                            disabled={reversing}
                            onClick={() => void handleReverse(movement.id)}
                          >
                            {reversing ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              "Confirmar"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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

const movementStatusLabel: Record<string, string> = {
  none: "Sem diferença",
  posted: "Ajuste lançado",
  pending: "Ajuste pendente de aprovação",
};

function InventoryCountDialog({
  address,
  products,
  onClose,
  notify,
}: {
  address: WarehouseAddress;
  products: Product[];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [openCount, setOpenCount] = useState<InventoryCount | null>(null);
  const [finalizedItems, setFinalizedItems] = useState<InventoryCountItem[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [submittingItem, setSubmittingItem] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const reload = async () => {
    setLoading(true);
    setOpenCount(await getOpenInventoryCount(address.id));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o endereço muda
  }, [address.id]);

  const handleStart = async () => {
    setStarting(true);
    const result = await startInventoryCount(address.id);
    setStarting(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setFinalizedItems(null);
    void reload();
  };

  const handleAddItem = async () => {
    if (!openCount) return;
    if (!itemProductId) {
      notify("Escolha um produto.");
      return;
    }
    const quantity = Number(itemQuantity);
    if (!itemQuantity.trim() || quantity < 0) {
      notify("Informe a quantidade contada (zero ou mais).");
      return;
    }
    setSubmittingItem(true);
    const result = await setInventoryCountItem(openCount.id, itemProductId, quantity);
    setSubmittingItem(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setItemProductId("");
    setItemQuantity("");
    void reload();
  };

  const handleFinalize = async () => {
    if (!openCount) return;
    setFinalizing(true);
    const result = await finalizeInventoryCount(openCount.id);
    setFinalizing(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify("Contagem finalizada.");
    setFinalizedItems(
      result.items.map((item) => ({
        ...item,
        productName: products.find((product) => product.id === item.productId)?.name ?? "",
      })),
    );
    setOpenCount(null);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inventário — {address.code}</DialogTitle>
          <DialogDescription>
            Contagem cega: a quantidade contada não mostra o saldo do sistema até finalizar.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="grid place-items-center p-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : openCount ? (
          <>
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-semibold">Itens contados</p>
              {openCount.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item contado ainda.</p>
              ) : (
                openCount.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.productName}</span>
                    <span>{item.countedQuantity}</span>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-semibold">Contar produto</p>
              <div className="grid grid-cols-2 gap-3">
                <Select value={itemProductId} onValueChange={setItemProductId}>
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
                  value={itemQuantity}
                  onChange={(event) => setItemQuantity(event.target.value)}
                  placeholder="Quantidade contada"
                  className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={submittingItem} onClick={() => void handleAddItem()}>
                  {submittingItem ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Registrar contagem"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button disabled={finalizing} onClick={() => void handleFinalize()}>
                {finalizing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Finalizar contagem"}
              </Button>
            </div>
          </>
        ) : finalizedItems ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Resultado da contagem</p>
            {finalizedItems.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex justify-between">
                  <strong>{item.productName}</strong>
                  <span>contado {item.countedQuantity}</span>
                </div>
                <div className="text-muted-foreground">
                  teórico {item.theoreticalBalance} · diferença{" "}
                  {item.difference !== null && item.difference > 0 ? "+" : ""}
                  {item.difference} ·{" "}
                  {item.resultingMovementStatus
                    ? movementStatusLabel[item.resultingMovementStatus]
                    : ""}
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button size="sm" disabled={starting} onClick={() => void handleStart()}>
                {starting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Nova contagem"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <h3 className="font-bold">Nenhuma contagem em aberto</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicie uma contagem para começar a registrar as quantidades.
            </p>
            <Button className="mt-4" disabled={starting} onClick={() => void handleStart()}>
              {starting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Iniciar contagem"}
            </Button>
          </div>
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
