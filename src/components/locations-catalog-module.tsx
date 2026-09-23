// Endereçamento real de depósito e gôndola por mercado (B3.1). Substitui,
// para este mercado, os dados de demonstração de "Gôndolas"/"Depósito" por
// leitura e gravação de verdade no Supabase. Estoque físico e movimentos
// (quanto tem em cada endereço) chegam no B3.2 — aqui só existe a estrutura
// (endereços, posições, capacidade e, na gôndola, mínimo/ideal/máximo).
import { useEffect, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field("Rua", "street")}
            {field("Corredor", "aisle")}
            {field("Estante", "shelf")}
            {field("Nível/Posição", "position")}
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
