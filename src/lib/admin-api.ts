// Administrador da plataforma (B1.7, RF-ACC-06, G-08): a tabela platform_admins
// só é alterada direto no painel do Supabase (comentário da própria tabela,
// desde o B0.1) — não existe, de propósito, uma tela para "virar admin" pelo
// site, já que isso seria uma porta para escalar privilégio.
import { supabase } from "@/integrations/supabase/client";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && !!data;
}
