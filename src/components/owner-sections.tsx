import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileChartColumn,
  LifeBuoy,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Star,
  UserPlus,
  X,
} from "lucide-react";
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
import { AlertPill, Metric, type Tone } from "@/components/dashboard-ui";
import { inconsistencies } from "@/data/market-operations";
import { money, type Market } from "@/data/markets";
import { helpTopics, purchaseOrders, reports } from "@/data/owner";
import { cn } from "@/lib/utils";
import {
  createInvite,
  invitableRoles,
  listTeamInvites,
  listTeamMembers,
  resendInvite,
  revokeInvite,
  roleLabel,
  type MemberRole,
  type TeamInvite,
  type TeamMember,
} from "@/lib/invites-api";
import {
  createSupplier,
  inactivateSupplier,
  listSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierFormData,
} from "@/lib/catalog-support-api";

/** Seções gerais do menu do dono que não pertencem a um módulo específico. */
export function OwnerSection({
  section,
  markets,
  companyId,
  callerRole,
  notify,
}: {
  section: string;
  markets: Market[];
  companyId: string | null;
  callerRole: MemberRole | null;
  notify: (message: string) => void;
}) {
  if (section === "Compras") return <Purchases notify={notify} />;
  if (section === "Fornecedores") return <Suppliers companyId={companyId} notify={notify} />;
  if (section === "Inconsistências") return <Inconsistencies notify={notify} />;
  if (section === "Relatórios") return <Reports notify={notify} />;
  if (section === "Equipe e acessos")
    return <Team companyId={companyId} callerRole={callerRole} markets={markets} notify={notify} />;
  if (section === "Assinatura") return <Subscription markets={markets} notify={notify} />;
  if (section === "Configurações") return <Settings notify={notify} />;
  return <Help notify={notify} />;
}

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

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/60">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const orderTone: Record<string, Tone> = {
  Enviado: "warning",
  Confirmado: "neutral",
  Recebido: "positive",
  Rascunho: "neutral",
};

function Purchases({ notify }: { notify: (message: string) => void }) {
  return (
    <Page
      title="Compras"
      subtitle="Pedidos de compra de toda a rede"
      action={
        <Button onClick={() => notify("Novo pedido de compra iniciado (simulação).")}>
          <Plus className="h-4 w-4" /> Novo pedido
        </Button>
      }
    >
      <Table
        headers={["Pedido", "Fornecedor", "Mercado", "Itens", "Valor", "Previsão", "Situação"]}
        rows={purchaseOrders.map((order) => [
          <strong key="i">{order.id}</strong>,
          order.supplier,
          order.market,
          order.items,
          money(order.value),
          order.expected,
          <AlertPill key="s" label={order.status} tone={orderTone[order.status] ?? "neutral"} />,
        ])}
      />
    </Page>
  );
}

function formatCnpjDisplay(digits: string) {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhoneDisplay(digits: string) {
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

const emptySupplierForm: SupplierFormData = {
  name: "",
  cnpj: "",
  contactName: "",
  phone: "",
  email: "",
  leadTimeDays: "",
};

function Suppliers({
  companyId,
  notify,
}: {
  companyId: string | null;
  notify: (message: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const reload = async () => {
    if (!companyId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSuppliers(await listSuppliers(companyId));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando a empresa muda
  }, [companyId]);

  const requestInactivate = async (supplier: Supplier) => {
    if (!window.confirm(`Inativar "${supplier.name}"? Essa ação não pode ser desfeita por aqui.`))
      return;
    const result = await inactivateSupplier(supplier.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    notify(`${supplier.name} foi inativado.`);
    void reload();
  };

  return (
    <Page
      title="Fornecedores"
      subtitle="Parceiros que abastecem seus mercados"
      action={
        companyId ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Novo fornecedor
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid place-items-center rounded-lg border border-border bg-card p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <h3 className="font-bold">Nenhum fornecedor cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em "Novo fornecedor" para começar.
          </p>
        </div>
      ) : (
        <Table
          headers={["Fornecedor", "CNPJ", "Contato", "Prazo de entrega", ""]}
          rows={suppliers.map((supplier) => [
            <strong key="n">{supplier.name}</strong>,
            supplier.cnpj ? formatCnpjDisplay(supplier.cnpj) : "—",
            [supplier.contactName, supplier.phone ? formatPhoneDisplay(supplier.phone) : ""]
              .filter(Boolean)
              .join(" · ") || "—",
            supplier.leadTimeDays != null
              ? `${supplier.leadTimeDays} ${supplier.leadTimeDays === 1 ? "dia" : "dias"}`
              : "—",
            <div key="a" className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(supplier)}>
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void requestInactivate(supplier)}>
                Inativar
              </Button>
            </div>,
          ])}
        />
      )}
      {(formOpen || editing) && companyId && (
        <SupplierDialog
          companyId={companyId}
          supplier={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={(verb) => {
            setFormOpen(false);
            setEditing(null);
            notify(`Fornecedor ${verb} com sucesso.`);
            void reload();
          }}
        />
      )}
    </Page>
  );
}

function SupplierDialog({
  companyId,
  supplier,
  onClose,
  onSaved,
}: {
  companyId: string;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: (verb: "adicionado" | "atualizado") => void;
}) {
  const [form, setForm] = useState<SupplierFormData>(
    supplier
      ? {
          name: supplier.name,
          cnpj: supplier.cnpj,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          leadTimeDays: supplier.leadTimeDays != null ? String(supplier.leadTimeDays) : "",
        }
      : emptySupplierForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<SupplierFormData>) =>
    setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Informe o nome do fornecedor.");
      return;
    }
    setSubmitting(true);
    const result = supplier
      ? await updateSupplier(supplier.id, form)
      : await createSupplier(companyId, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(supplier ? "atualizado" : "adicionado");
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
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>
            Só nome é obrigatório — o resto ajuda no recebimento e nos pedidos.
          </DialogDescription>
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
            <span className="mb-1.5 block font-semibold">CNPJ (opcional)</span>
            <input
              value={form.cnpj}
              onChange={(event) => update({ cnpj: event.target.value })}
              placeholder="00.000.000/0000-00"
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Contato (opcional)</span>
            <input
              value={form.contactName}
              onChange={(event) => update({ contactName: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Telefone (opcional)</span>
              <input
                value={form.phone}
                onChange={(event) => update({ phone: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">
                Prazo de entrega, em dias (opcional)
              </span>
              <input
                type="number"
                min="0"
                value={form.leadTimeDays}
                onChange={(event) => update({ leadTimeDays: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">E-mail (opcional)</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => update({ email: event.target.value })}
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
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar fornecedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Inconsistencies({ notify }: { notify: (message: string) => void }) {
  return (
    <Page
      title="Inconsistências"
      subtitle="Divergências de contagem, recebimento e transferência em toda a rede"
    >
      <Table
        headers={["Código", "Produto", "Origem", "Diferença", "Situação", "Horário", ""]}
        rows={inconsistencies.map((item) => [
          <strong key="c">{item.id}</strong>,
          item.product,
          item.type,
          item.difference,
          <AlertPill
            key="s"
            label={item.status}
            tone={
              item.status === "Resolvida"
                ? "positive"
                : item.status === "Em análise"
                  ? "warning"
                  : "critical"
            }
          />,
          item.time,
          <Button
            key="a"
            variant="outline"
            size="sm"
            onClick={() => notify(`${item.id} aberta para análise.`)}
          >
            Analisar
          </Button>,
        ])}
      />
    </Page>
  );
}

function Reports({ notify }: { notify: (message: string) => void }) {
  return (
    <Page title="Relatórios" subtitle="Análises prontas com dados fictícios">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <article
            key={report.title}
            className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-card"
          >
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary">
              <FileChartColumn className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-extrabold">{report.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{report.description}</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => notify(`Relatório "${report.title}" gerado (simulação).`)}
              >
                Visualizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => notify(`Exportação de "${report.title}" preparada (simulação).`)}
              >
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

const inviteStatusLabel: Record<TeamInvite["status"], string> = {
  pending: "Convite pendente",
  accepted: "Aceito",
  revoked: "Revogado",
};
const memberStatusLabel: Record<TeamMember["status"], string> = {
  active: "Ativo",
  invited: "Convite pendente",
  disabled: "Desativado",
};

function Team({
  companyId,
  callerRole,
  markets,
  notify,
}: {
  companyId: string | null;
  callerRole: MemberRole | null;
  markets: Market[];
  notify: (message: string) => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const reload = async () => {
    if (!companyId) {
      setMembers([]);
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [memberList, inviteList] = await Promise.all([
      listTeamMembers(companyId),
      listTeamInvites(companyId),
    ]);
    setMembers(memberList);
    setInvites(inviteList);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando a empresa muda
  }, [companyId]);

  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  // Só dono e gerente convidam (RN-ORG-04); o próprio banco também garante isso.
  const canInvite = callerRole === "owner" || callerRole === "manager";

  return (
    <Page
      title="Equipe e acessos"
      subtitle="Quem pode acessar cada mercado e com qual perfil"
      action={
        canInvite && companyId ? (
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4" /> Convidar pessoa
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid place-items-center rounded-lg border border-border bg-card p-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Table
            headers={["Nome", "Perfil", "Mercados", "Situação"]}
            rows={members.map((member) => [
              <strong key="n">{member.name}</strong>,
              roleLabel[member.role],
              member.marketNames.length ? member.marketNames.join(", ") : "Toda a rede",
              <AlertPill
                key="s"
                label={memberStatusLabel[member.status]}
                tone={member.status === "active" ? "positive" : "warning"}
              />,
            ])}
          />
          {pendingInvites.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold">Convites pendentes</h2>
              <Table
                headers={["E-mail", "Perfil", "Mercados", "Expira em", ""]}
                rows={pendingInvites.map((invite) => [
                  <strong key="e">{invite.email}</strong>,
                  roleLabel[invite.role],
                  invite.marketNames.length ? invite.marketNames.join(", ") : "A definir",
                  new Date(invite.expiresAt).toLocaleDateString("pt-BR"),
                  <InviteActions key="a" invite={invite} onChanged={reload} notify={notify} />,
                ])}
              />
            </div>
          )}
        </>
      )}
      {inviting && companyId && (
        <InviteDialog
          companyId={companyId}
          callerRole={callerRole}
          markets={markets}
          onClose={() => setInviting(false)}
          onSent={() => {
            setInviting(false);
            notify("Convite enviado com sucesso.");
            void reload();
          }}
        />
      )}
    </Page>
  );
}

function InviteActions({
  invite,
  onChanged,
  notify,
}: {
  invite: TeamInvite;
  onChanged: () => void;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleResend = async () => {
    setBusy(true);
    const result = await resendInvite(invite.id);
    setBusy(false);
    notify(result.ok ? "Convite reenviado: o prazo foi renovado por mais 7 dias." : result.message);
    if (result.ok) onChanged();
  };

  const handleRevoke = async () => {
    if (!window.confirm(`Revogar o convite enviado para ${invite.email}?`)) return;
    setBusy(true);
    const result = await revokeInvite(invite.id);
    setBusy(false);
    notify(result.ok ? "Convite revogado." : result.message);
    if (result.ok) onChanged();
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleResend()}>
        Reenviar
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleRevoke()}>
        Revogar
      </Button>
    </div>
  );
}

function InviteDialog({
  companyId,
  callerRole,
  markets,
  onClose,
  onSent,
}: {
  companyId: string;
  callerRole: MemberRole | null;
  markets: Market[];
  onClose: () => void;
  onSent: () => void;
}) {
  // G-06: gerente só convida conferente/repositor e precisa escolher mercado.
  const allowedRoles =
    callerRole === "manager" ? invitableRoles.filter((role) => role !== "manager") : invitableRoles;
  const marketsRequired = callerRole === "manager";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>(allowedRoles[0] ?? "stocker");
  const [marketIds, setMarketIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleMarket = (marketId: string) => {
    setMarketIds((current) =>
      current.includes(marketId) ? current.filter((id) => id !== marketId) : [...current, marketId],
    );
  };

  const handleSubmit = async () => {
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (marketsRequired && marketIds.length === 0) {
      setError("Selecione ao menos um mercado para este convite.");
      return;
    }
    setSubmitting(true);
    const result = await createInvite(companyId, trimmedEmail, role, marketIds);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent();
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
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Enviamos um link de convite válido por 7 dias.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com"
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Perfil</span>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Exclude<MemberRole, "owner">)}
            >
              <SelectTrigger className="h-11 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((allowedRole) => (
                  <SelectItem key={allowedRole} value={allowedRole}>
                    {roleLabel[allowedRole]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="text-sm">
            <span className="mb-1.5 block font-semibold">
              Mercados {marketsRequired ? "" : "(opcional)"}
            </span>
            <div className="max-h-[180px] space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {markets.map((market) => (
                <label key={market.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={marketIds.includes(market.id)}
                    onCheckedChange={() => toggleMarket(market.id)}
                  />
                  <span>{market.name}</span>
                </label>
              ))}
              {markets.length === 0 && (
                <p className="text-muted-foreground">Nenhum mercado cadastrado ainda.</p>
              )}
            </div>
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
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Subscription({
  markets,
  notify,
}: {
  markets: Market[];
  notify: (message: string) => void;
}) {
  const perMarket = 249;
  return (
    <Page
      title="Assinatura"
      subtitle="Plano atual e cobrança por mercado (valores de demonstração)"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Plano atual"
          value="Profissional"
          note="Cobrança mensal"
          icon={Star}
          tone="positive"
        />
        <Metric
          title="Mercados contratados"
          value={String(markets.length)}
          note={`${money(perMarket)} por mercado`}
          icon={CheckCircle2}
        />
        <Metric
          title="Mensalidade estimada"
          value={money(markets.length * perMarket)}
          note="Próxima cobrança em 10/10/2026"
          icon={CircleDollarSign}
        />
        <Metric
          title="Forma de pagamento"
          value="A definir"
          note="Pagamento ainda não integrado"
          icon={CircleDollarSign}
          tone="warning"
        />
      </div>
      <Table
        headers={["Mercado", "Situação", "Valor mensal"]}
        rows={markets.map((market) => [
          <strong key="m">{market.name}</strong>,
          <AlertPill
            key="s"
            label={market.status === "Aberto" ? "Ativo" : "Ativo · fechado agora"}
            tone="positive"
          />,
          money(perMarket),
        ])}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => notify("Troca de plano disponível na próxima fase.")}
        >
          Alterar plano
        </Button>
        <Button
          variant="ghost"
          onClick={() => notify("Cancelamento simulado: nenhuma alteração foi feita.")}
        >
          Cancelar assinatura
        </Button>
      </div>
    </Page>
  );
}

function Settings({ notify }: { notify: (message: string) => void }) {
  const [options, setOptions] = useState({
    dailySummary: true,
    criticalAlerts: true,
    expiryDays: "30",
    timezone: "America/Sao_Paulo",
  });
  return (
    <Page title="Configurações" subtitle="Preferências gerais da empresa">
      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4 text-sm">
          <span>
            <strong className="block">Resumo diário por e-mail</strong>
            <span className="text-muted-foreground">Indicadores da rede todos os dias às 7h.</span>
          </span>
          <input
            type="checkbox"
            checked={options.dailySummary}
            onChange={(event) =>
              setOptions((current) => ({ ...current, dailySummary: event.target.checked }))
            }
            className="mt-1 h-5 w-5 accent-primary"
          />
        </label>
        <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4 text-sm">
          <span>
            <strong className="block">Alertas críticos</strong>
            <span className="text-muted-foreground">Ruptura, divergências e vencidos.</span>
          </span>
          <input
            type="checkbox"
            checked={options.criticalAlerts}
            onChange={(event) =>
              setOptions((current) => ({ ...current, criticalAlerts: event.target.checked }))
            }
            className="mt-1 h-5 w-5 accent-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Aviso de validade com antecedência de</span>
          <select
            value={options.expiryDays}
            onChange={(event) =>
              setOptions((current) => ({ ...current, expiryDays: event.target.value }))
            }
            className="h-11 w-full appearance-none rounded-md border border-input bg-card px-3.5 text-base"
          >
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Fuso horário</span>
          <select
            value={options.timezone}
            onChange={(event) =>
              setOptions((current) => ({ ...current, timezone: event.target.value }))
            }
            className="h-11 w-full appearance-none rounded-md border border-input bg-card px-3.5 text-base"
          >
            <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Button onClick={() => notify("Configurações salvas (simulação).")}>
            <CheckCircle2 className="h-4 w-4" /> Salvar configurações
          </Button>
        </div>
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
            <div
              key={topic.question}
              className="rounded-lg border border-border bg-card shadow-card"
            >
              <button
                type="button"
                onClick={() => setOpen(open === topic.question ? null : topic.question)}
                aria-expanded={open === topic.question}
                className="flex w-full items-center justify-between gap-3 p-4 text-left font-bold"
              >
                {topic.question}
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 transition",
                    open === topic.question && "rotate-180",
                  )}
                />
              </button>
              {open === topic.question && (
                <p className="px-4 pb-4 text-sm text-muted-foreground">{topic.answer}</p>
              )}
            </div>
          ))}
        </div>
        <aside className="space-y-3 rounded-lg bg-brand-panel p-5 text-sidebar-foreground">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-sidebar-accent text-brand-soft">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-extrabold">Precisa de ajuda?</h2>
          <p className="text-sm text-sidebar-muted">
            Atendimento de segunda a sábado, das 8h às 20h.
          </p>
          <Button className="w-full" onClick={() => notify("Chamado aberto (simulação).")}>
            <MessageCircle className="h-4 w-4" /> Abrir chamado
          </Button>
          <Button
            variant="nav"
            className="w-full"
            onClick={() => notify("E-mail de suporte: suporte@mercadofacil.com.br")}
          >
            <Mail className="h-4 w-4" /> Enviar e-mail
          </Button>
        </aside>
      </div>
    </Page>
  );
}
