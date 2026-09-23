// Convites e equipe reais (B1.5): substitui a lista de demonstração
// (accessList) por leitura e gravação de verdade no Supabase — membros ativos
// (company_members) e convites pendentes/revogados/aceitos (invites), com os
// mercados vinculados de cada um.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type InviteStatus = Database["public"]["Enums"]["invite_status"];

export const roleLabel: Record<MemberRole, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  receiver: "Conferente",
  stocker: "Repositor",
};

// Papéis que podem de fato ser convidados (o dono nasce do cadastro, DEC-B1-07).
export const invitableRoles: Array<Exclude<MemberRole, "owner">> = [
  "manager",
  "receiver",
  "stocker",
];

export type TeamMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  status: Database["public"]["Enums"]["member_status"];
  marketNames: string[];
};

export type TeamInvite = {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  expiresAt: string;
  marketNames: string[];
};

/** Membros ativos/desativados da empresa (RF-ORG-05) com os mercados que cada um acessa. */
export async function listTeamMembers(companyId: string): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from("company_members")
    .select("id, user_id, role, status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error || !members) return [];

  const userIds = members.map((member) => member.user_id);
  const memberIds = members.map((member) => member.id);

  // O e-mail de cada pessoa vive em auth.users, que o cliente não lê direto;
  // por isso esta lista mostra nome, papel e mercados, mas não o e-mail (RF-ORG-05
  // pede quem acessa o quê, não uma cópia da tabela de autenticação).
  const [{ data: profiles }, { data: links }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    memberIds.length
      ? supabase
          .from("member_markets")
          .select("member_id, markets(name)")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [] as { member_id: string; markets: { name: string } | null }[] }),
  ]);

  const nameByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const marketsByMemberId = new Map<string, string[]>();
  for (const link of links ?? []) {
    const name = link.markets?.name;
    if (!name) continue;
    const current = marketsByMemberId.get(link.member_id) ?? [];
    current.push(name);
    marketsByMemberId.set(link.member_id, current);
  }

  return members.map((member) => ({
    memberId: member.id,
    userId: member.user_id,
    name: nameByUserId.get(member.user_id) ?? "Sem nome cadastrado",
    email: "",
    role: member.role,
    status: member.status,
    marketNames: marketsByMemberId.get(member.id) ?? [],
  }));
}

/** Convites da empresa (RF-ORG-05): a política de leitura já restringe o gerente aos que ele mesmo criou. */
export async function listTeamInvites(companyId: string): Promise<TeamInvite[]> {
  const { data: invites, error } = await supabase
    .from("invites")
    .select("id, email, role, status, expires_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error || !invites) return [];

  const inviteIds = invites.map((invite) => invite.id);
  const { data: links } = inviteIds.length
    ? await supabase
        .from("invite_markets")
        .select("invite_id, markets(name)")
        .in("invite_id", inviteIds)
    : { data: [] as { invite_id: string; markets: { name: string } | null }[] };

  const marketsByInviteId = new Map<string, string[]>();
  for (const link of links ?? []) {
    const name = link.markets?.name;
    if (!name) continue;
    const current = marketsByInviteId.get(link.invite_id) ?? [];
    current.push(name);
    marketsByInviteId.set(link.invite_id, current);
  }

  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expires_at,
    marketNames: marketsByInviteId.get(invite.id) ?? [],
  }));
}

function friendlyInviteError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("gerente só pode convidar"))
    return "Gerentes só podem convidar conferentes ou repositores.";
  if (lower.includes("informe ao menos um mercado"))
    return "Selecione ao menos um mercado para este convite.";
  if (lower.includes("você não tem acesso a um dos mercados"))
    return "Você não tem acesso a um dos mercados selecionados.";
  if (lower.includes("não é possível convidar alguém como dono"))
    return "Não é possível convidar alguém como proprietário.";
  if (lower.includes("sem acesso a esta empresa") || lower.includes("sem permissão"))
    return "Você não tem permissão para convidar para esta empresa.";
  if (lower.includes("informe o e-mail")) return "Informe o e-mail da pessoa convidada.";
  return "Não foi possível enviar o convite agora. Tente novamente.";
}

export async function createInvite(
  companyId: string,
  email: string,
  role: Exclude<MemberRole, "owner">,
  marketIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("create_invite", {
    p_company_id: companyId,
    p_email: email.trim(),
    p_role: role,
    p_market_ids: marketIds,
  });
  if (error) return { ok: false, message: friendlyInviteError(error.message) };
  return { ok: true };
}

export async function resendInvite(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("resend_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, message: "Não foi possível reenviar este convite agora." };
  return { ok: true };
}

export async function revokeInvite(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, message: "Não foi possível revogar este convite agora." };
  return { ok: true };
}

export type InvitePreview = {
  email: string;
  role: MemberRole;
  companyName: string;
  status: InviteStatus;
  expiresAt: string;
};

/** Tela de aceite (antes de logar): busca o convite pelo token do link. */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    email: row.email,
    role: row.role,
    companyName: row.company_name,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

function friendlyAcceptError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("já foi usado ou revogado")) return "Este convite já foi usado ou revogado.";
  if (lower.includes("expirou")) return "Este convite expirou. Peça para reenviarem.";
  if (lower.includes("enviado para outro e-mail"))
    return "Este convite foi enviado para outro e-mail. Entre com a conta correta.";
  if (lower.includes("convite não encontrado")) return "Convite não encontrado.";
  return "Não foi possível aceitar o convite agora. Tente novamente.";
}

export async function acceptInvite(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { ok: false, message: friendlyAcceptError(error.message) };
  return { ok: true };
}
