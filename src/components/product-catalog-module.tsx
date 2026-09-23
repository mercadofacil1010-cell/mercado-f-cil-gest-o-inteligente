// Cadastro real de produtos (B2.2): nome, categoria, marca, código de barras,
// unidade base e a cadeia de embalagens/conversões. Estoque, preço e lotes de
// verdade (por mercado) ainda não existem — chegam no B2.3/B3. Esta tela
// substitui, para "Produtos", os dados de demonstração do catálogo; "Estoque
// consolidado" e "Validades" continuam com o módulo de demonstração até lá.
import { useEffect, useState, type ReactNode } from "react";
import { Package2, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  baseUnitLabel,
  createBrand,
  createCategory,
  createPackaging,
  createProduct,
  inactivatePackaging,
  inactivateProduct,
  listBrands,
  listCategories,
  listPackagings,
  listProducts,
  updatePackagingFactor,
  updateProduct,
  type BaseUnit,
  type Packaging,
  type PackagingFormData,
  type Product,
  type ProductFormData,
  type SupportItem,
} from "@/lib/products-api";

const emptyProductForm: ProductFormData = {
  name: "",
  description: "",
  categoryId: null,
  brandId: null,
  barcode: "",
  sku: "",
  baseUnit: "unidade",
  isWeighable: false,
  tracksBatchExpiry: false,
};

const NEW_OPTION = "__new__";

function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProductCatalogModule({
  companyId,
  notify,
}: {
  companyId: string | null;
  notify: (message: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<SupportItem[]>([]);
  const [brands, setBrands] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [managingPackagings, setManagingPackagings] = useState<Product | null>(null);

  const reload = async () => {
    if (!companyId) {
      setProducts([]);
      setCategories([]);
      setBrands([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [productList, categoryList, brandList] = await Promise.all([
      listProducts(companyId),
      listCategories(companyId),
      listBrands(companyId),
    ]);
    setProducts(productList);
    setCategories(categoryList);
    setBrands(brandList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando a empresa muda
  }, [companyId]);

  const requestInactivate = async (product: Product) => {
    if (!window.confirm(`Inativar "${product.name}"? Essa ação não pode ser desfeita por aqui.`))
      return;
    const result = await inactivateProduct(product.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`${product.name} foi inativado.`);
    void reload();
  };

  return (
    <Page
      title="Produtos"
      subtitle="Catálogo de produtos da rede: nome, categoria, marca e embalagens"
      action={
        companyId ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid place-items-center rounded-lg border border-border bg-card p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <h3 className="font-bold">Nenhum produto cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em "Novo produto" para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                {[
                  "Produto",
                  "Categoria",
                  "Marca",
                  "Unidade base",
                  "Código de barras",
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
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border last:border-0 hover:bg-muted/60"
                >
                  <td className="px-4 py-3">
                    <strong>{product.name}</strong>
                    {product.isWeighable && (
                      <span className="ml-2 text-xs text-muted-foreground">Pesável</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{product.categoryName || "—"}</td>
                  <td className="px-4 py-3">{product.brandName || "—"}</td>
                  <td className="px-4 py-3">{baseUnitLabel[product.baseUnit]}</td>
                  <td className="px-4 py-3">{product.barcode || "—"}</td>
                  <td className="px-4 py-3">
                    <AlertPill
                      label={product.status === "active" ? "Ativo" : "Inativo"}
                      tone={product.status === "active" ? "positive" : "neutral"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManagingPackagings(product)}
                      >
                        <Package2 className="h-3.5 w-3.5" /> Embalagens
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(product)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void requestInactivate(product)}
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
      {(formOpen || editing) && companyId && (
        <ProductDialog
          companyId={companyId}
          product={editing}
          categories={categories}
          brands={brands}
          onCategoryCreated={(item) =>
            setCategories((current) =>
              [...current, item].sort((a, b) => a.name.localeCompare(b.name)),
            )
          }
          onBrandCreated={(item) =>
            setBrands((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name)))
          }
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={(verb) => {
            setFormOpen(false);
            setEditing(null);
            notify(`Produto ${verb} com sucesso.`);
            void reload();
          }}
        />
      )}
      {managingPackagings && (
        <PackagingsDialog
          product={managingPackagings}
          onClose={() => setManagingPackagings(null)}
          notify={notify}
        />
      )}
    </Page>
  );
}

function ProductDialog({
  companyId,
  product,
  categories,
  brands,
  onCategoryCreated,
  onBrandCreated,
  onClose,
  onSaved,
}: {
  companyId: string;
  product: Product | null;
  categories: SupportItem[];
  brands: SupportItem[];
  onCategoryCreated: (item: SupportItem) => void;
  onBrandCreated: (item: SupportItem) => void;
  onClose: () => void;
  onSaved: (verb: "adicionado" | "atualizado") => void;
}) {
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          brandId: product.brandId,
          barcode: product.barcode,
          sku: product.sku,
          baseUnit: product.baseUnit,
          isWeighable: product.isWeighable,
          tracksBatchExpiry: product.tracksBatchExpiry,
        }
      : emptyProductForm,
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<ProductFormData>) =>
    setForm((current) => ({ ...current, ...patch }));

  const handleCategoryChange = async (value: string) => {
    if (value !== NEW_OPTION) {
      update({ categoryId: value });
      return;
    }
    const name = window.prompt("Nome da nova categoria:");
    if (!name?.trim()) return;
    const created = await createCategory(companyId, name);
    if (!created) {
      setError("Não foi possível criar a categoria.");
      return;
    }
    onCategoryCreated(created);
    update({ categoryId: created.id });
  };

  const handleBrandChange = async (value: string) => {
    if (value !== NEW_OPTION) {
      update({ brandId: value });
      return;
    }
    const name = window.prompt("Nome da nova marca:");
    if (!name?.trim()) return;
    const created = await createBrand(companyId, name);
    if (!created) {
      setError("Não foi possível criar a marca.");
      return;
    }
    onBrandCreated(created);
    update({ brandId: created.id });
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    setSubmitting(true);
    const result = product
      ? await updateProduct(product.id, form)
      : await createProduct(companyId, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(product ? "atualizado" : "adicionado");
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[520px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Só nome e unidade base são obrigatórios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Nome</span>
            <input
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Descrição (opcional)</span>
            <input
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Categoria (opcional)</span>
              <Select
                value={form.categoryId ?? ""}
                onValueChange={(value) => void handleCategoryChange(value)}
              >
                <SelectTrigger className="h-11 bg-card">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_OPTION}>+ Criar nova categoria</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Marca (opcional)</span>
              <Select
                value={form.brandId ?? ""}
                onValueChange={(value) => void handleBrandChange(value)}
              >
                <SelectTrigger className="h-11 bg-card">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_OPTION}>+ Criar nova marca</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Código de barras (opcional)</span>
              <input
                value={form.barcode}
                onChange={(event) => update({ barcode: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">SKU (opcional)</span>
              <input
                value={form.sku}
                onChange={(event) => update({ sku: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Unidade base</span>
            <Select
              value={form.baseUnit}
              onValueChange={(value) => update({ baseUnit: value as BaseUnit })}
              disabled={Boolean(product)}
            >
              <SelectTrigger className="h-11 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unidade">{baseUnitLabel.unidade}</SelectItem>
                <SelectItem value="quilograma">{baseUnitLabel.quilograma}</SelectItem>
                <SelectItem value="litro">{baseUnitLabel.litro}</SelectItem>
              </SelectContent>
            </Select>
            {product && (
              <span className="mt-1 block text-xs text-muted-foreground">
                A unidade base não pode ser trocada depois de criado.
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isWeighable}
              onCheckedChange={(checked) => update({ isWeighable: checked === true })}
            />
            <span>Produto pesável ou de medida fracionada</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.tracksBatchExpiry}
              onCheckedChange={(checked) => update({ tracksBatchExpiry: checked === true })}
            />
            <span>Controla lote e validade</span>
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
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PackagingsDialog({
  product,
  onClose,
  notify,
}: {
  product: Product;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [editingFactor, setEditingFactor] = useState<Packaging | null>(null);

  const reload = async () => {
    setLoading(true);
    setPackagings(await listPackagings(product.id));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o produto muda
  }, [product.id]);

  const requestInactivate = async (packaging: Packaging) => {
    if (packaging.isBase) {
      notify("A embalagem-base não pode ser inativada.");
      return;
    }
    if (!window.confirm(`Inativar a embalagem "${packaging.name}"?`)) return;
    const result = await inactivatePackaging(packaging.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    void reload();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Embalagens de {product.name}</DialogTitle>
          <DialogDescription>
            Cada embalagem converte para a unidade base ({baseUnitLabel[product.baseUnit]}). Trocar
            um fator cria uma nova versão, sem apagar o histórico.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="grid place-items-center p-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {packagings.map((packaging) => (
              <div
                key={packaging.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <strong>{packaging.name}</strong>
                  {packaging.isBase && (
                    <span className="ml-2 text-xs text-muted-foreground">(base)</span>
                  )}
                  <div className="text-muted-foreground">
                    1 {packaging.name.toLowerCase()} = {packaging.conversionFactor}{" "}
                    {baseUnitLabel[product.baseUnit].toLowerCase()}
                    {packaging.barcode && ` · ${packaging.barcode}`}
                  </div>
                </div>
                {!packaging.isBase && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingFactor(packaging)}>
                      Editar fator
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void requestInactivate(packaging)}
                    >
                      Inativar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {addingNew ? (
          <NewPackagingForm
            productId={product.id}
            onCancel={() => setAddingNew(false)}
            onCreated={() => {
              setAddingNew(false);
              void reload();
            }}
          />
        ) : (
          <Button variant="outline" onClick={() => setAddingNew(true)}>
            <Plus className="h-4 w-4" /> Nova embalagem
          </Button>
        )}
        {editingFactor && (
          <EditFactorForm
            packaging={editingFactor}
            onCancel={() => setEditingFactor(null)}
            onSaved={() => {
              setEditingFactor(null);
              void reload();
            }}
          />
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

function NewPackagingForm({
  productId,
  onCancel,
  onCreated,
}: {
  productId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<PackagingFormData>({
    name: "",
    barcode: "",
    conversionFactor: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Informe o nome da embalagem (ex: Caixa, Fardo).");
      return;
    }
    if (!form.conversionFactor.trim() || Number(form.conversionFactor) <= 0) {
      setError("Informe um fator de conversão maior que zero.");
      return;
    }
    setSubmitting(true);
    const result = await createPackaging(productId, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated();
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nome (ex: Caixa)"
          className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="number"
          min="0"
          step="0.001"
          value={form.conversionFactor}
          onChange={(event) =>
            setForm((current) => ({ ...current, conversionFactor: event.target.value }))
          }
          placeholder="Fator (ex: 12)"
          className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <input
        value={form.barcode}
        onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
        placeholder="Código de barras (opcional)"
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}

function EditFactorForm({
  packaging,
  onCancel,
  onSaved,
}: {
  packaging: Packaging;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [factor, setFactor] = useState(String(packaging.conversionFactor));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!factor.trim() || Number(factor) <= 0) {
      setError("Informe um fator de conversão maior que zero.");
      return;
    }
    setSubmitting(true);
    const result = await updatePackagingFactor(packaging, factor);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">Novo fator para "{packaging.name}"</p>
      <input
        type="number"
        min="0"
        step="0.001"
        value={factor}
        onChange={(event) => setFactor(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar novo fator"}
        </Button>
      </div>
    </div>
  );
}
