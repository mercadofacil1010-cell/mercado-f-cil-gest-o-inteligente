// Recepção de vendas do PDV (B7.1/B7.2/B7.3) — substitui o gráfico de
// demonstração da aba "Vendas" por uma fila real. Sem PDV conectado ainda
// (decisão em DECISOES.md, autorização direta do proprietário): dono/gerente
// simula o envio de um evento por aqui — o mesmo ponto de entrada
// (`receive_sale_event`) que um conector real (B7.4) vai chamar depois.
// Eventos com código de produto sem vínculo cadastrado ficam "Pendente de
// mapeamento" — o painel de vínculos abaixo cadastra o código do PDV →
// produto/embalagem, o que reprocessa sozinho os eventos pendentes
// (RF-PDV-07). Depois de mapeado, a baixa de estoque (B7.3) já acontece
// sozinha da posição de gôndola de maior saldo; produto mapeado mas sem
// nenhuma posição configurada fica "Pendente de posição" até alguém
// cadastrar uma (reprocessa sozinho de novo, mesma regra).
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertPill, ChartCard, type Tone } from "@/components/dashboard-ui";
import {
  createPdvProductMapping,
  listPdvProductMappings,
  listSaleEvents,
  receiveSaleEvent,
  reprocessSaleEvent,
  saleEventStatusLabel,
  saleEventTypeLabel,
  type PdvProductMapping,
  type SaleEvent,
  type SaleEventItemInput,
  type SaleEventType,
} from "@/lib/sale-events-api";
import { listPackagings, listProducts, type Packaging, type Product } from "@/lib/products-api";

const statusTone: Record<SaleEvent["status"], Tone> = {
  recebido: "neutral",
  pendente_mapeamento: "warning",
  pendente_posicao: "warning",
  processado: "positive",
  erro: "critical",
};

const pendingStatuses: SaleEvent["status"][] = ["pendente_mapeamento", "pendente_posicao"];

const emptyItem: SaleEventItemInput = { externalProductCode: "", quantity: 1 };

export function SalesModule({
  companyId,
  marketId,
  notify,
}: {
  companyId: string | null;
  marketId: string;
  notify: (message: string) => void;
}) {
  const [events, setEvents] = useState<SaleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<PdvProductMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packagingsByProduct, setPackagingsByProduct] = useState<Record<string, Packaging[]>>({});
  const [mappingCode, setMappingCode] = useState("");
  const [mappingProductId, setMappingProductId] = useState("");
  const [mappingPackagingId, setMappingPackagingId] = useState("");
  const [mappingError, setMappingError] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);
  const [reprocessingId, setReprocessingId] = useState("");
  const [registerCode, setRegisterCode] = useState("CAIXA-01");
  const [externalEventId, setExternalEventId] = useState("");
  const [eventType, setEventType] = useState<SaleEventType>("venda");
  const [referenceExternalEventId, setReferenceExternalEventId] = useState("");
  const [items, setItems] = useState<SaleEventItemInput[]>([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    const [saleEvents, productMappings] = await Promise.all([
      listSaleEvents(marketId),
      listPdvProductMappings(marketId),
    ]);
    setEvents(saleEvents);
    setMappings(productMappings);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    if (companyId) void listProducts(companyId).then(setProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado/empresa muda
  }, [marketId, companyId]);

  useEffect(() => {
    if (!mappingProductId) {
      setMappingPackagingId("");
      return;
    }
    if (packagingsByProduct[mappingProductId]) {
      setMappingPackagingId(packagingsByProduct[mappingProductId][0]?.id ?? "");
      return;
    }
    void listPackagings(mappingProductId).then((list) => {
      setPackagingsByProduct((current) => ({ ...current, [mappingProductId]: list }));
      setMappingPackagingId(list[0]?.id ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega embalagens só quando o produto selecionado muda
  }, [mappingProductId]);

  const handleCreateMapping = async () => {
    setMappingError("");
    if (!mappingCode.trim() || !mappingProductId || !mappingPackagingId) {
      setMappingError("Informe o código do PDV, o produto e a embalagem.");
      return;
    }
    setSavingMapping(true);
    const result = await createPdvProductMapping(
      marketId,
      mappingCode.trim(),
      mappingProductId,
      mappingPackagingId,
    );
    setSavingMapping(false);
    if (!result.ok) {
      setMappingError(result.message);
      return;
    }
    notify("Vínculo cadastrado — eventos pendentes com esse código foram reprocessados.");
    setMappingCode("");
    setMappingProductId("");
    setMappingPackagingId("");
    void reload();
  };

  const handleReprocess = async (id: string) => {
    setReprocessingId(id);
    const result = await reprocessSaleEvent(id);
    setReprocessingId("");
    if (!result.ok) {
      notify(`Erro ao reprocessar: ${result.message}`);
      return;
    }
    notify("Evento reprocessado.");
    void reload();
  };

  const updateItem = (index: number, patch: Partial<SaleEventItemInput>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = async () => {
    setError("");
    if (!externalEventId.trim()) {
      setError("Informe o identificador do evento.");
      return;
    }
    if (eventType !== "venda" && !referenceExternalEventId.trim()) {
      setError("Cancelamento e devolução precisam do identificador da venda original.");
      return;
    }
    const validItems = items.filter(
      (item) => item.externalProductCode.trim() && item.quantity !== 0,
    );
    if (validItems.length === 0) {
      setError("Informe pelo menos um item com código e quantidade.");
      return;
    }
    setSubmitting(true);
    const result = await receiveSaleEvent(
      marketId,
      registerCode,
      externalEventId.trim(),
      eventType,
      new Date().toISOString(),
      validItems,
      eventType !== "venda" ? referenceExternalEventId.trim() : undefined,
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    notify(
      result.duplicate
        ? "Este evento já tinha sido recebido antes — nada duplicado."
        : "Evento registrado.",
    );
    setExternalEventId("");
    setReferenceExternalEventId("");
    setItems([{ ...emptyItem }]);
    void reload();
  };

  return (
    <div className="space-y-5">
      <ChartCard
        title="Simular evento do PDV"
        subtitle="Sem PDV real conectado ainda — registre um evento manualmente pelo mesmo ponto de entrada que um conector real vai usar depois."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={registerCode}
            onChange={(event) => setRegisterCode(event.target.value)}
            placeholder="Código do caixa"
            className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={externalEventId}
            onChange={(event) => setExternalEventId(event.target.value)}
            placeholder="Identificador do evento (único)"
            className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Select value={eventType} onValueChange={(value) => setEventType(value as SaleEventType)}>
            <SelectTrigger className="h-10 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="cancelamento">Cancelamento</SelectItem>
              <SelectItem value="devolucao">Devolução</SelectItem>
            </SelectContent>
          </Select>
          {eventType !== "venda" && (
            <input
              value={referenceExternalEventId}
              onChange={(event) => setReferenceExternalEventId(event.target.value)}
              placeholder="Identificador da venda original"
              className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">Itens</p>
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={item.externalProductCode}
                onChange={(event) => updateItem(index, { externalProductCode: event.target.value })}
                placeholder="Código do produto no PDV"
                className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="number"
                step="0.001"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                placeholder="Quantidade"
                className="h-10 w-32 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover item"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => [...current, { ...emptyItem }])}
          >
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-4" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Registrar evento"}
        </Button>
      </ChartCard>

      <ChartCard
        title="Vínculos de produto do PDV"
        subtitle="Cadastre o código do produto usado no PDV e o produto/embalagem correspondente. Ao cadastrar, os eventos pendentes com esse código são reprocessados sozinhos."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={mappingCode}
            onChange={(event) => setMappingCode(event.target.value)}
            placeholder="Código do produto no PDV"
            className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Select value={mappingProductId} onValueChange={setMappingProductId}>
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
            value={mappingPackagingId}
            onValueChange={setMappingPackagingId}
            disabled={!mappingProductId}
          >
            <SelectTrigger className="h-10 bg-card">
              <SelectValue placeholder="Embalagem" />
            </SelectTrigger>
            <SelectContent>
              {(packagingsByProduct[mappingProductId] ?? []).map((packaging) => (
                <SelectItem key={packaging.id} value={packaging.id}>
                  {packaging.name} ({packaging.conversionFactor}×)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mappingError && <p className="mt-3 text-sm text-destructive">{mappingError}</p>}
        <Button
          className="mt-4"
          disabled={savingMapping}
          onClick={() => void handleCreateMapping()}
        >
          {savingMapping ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Cadastrar vínculo"}
        </Button>

        {mappings.length > 0 && (
          <ul className="mt-5 space-y-2">
            {mappings.map((mapping) => (
              <li
                key={mapping.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {mapping.externalProductCode}
                </span>
                <span>
                  {mapping.productName} · {mapping.packagingName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <ChartCard
        title="Eventos recebidos"
        subtitle="Fila de eventos do PDV — eventos pendentes de mapeamento são reprocessados sozinhos ao cadastrar o vínculo do código faltante."
        action={
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
          </Button>
        }
      >
        {loading ? (
          <div className="grid place-items-center p-10">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <strong>{saleEventTypeLabel[event.eventType]}</strong>
                  <span className="ml-2 text-muted-foreground">
                    {event.registerCode} · {event.externalEventId} · {event.itemCount} item(ns)
                  </span>
                  {event.referenceExternalEventId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (ref. {event.referenceExternalEventId})
                    </span>
                  )}
                  {event.unmappedCodes.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sem vínculo: {event.unmappedCodes.join(", ")}
                    </div>
                  )}
                  {event.unpositionedCodes.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sem posição de gôndola: {event.unpositionedCodes.join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <AlertPill
                    label={saleEventStatusLabel[event.status]}
                    tone={statusTone[event.status]}
                  />
                  {pendingStatuses.includes(event.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reprocessingId === event.id}
                      onClick={() => void handleReprocess(event.id)}
                    >
                      {reprocessingId === event.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Tentar de novo"
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
