// Recepção de vendas do PDV (B7.1) — substitui o gráfico de demonstração
// da aba "Vendas" por uma fila real. Sem PDV conectado ainda (decisão em
// DECISOES.md, autorização direta do proprietário): dono/gerente simula o
// envio de um evento por aqui — o mesmo ponto de entrada (`receive_sale_event`)
// que um conector real (B7.4) vai chamar depois. Mapeamento de produto
// (B7.2) e baixa de estoque (B7.3) ainda não existem, por isso todo evento
// fica "Recebido" — nada acontece no estoque por enquanto.
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
  listSaleEvents,
  receiveSaleEvent,
  saleEventStatusLabel,
  saleEventTypeLabel,
  type SaleEvent,
  type SaleEventItemInput,
  type SaleEventType,
} from "@/lib/sale-events-api";

const statusTone: Record<SaleEvent["status"], Tone> = {
  recebido: "neutral",
  pendente_mapeamento: "warning",
  processado: "positive",
  erro: "critical",
};

const emptyItem: SaleEventItemInput = { externalProductCode: "", quantity: 1 };

export function SalesModule({
  marketId,
  notify,
}: {
  marketId: string;
  notify: (message: string) => void;
}) {
  const [events, setEvents] = useState<SaleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerCode, setRegisterCode] = useState("CAIXA-01");
  const [externalEventId, setExternalEventId] = useState("");
  const [eventType, setEventType] = useState<SaleEventType>("venda");
  const [referenceExternalEventId, setReferenceExternalEventId] = useState("");
  const [items, setItems] = useState<SaleEventItemInput[]>([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setEvents(await listSaleEvents(marketId));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o mercado muda
  }, [marketId]);

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
        title="Eventos recebidos"
        subtitle="Fila de eventos do PDV — mapeamento de produto e baixa de estoque chegam nas próximas etapas."
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
                </div>
                <AlertPill
                  label={saleEventStatusLabel[event.status]}
                  tone={statusTone[event.status]}
                />
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
