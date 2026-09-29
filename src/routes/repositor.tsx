import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  PackageSearch,
  ShieldAlert,
  Warehouse,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AlertPill, type Tone } from "@/components/dashboard-ui";
import { PhotoCapture } from "@/components/photo-capture";
import { BarcodeScannerButton } from "@/components/barcode-scanner";
import { OfflineStatusBadge } from "@/components/offline-status-badge";
import { useAuth } from "@/lib/auth-context";
import { getRepositorContext, type RepositorContext } from "@/lib/repositor-api";
import { listWarehouseAddresses, type WarehouseAddress } from "@/lib/locations-api";
import { registerAppShellServiceWorker } from "@/lib/pwa-register";
import { cacheGet, cacheSet } from "@/lib/offline-db";
import { runOrQueue, useOnlineStatus } from "@/lib/offline-sync";
import {
  acceptReplenishmentTask,
  listReplenishmentTasks,
  registerReplenishmentImpediment,
  registerReplenishmentReturn,
  registerReplenishmentWithdrawal,
  replenishmentTaskStatusLabel,
  submitReplenishmentCount,
  type ReplenishmentTask,
  type ReplenishmentTaskStatus,
} from "@/lib/replenishment-api";

// App instalável (B5.5, DEC-B5-13): manifest próprio (start_url/scope
// /repositor) — instalar aqui não instala o /conferente nem o resto do app.
export const Route = createFileRoute("/repositor")({
  head: () => ({
    meta: [
      { title: "App do Repositor | Mercado Fácil" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#131c2e" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-repositor.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/app-icon-192.png" },
    ],
  }),
  component: RepositorRoute,
});

const statusTone: Record<ReplenishmentTaskStatus, Tone> = {
  pendente: "neutral",
  aceita: "neutral",
  em_transito: "warning",
  com_inconsistencia: "critical",
  concluida: "positive",
};

// Experiência própria do repositor (Correção 1/DEC-B4-01, mesmo padrão do
// /conferente): rota separada do painel do dono, não uma aba dentro dele.
function RepositorRoute() {
  const navigate = useNavigate();
  const { session, loading, signIn, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [context, setContext] = useState<RepositorContext>(null);

  useEffect(() => {
    registerAppShellServiceWorker();
  }, []);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!session) {
      setChecking(false);
      setContext(null);
      return;
    }
    setChecking(true);
    void getRepositorContext(session.user.id).then((result) => {
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
    return <RepositorLogin onLoggedIn={() => setChecking(true)} signIn={signIn} />;
  }

  if (!context) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-8" />
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-extrabold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Esta conta não está cadastrada como repositor em nenhum mercado.
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
    <RepositorHome
      companyId={context.companyId}
      markets={context.markets}
      onSignOut={() => void signOut()}
    />
  );
}

type SignIn = ReturnType<typeof useAuth>["signIn"];

function RepositorLogin({ onLoggedIn, signIn }: { onLoggedIn: () => void; signIn: SignIn }) {
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
        <h1 className="text-2xl font-extrabold text-foreground">App do Repositor</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Login de quem repõe a gôndola. Se você é dono ou gerente, use o
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

function RepositorHome({
  companyId,
  markets,
  onSignOut,
}: {
  companyId: string;
  markets: { id: string; name: string }[];
  onSignOut: () => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.id ?? "");
  const [tasks, setTasks] = useState<ReplenishmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<ReplenishmentTask | null>(null);

  const online = useOnlineStatus();

  const reload = () => {
    if (!selectedMarket) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const cacheKey = `repositor:tasks:${selectedMarket}`;
    if (!navigator.onLine) {
      void cacheGet<ReplenishmentTask[]>(cacheKey).then((cached) => {
        setTasks(cached ?? []);
        setLoading(false);
      });
      return;
    }
    void listReplenishmentTasks(selectedMarket).then((list) => {
      setTasks(list);
      setLoading(false);
      void cacheSet(cacheKey, list);
    });
  };

  useEffect(reload, [selectedMarket]);

  if (openTask) {
    return (
      <TaskScreen
        companyId={companyId}
        marketId={selectedMarket}
        task={openTask}
        onBack={() => {
          setOpenTask(null);
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
      <OfflineStatusBadge />
      <h1 className="text-xl font-extrabold">Reposições</h1>

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
          ) : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma tarefa de reposição pendente ou sua no momento.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => {
                const opensOfflineBlocked = !online && task.status === "pendente";
                return (
                  <li
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-disabled={opensOfflineBlocked}
                    onClick={() => {
                      if (opensOfflineBlocked) return;
                      setOpenTask(task);
                    }}
                    onKeyDown={(event) => {
                      if (opensOfflineBlocked) return;
                      if (event.key === "Enter" || event.key === " ") setOpenTask(task);
                    }}
                    className={`rounded-lg border border-border bg-card p-4 shadow-card outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
                      opensOfflineBlocked
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate">{task.productName}</strong>
                        <span className="block text-sm text-muted-foreground">
                          {task.gondolaPositionCode} · sugerido {task.quantityNeeded}
                        </span>
                        {opensOfflineBlocked && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Precisa de internet para aceitar esta tarefa.
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <AlertPill
                          label={replenishmentTaskStatusLabel[task.status]}
                          tone={statusTone[task.status]}
                        />
                        {task.isRuptura && <AlertPill label="Ruptura" tone="critical" />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function TaskScreen({
  companyId,
  marketId,
  task,
  onBack,
}: {
  companyId: string;
  marketId: string;
  task: ReplenishmentTask;
  onBack: () => void;
}) {
  const [addresses, setAddresses] = useState<WarehouseAddress[]>([]);
  const [status, setStatus] = useState(task.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [withdrawQuantity, setWithdrawQuantity] = useState(String(task.quantityNeeded));
  const [sourceAddressId, setSourceAddressId] = useState("");
  const [productScanned, setProductScanned] = useState(false);
  const [productScanError, setProductScanError] = useState("");

  const [returnDone, setReturnDone] = useState(false);
  const [returnedQuantity, setReturnedQuantity] = useState("0");
  const [returnAddressId, setReturnAddressId] = useState("");
  const [positionScanned, setPositionScanned] = useState(false);
  const [positionScanError, setPositionScanError] = useState("");

  const [countedQuantity, setCountedQuantity] = useState("");
  const [countFeedback, setCountFeedback] = useState("");

  const [showImpediment, setShowImpediment] = useState(false);
  const [impedimentReason, setImpedimentReason] = useState("");
  const [impedimentPhotoPath, setImpedimentPhotoPath] = useState<string | null>(null);

  const online = useOnlineStatus();

  useEffect(() => {
    const cacheKey = `repositor:addresses:${marketId}`;
    if (!navigator.onLine) {
      void cacheGet<WarehouseAddress[]>(cacheKey).then((cached) => setAddresses(cached ?? []));
      return;
    }
    void listWarehouseAddresses(marketId).then((list) => {
      setAddresses(list);
      void cacheSet(cacheKey, list);
    });
  }, [marketId]);

  const handleAccept = async () => {
    setBusy(true);
    setError("");
    const result = await acceptReplenishmentTask(task.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus("aceita");
  };

  const handleProductScan = (code: string) => {
    setProductScanError("");
    if (code !== task.productBarcode) {
      setProductScanned(false);
      setProductScanError(
        "Código não bate com o produto desta tarefa. Confira e escaneie de novo.",
      );
      return;
    }
    setProductScanned(true);
  };

  const handlePositionScan = (code: string) => {
    setPositionScanError("");
    if (code !== task.gondolaPositionCode) {
      setPositionScanned(false);
      setPositionScanError(
        "Código não bate com a posição desta tarefa. Confira e escaneie de novo.",
      );
      return;
    }
    setPositionScanned(true);
  };

  const handleWithdrawal = async () => {
    setError("");
    const quantity = Number(withdrawQuantity);
    if (!withdrawQuantity.trim() || quantity <= 0) {
      setError("Informe a quantidade retirada.");
      return;
    }
    if (!sourceAddressId) {
      setError("Escolha o endereço de depósito.");
      return;
    }
    if (task.productBarcode && !productScanned) {
      setError("Escaneie o código de barras do produto para confirmar antes de retirar.");
      return;
    }
    setBusy(true);
    const result = await runOrQueue(
      "repositor",
      marketId,
      {
        actionType: "replenishment_withdrawal",
        payload: { taskId: task.id, quantity, sourceWarehouseAddressId: sourceAddressId },
      },
      () => registerReplenishmentWithdrawal(task.id, quantity, sourceAddressId),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus("em_transito");
    if (result.queued) setError("Sem internet — retirada guardada, vai sincronizar depois.");
  };

  const handleReturn = async () => {
    setError("");
    const returned = Number(returnedQuantity || "0");
    if (returned > 0 && !returnAddressId) {
      setError("Escolha o endereço para devolver a sobra.");
      return;
    }
    if (task.gondolaPositionCode && !positionScanned) {
      setError("Escaneie o código da posição da gôndola para confirmar antes de continuar.");
      return;
    }
    setBusy(true);
    const result = await runOrQueue(
      "repositor",
      marketId,
      {
        actionType: "replenishment_return",
        payload: {
          taskId: task.id,
          quantityReturned: returned,
          ...(returned > 0 ? { returnWarehouseAddressId: returnAddressId } : {}),
        },
      },
      () =>
        registerReplenishmentReturn(task.id, returned, returned > 0 ? returnAddressId : undefined),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReturnDone(true);
    if (result.queued) setError("Sem internet — devolução guardada, vai sincronizar depois.");
  };

  const handleCount = async () => {
    setError("");
    setCountFeedback("");
    const counted = Number(countedQuantity);
    if (!countedQuantity.trim() || counted < 0) {
      setError("Informe a quantidade contada na prateleira.");
      return;
    }
    if (!online) {
      setError(
        "A contagem cega precisa de internet — o sistema compara com o saldo na hora e não dá para fazer isso offline.",
      );
      return;
    }
    setBusy(true);
    const result = await submitReplenishmentCount(task.id, counted);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.status === "concluida") {
      setStatus("concluida");
      return;
    }
    if (result.status === "com_inconsistencia") {
      setStatus("com_inconsistencia");
      return;
    }
    setCountedQuantity("");
    setCountFeedback(`Não bateu — tente contar de novo (tentativa ${result.attempt + 1} de 3).`);
  };

  const handleImpediment = async () => {
    setError("");
    if (!impedimentReason.trim()) {
      setError("Informe o motivo do impedimento.");
      return;
    }
    setBusy(true);
    const result = await runOrQueue(
      "repositor",
      marketId,
      {
        actionType: "replenishment_impediment",
        payload: { taskId: task.id, reason: impedimentReason, photoPath: impedimentPhotoPath },
      },
      () => registerReplenishmentImpediment(task.id, impedimentReason, impedimentPhotoPath),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onBack();
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-5 bg-background p-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">{task.productName}</h1>
          <span className="text-sm text-muted-foreground">
            {task.gondolaPositionCode} · sugerido {task.quantityNeeded}
          </span>
        </div>
      </div>
      <OfflineStatusBadge />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {status === "pendente" && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Aceite a tarefa para começar a repor este produto.
          </p>
          <Button className="mt-4 w-full" disabled={busy} onClick={() => void handleAccept()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar tarefa"}
          </Button>
        </div>
      )}

      {status === "aceita" && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="font-extrabold">Retirada do depósito</h2>
          <p className="text-sm text-muted-foreground">
            Informe a quantidade que você realmente retirou — pode ser diferente da sugerida.
          </p>
          <select
            value={sourceAddressId}
            onChange={(event) => setSourceAddressId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Endereço de depósito</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.code}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.001"
            value={withdrawQuantity}
            onChange={(event) => setWithdrawQuantity(event.target.value)}
            placeholder="Quantidade retirada"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {task.productBarcode && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarcodeScannerButton
                  label={productScanned ? "Produto conferido" : "Escanear produto"}
                  onScan={handleProductScan}
                />
                {productScanned && (
                  <span className="text-sm font-semibold text-success">Bateu com a tarefa.</span>
                )}
              </div>
              {productScanError && <p className="text-sm text-destructive">{productScanError}</p>}
            </div>
          )}
          <Button className="w-full" disabled={busy} onClick={() => void handleWithdrawal()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar retirada"}
          </Button>
        </section>
      )}

      {status === "em_transito" && !returnDone && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="font-extrabold">Sobra devolvida</h2>
          <p className="text-sm text-muted-foreground">
            Se sobrou alguma quantidade que você não repôs na gôndola, informe aqui. Se não sobrou
            nada, deixe zero e continue.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              Quantidade devolvida (sobra)
            </span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={returnedQuantity}
              onChange={(event) => setReturnedQuantity(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {Number(returnedQuantity || "0") > 0 && (
            <select
              value={returnAddressId}
              onChange={(event) => setReturnAddressId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Endereço para devolver a sobra</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.code}
                </option>
              ))}
            </select>
          )}
          {task.gondolaPositionCode && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarcodeScannerButton
                  label={positionScanned ? "Posição conferida" : "Escanear posição da gôndola"}
                  onScan={handlePositionScan}
                />
                {positionScanned && (
                  <span className="text-sm font-semibold text-success">Bateu com a tarefa.</span>
                )}
              </div>
              {positionScanError && <p className="text-sm text-destructive">{positionScanError}</p>}
            </div>
          )}
          <Button className="w-full" disabled={busy} onClick={() => void handleReturn()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
          </Button>
        </section>
      )}

      {status === "em_transito" && returnDone && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="font-extrabold">Contagem cega da gôndola</h2>
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
            <EyeOff className="h-4 w-4 shrink-0" /> Conte fisicamente o total que está na prateleira
            agora. O sistema não mostra o saldo esperado.
          </div>
          <input
            type="number"
            min="0"
            step="0.001"
            value={countedQuantity}
            onChange={(event) => setCountedQuantity(event.target.value)}
            placeholder="Quantidade contada na prateleira"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {countFeedback && <p className="text-sm text-warning">{countFeedback}</p>}
          <Button className="w-full" disabled={busy} onClick={() => void handleCount()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar contagem"}
          </Button>
        </section>
      )}

      {(status === "aceita" || status === "em_transito") && (
        <section className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          {showImpediment ? (
            <div className="space-y-2">
              <textarea
                value={impedimentReason}
                onChange={(event) => setImpedimentReason(event.target.value)}
                placeholder="Motivo do impedimento (ex.: gôndola quebrada)"
                className="min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <PhotoCapture
                companyId={companyId}
                marketId={marketId}
                photoPath={impedimentPhotoPath}
                onChange={setImpedimentPhotoPath}
                notify={setError}
                label="Adicionar foto do impedimento (opcional)"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void handleImpediment()}>
                  Confirmar impedimento
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowImpediment(false);
                    setImpedimentPhotoPath(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowImpediment(true)}>
              Registrar impedimento
            </Button>
          )}
        </section>
      )}

      {status === "com_inconsistencia" && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Warehouse className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            As quantidades não fecharam — aguardando decisão do gerente ou dono.
          </p>
        </div>
      )}

      {status === "concluida" && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Tarefa concluída.</p>
        </div>
      )}
    </div>
  );
}
