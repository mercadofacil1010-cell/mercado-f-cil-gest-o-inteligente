// Conector de PDV real (B7.4) — token de integração por mercado. O valor em
// texto puro só existe no retorno de createPdvToken; depois disso, só o
// hash fica guardado e não há como recuperá-lo de novo.
import { supabase } from "@/integrations/supabase/client";

export type PdvToken = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type CreatedTokenRow = { id: string; label: string; token: string; createdAt: string };

export async function listPdvTokens(marketId: string): Promise<PdvToken[]> {
  const { data, error } = await supabase.rpc("list_pdv_tokens", { p_market_id: marketId });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
}

/** O campo `token` só vem preenchido nesta chamada — guarde-o agora, ele nunca mais é recuperável. */
export async function createPdvToken(
  marketId: string,
  label: string,
): Promise<{ ok: true; token: PdvToken & { token: string } } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("create_pdv_token", {
    p_market_id: marketId,
    p_label: label.trim(),
  });
  if (error || !data)
    return { ok: false, message: error?.message ?? "Não foi possível criar o token." };
  const row = data as unknown as CreatedTokenRow;
  return {
    ok: true,
    token: {
      id: row.id,
      label: row.label,
      createdAt: row.createdAt,
      lastUsedAt: null,
      revokedAt: null,
      token: row.token,
    },
  };
}

export async function revokePdvToken(
  tokenId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("revoke_pdv_token", { p_token_id: tokenId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
