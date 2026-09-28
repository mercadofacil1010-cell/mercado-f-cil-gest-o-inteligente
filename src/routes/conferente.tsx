import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  PackageSearch,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AlertPill } from "@/components/dashboard-ui";
import { useAuth } from "@/lib/auth-context";
import { getConferenteContext, type ConferenteContext } from "@/lib/conferente-api";
import { listReceivings, receivingStatusLabel, type Receiving } from "@/lib/receivings-api";
import {
  findProductByBarcode,
  listPackagings,
  type Packaging,
  type Product,
} from "@/lib/products-api";
import {
  addReceivingCount,
  conditionLabel,
  listCountedItems,
  removeReceivingCount,
  startReceivingConference,
  type CountedItem,
  type ReceivingItemCondition,
} from "@/lib/receiving-conference-api";

export const Route = createFileRoute("/conferente")({
  head: () => ({
    meta: [{ title: "App do Conferente | Mercado Fácil" }, { name: "robots", content: "noindex" }],
  }),
  component: ConferenteRoute,
});

// Experiência própria do conferente (Correção 1/DEC-B4-01): rota separada do
// painel do dono, não uma aba dentro dele. O acabamento visual completo de
// app mobile (menu inferior, Correção 2) fica para um refinamento
// posterior — aqui já nasce a separação de acesso e de dados corretamente.
function ConferenteRoute() {
  const navigate = useNavigate();
  const { session, loading, signIn, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [context, setContext] = useState<ConferenteContext>(null);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!session) {
      setChecking(false);
      setContext(null);
      return;
    }
    setChecking(true);
    void getConferenteContext(session.user.id).then((result) => {
      if (!active) return;
      setContext(result);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [session, loading]);

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <ConferenteLogin onLoggedIn={() => setChecking(true)} signIn={signIn} />;
  }

  if (!context) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-8" />
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-extrabold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Esta conta não está cadastrada como conferente em nenhum mercado.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => void signOut()}>
              Sair e entrar com outra conta
            </Button>
            <Button onClick={() => void navigate({ to: "/" })}>Ir para o login de cliente</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConferenteHome
      companyId={context.companyId}
      markets={context.markets}
      onSignOut={() => void signOut()}
    />
  );
}

type SignIn = ReturnType<typeof useAuth>["signIn"];

function ConferenteLogin({ onLoggedIn, signIn }: { onLoggedIn: () => void; signIn: SignIn }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      if (result.reason === "locked") {
        const minutes = Math.ceil(result.retryAfterSeconds / 60);
        setError(
          `Muitas tentativas erradas. Tente novamente em ${minutes} minuto${minutes === 1 ? "" : "s"}.`,
        );
        return;
      }
      setError(result.message);
      return;
    }
    onLoggedIn();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px]">
        <BrandLogo className="mb-8" />
        <h1 className="text-2xl font-extrabold text-foreground">App do Conferente</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Login de quem recebe mercadoria. Se você é dono ou gerente, use o
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="ml-1 font-semibold text-primary hover:underline"
          >
            painel do dono
          </button>
          .
        </p>
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">E-mail</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">Senha</span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="h-12 w-full rounded-md border border-input bg-card px-4 pr-12 text-base text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
              <Button
                type="button"
                variant="ghost"
                className="absolute right-1 top-0 h-12 min-h-0 w-11 px-0"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Entrar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}

function ConferenteHome({
  companyId,
  markets,
  onSignOut,
}: {
  companyId: string;
  markets: { id: string; name: string }[];
  onSignOut: () => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.id ?? "");
  const [receivings, setReceivings] = useState<Receiving[]>([]);
  const [loading, setLoading] = useState(true);
  const [openReceiving, setOpenReceiving] = useState<Receiving | null>(null);

  const reload = () => {
    if (!selectedMarket) {
      setReceivings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void listReceivings(selectedMarket).then((list) => {
      setReceivings(list);
      setLoading(false);
    });
  };

  useEffect(reload, [selectedMarket]);

  if (openReceiving) {
    return (
      <BlindCountScreen
        companyId={companyId}
        receiving={openReceiving}
        onBack={() => {
          setOpenReceiving(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-5 bg-background p-5">
      <div className="flex items-center justify-between">
        <BrandLogo />
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sair
        </Button>
      </div>
      <h1 className="text-xl font-extrabold">Recebimentos</h1>

      {markets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não está vinculado a nenhum mercado.
        </p>
      ) : (
        <>
          {markets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {markets.map((market) => (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => setSelectedMarket(market.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                    selectedMarket === market.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {market.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : receivings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum recebimento cadastrado neste mercado ainda.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {receivings.map((receiving) => (
                <li
                  key={receiving.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenReceiving(receiving)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setOpenReceiving(receiving);
                  }}
                  className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow-card outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate">
                        {receiving.supplierName || "Fornecedor não informado"}
                      </strong>
                      <span className="block text-sm text-muted-foreground">
                        {receiving.invoiceNumber
                          ? `NF ${receiving.invoiceNumber}`
                          : "Sem nota fiscal"}
                      </span>
                    </div>
                    <AlertPill label={receivingStatusLabel[receiving.status]} tone="neutral" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const emptyCountForm = {
  quantity: "",
  batchNumber: "",
  manufacturedAt: "",
  expiresAt: "",
  condition: "bom_estado" as ReceivingItemCondition,
  note: "",
};

function BlindCountScreen({
  companyId,
  receiving,
  onBack,
}: {
  companyId: string;
  receiving: Receiving;
  onBack: () => void;
}) {
  const [status, setStatus] = useState(receiving.status);
  const [starting, setStarting] = useState(false);
  const [items, setItems] = useState<CountedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [packagingId, setPackagingId] = useState("");
  const [form, setForm] = useState(emptyCountForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reloadItems = () => {
    setLoadingItems(true);
    void listCountedItems(receiving.id).then((list) => {
      setItems(list);
      setLoadingItems(false);
    });
  };

  useEffect(() => {
    if (status === "em_conferencia") reloadItems();
    else setLoadingItems(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando muda o status
  }, [status]);

  const handleStart = async () => {
    setStarting(true);
    const result = await startReceivingConference(receiving.id);
    setStarting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus("em_conferencia");
  };

  const handleSearch = async () => {
    setSearchError("");
    const code = barcode.trim();
    if (!code) {
      setSearchError("Digite o código de barras.");
      return;
    }
    setSearching(true);
    const found = await findProductByBarcode(companyId, code);
    if (!found) {
      setSearching(false);
      setProduct(null);
      setSearchError("Produto não encontrado para este código de barras.");
      return;
    }
    const packagingList = await listPackagings(found.id);
    setSearching(false);
    setProduct(found);
    setPackagings(packagingList);
    setPackagingId(packagingList.find((item) => item.isBase)?.id ?? packagingList[0]?.id ?? "");
    setForm(emptyCountForm);
  };

  const handleAdd = async () => {
    if (!product || !packagingId) return;
    setError("");
    const quantity = Number(form.quantity);
    if (!form.quantity.trim() || quantity <= 0) {
      setError("Informe a quantidade contada.");
      return;
    }
    setSubmitting(true);
    const result = await addReceivingCount(receiving.id, product.id, packagingId, quantity, {
      batchNumber: form.batchNumber,
      manufacturedAt: form.manufacturedAt,
      expiresAt: form.expiresAt,
      condition: form.condition,
      note: form.note,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setProduct(null);
    setBarcode("");
    setForm(emptyCountForm);
    reloadItems();
  };

  const handleRemove = async (id: string) => {
    const result = await removeReceivingCount(id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    reloadItems();
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-5 bg-background p-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">
            {receiving.supplierName || "Recebimento"}
          </h1>
          <span className="text-sm text-muted-foreground">
            {receiving.invoiceNumber ? `NF ${receiving.invoiceNumber}` : "Sem nota fiscal"}
          </span>
        </div>
      </div>

      {status === "aguardando_recebimento" ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Confira o fornecedor e a nota acima. Ao iniciar, o sistema não mostra o que é esperado —
            conte fisicamente cada item.
          </p>
          <Button className="mt-4 w-full" disabled={starting} onClick={() => void handleStart()}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar conferência"}
          </Button>
        </div>
      ) : status !== "em_conferencia" ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Esta conferência já foi encerrada ({receivingStatusLabel[status]}). O resultado fica com
            o gestor.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
            <EyeOff className="h-4 w-4 shrink-0" /> Conte fisicamente cada item. O sistema não
            mostra quantidades esperadas.
          </div>

          <section className="rounded-lg border border-border bg-card p-4 shadow-card">
            <h2 className="font-extrabold">Identificar produto</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSearch();
                }}
                inputMode="numeric"
                placeholder="Código de barras"
                className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button variant="outline" disabled={searching} onClick={() => void handleSearch()}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {searchError && <p className="mt-2 text-sm text-destructive">{searchError}</p>}

            {product && (
              <div className="mt-4 space-y-3">
                <p className="font-semibold">{product.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={packagingId}
                    onChange={(event) => setPackagingId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {packagings.map((packaging) => (
                      <option key={packaging.id} value={packaging.id}>
                        {packaging.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.quantity}
                    onChange={(event) => setForm((f) => ({ ...f, quantity: event.target.value }))}
                    placeholder="Quantidade contada"
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.batchNumber}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, batchNumber: event.target.value }))
                    }
                    placeholder="Lote (opcional)"
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={form.condition}
                    onChange={(event) =>
                      setForm((f) => ({
                        ...f,
                        condition: event.target.value as ReceivingItemCondition,
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(Object.keys(conditionLabel) as ReceivingItemCondition[]).map((key) => (
                      <option key={key} value={key}>
                        {conditionLabel[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Fabricação</span>
                    <input
                      type="date"
                      value={form.manufacturedAt}
                      onChange={(event) =>
                        setForm((f) => ({ ...f, manufacturedAt: event.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Validade</span>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(event) =>
                        setForm((f) => ({ ...f, expiresAt: event.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((f) => ({ ...f, note: event.target.value }))}
                  placeholder="Observação (opcional)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" disabled={submitting} onClick={() => void handleAdd()}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Adicionar à conferência"
                  )}
                </Button>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-extrabold">Itens contados</h2>
            {loadingItems ? (
              <div className="grid place-items-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item contado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <strong>{item.productName}</strong>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleRemove(item.id)}
                        aria-label={`Remover ${item.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="block text-muted-foreground">
                      {item.countedQuantity} {item.packagingName}
                      {item.batchNumber && ` · Lote ${item.batchNumber}`}
                      {item.condition !== "bom_estado" && ` · ${conditionLabel[item.condition]}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
