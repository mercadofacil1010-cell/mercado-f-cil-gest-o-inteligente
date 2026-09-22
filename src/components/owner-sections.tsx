import { useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, CircleDollarSign, Download, FileChartColumn, LifeBuoy, Mail, MessageCircle, Plus, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPill, Metric, type Tone } from "@/components/dashboard-ui";
import { inconsistencies } from "@/data/market-operations";
import { money, type Market } from "@/data/markets";
import { accessList, helpTopics, purchaseOrders, reports, supplierList } from "@/data/owner";
import { cn } from "@/lib/utils";

/** Seções gerais do menu do dono que não pertencem a um módulo específico. */
export function OwnerSection({ section, markets, notify }: { section: string; markets: Market[]; notify: (message: string) => void }) {
  if (section === "Compras") return <Purchases notify={notify} />;
  if (section === "Fornecedores") return <Suppliers notify={notify} />;
  if (section === "Inconsistências") return <Inconsistencies notify={notify} />;
  if (section === "Relatórios") return <Reports notify={notify} />;
  if (section === "Equipe e acessos") return <Team notify={notify} />;
  if (section === "Assinatura") return <Subscription markets={markets} notify={notify} />;
  if (section === "Configurações") return <Settings notify={notify} />;
  return <Help notify={notify} />;
}

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1><p className="mt-1 text-muted-foreground">{subtitle}</p></div>{action}</div>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">{headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/60">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const orderTone: Record<string, Tone> = { Enviado: "warning", Confirmado: "neutral", Recebido: "positive", Rascunho: "neutral" };

function Purchases({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Compras" subtitle="Pedidos de compra de toda a rede" action={<Button onClick={() => notify("Novo pedido de compra iniciado (simulação).")}><Plus className="h-4 w-4" /> Novo pedido</Button>}>
      <Table headers={["Pedido", "Fornecedor", "Mercado", "Itens", "Valor", "Previsão", "Situação"]} rows={purchaseOrders.map((order) => [<strong key="i">{order.id}</strong>, order.supplier, order.market, order.items, money(order.value), order.expected, <AlertPill key="s" label={order.status} tone={orderTone[order.status] ?? "neutral"} />])} />
    </Page>
  );
}

function Suppliers({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Fornecedores" subtitle="Parceiros que abastecem seus mercados" action={<Button onClick={() => notify("Cadastro de fornecedor iniciado (simulação).")}><Plus className="h-4 w-4" /> Novo fornecedor</Button>}>
      <Table headers={["Fornecedor", "CNPJ", "Contato", "Prazo de entrega", "Avaliação", "Entregas"]} rows={supplierList.map((supplier) => [<strong key="n">{supplier.name}</strong>, supplier.cnpj, supplier.contact, supplier.leadTime, <span key="r" className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-warning text-warning" />{supplier.rating.toLocaleString("pt-BR")}</span>, supplier.deliveries])} />
    </Page>
  );
}

function Inconsistencies({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Inconsistências" subtitle="Divergências de contagem, recebimento e transferência em toda a rede">
      <Table headers={["Código", "Produto", "Origem", "Diferença", "Situação", "Horário", ""]} rows={inconsistencies.map((item) => [<strong key="c">{item.id}</strong>, item.product, item.type, item.difference, <AlertPill key="s" label={item.status} tone={item.status === "Resolvida" ? "positive" : item.status === "Em análise" ? "warning" : "critical"} />, item.time, <Button key="a" variant="outline" size="sm" onClick={() => notify(`${item.id} aberta para análise.`)}>Analisar</Button>])} />
    </Page>
  );
}

function Reports({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Relatórios" subtitle="Análises prontas com dados fictícios">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <article key={report.title} className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary"><FileChartColumn className="h-5 w-5" /></span>
            <h2 className="mt-3 font-extrabold">{report.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{report.description}</p>
            <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => notify(`Relatório "${report.title}" gerado (simulação).`)}>Visualizar</Button><Button variant="ghost" size="sm" onClick={() => notify(`Exportação de "${report.title}" preparada (simulação).`)}><Download className="h-4 w-4" /> Exportar</Button></div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function Team({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Equipe e acessos" subtitle="Quem pode acessar cada mercado e com qual perfil" action={<Button onClick={() => notify("Convite enviado (simulação).")}><UserPlus className="h-4 w-4" /> Convidar pessoa</Button>}>
      <Table headers={["Nome", "E-mail", "Perfil", "Mercados", "Situação"]} rows={accessList.map((person) => [<strong key="n">{person.name}</strong>, person.email, person.role, person.markets, <AlertPill key="s" label={person.status} tone={person.status === "Ativo" ? "positive" : "warning"} />])} />
    </Page>
  );
}

function Subscription({ markets, notify }: { markets: Market[]; notify: (message: string) => void }) {
  const perMarket = 249;
  return (
    <Page title="Assinatura" subtitle="Plano atual e cobrança por mercado (valores de demonstração)">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Plano atual" value="Profissional" note="Cobrança mensal" icon={Star} tone="positive" />
        <Metric title="Mercados contratados" value={String(markets.length)} note={`${money(perMarket)} por mercado`} icon={CheckCircle2} />
        <Metric title="Mensalidade estimada" value={money(markets.length * perMarket)} note="Próxima cobrança em 10/10/2026" icon={CircleDollarSign} />
        <Metric title="Forma de pagamento" value="A definir" note="Pagamento ainda não integrado" icon={CircleDollarSign} tone="warning" />
      </div>
      <Table headers={["Mercado", "Situação", "Valor mensal"]} rows={markets.map((market) => [<strong key="m">{market.name}</strong>, <AlertPill key="s" label={market.status === "Aberto" ? "Ativo" : "Ativo · fechado agora"} tone="positive" />, money(perMarket)])} />
      <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => notify("Troca de plano disponível na próxima fase.")}>Alterar plano</Button><Button variant="ghost" onClick={() => notify("Cancelamento simulado: nenhuma alteração foi feita.")}>Cancelar assinatura</Button></div>
    </Page>
  );
}

function Settings({ notify }: { notify: (message: string) => void }) {
  const [options, setOptions] = useState({ dailySummary: true, criticalAlerts: true, expiryDays: "30", timezone: "America/Sao_Paulo" });
  return (
    <Page title="Configurações" subtitle="Preferências gerais da empresa">
      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4 text-sm"><span><strong className="block">Resumo diário por e-mail</strong><span className="text-muted-foreground">Indicadores da rede todos os dias às 7h.</span></span><input type="checkbox" checked={options.dailySummary} onChange={(event) => setOptions((current) => ({ ...current, dailySummary: event.target.checked }))} className="mt-1 h-5 w-5 accent-primary" /></label>
        <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4 text-sm"><span><strong className="block">Alertas críticos</strong><span className="text-muted-foreground">Ruptura, divergências e vencidos.</span></span><input type="checkbox" checked={options.criticalAlerts} onChange={(event) => setOptions((current) => ({ ...current, criticalAlerts: event.target.checked }))} className="mt-1 h-5 w-5 accent-primary" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-semibold">Aviso de validade com antecedência de</span><select value={options.expiryDays} onChange={(event) => setOptions((current) => ({ ...current, expiryDays: event.target.value }))} className="h-11 w-full appearance-none rounded-md border border-input bg-card px-3.5 text-base"><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select></label>
        <label className="block text-sm"><span className="mb-1.5 block font-semibold">Fuso horário</span><select value={options.timezone} onChange={(event) => setOptions((current) => ({ ...current, timezone: event.target.value }))} className="h-11 w-full appearance-none rounded-md border border-input bg-card px-3.5 text-base"><option value="America/Sao_Paulo">Brasília (GMT-3)</option><option value="America/Manaus">Manaus (GMT-4)</option><option value="America/Rio_Branco">Rio Branco (GMT-5)</option></select></label>
        <div className="sm:col-span-2"><Button onClick={() => notify("Configurações salvas (simulação).")}><CheckCircle2 className="h-4 w-4" /> Salvar configurações</Button></div>
      </div>
    </Page>
  );
}

function Help({ notify }: { notify: (message: string) => void }) {
  const [open, setOpen] = useState<string | null>(helpTopics[0]?.question ?? null);
  return (
    <Page title="Ajuda e suporte" subtitle="Tire dúvidas ou fale com a equipe Mercado Fácil">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-2">
          {helpTopics.map((topic) => (
            <div key={topic.question} className="rounded-lg border border-border bg-card shadow-card">
              <button type="button" onClick={() => setOpen(open === topic.question ? null : topic.question)} aria-expanded={open === topic.question} className="flex w-full items-center justify-between gap-3 p-4 text-left font-bold">{topic.question}<ChevronDown className={cn("h-5 w-5 shrink-0 transition", open === topic.question && "rotate-180")} /></button>
              {open === topic.question && <p className="px-4 pb-4 text-sm text-muted-foreground">{topic.answer}</p>}
            </div>
          ))}
        </div>
        <aside className="space-y-3 rounded-lg bg-brand-panel p-5 text-sidebar-foreground">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-sidebar-accent text-brand-soft"><LifeBuoy className="h-5 w-5" /></span>
          <h2 className="text-lg font-extrabold">Precisa de ajuda?</h2>
          <p className="text-sm text-sidebar-muted">Atendimento de segunda a sábado, das 8h às 20h.</p>
          <Button className="w-full" onClick={() => notify("Chamado aberto (simulação).")}><MessageCircle className="h-4 w-4" /> Abrir chamado</Button>
          <Button variant="nav" className="w-full" onClick={() => notify("E-mail de suporte: suporte@mercadofacil.com.br")}><Mail className="h-4 w-4" /> Enviar e-mail</Button>
        </aside>
      </div>
    </Page>
  );
}
