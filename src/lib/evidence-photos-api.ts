// Upload de foto de evidência (B5.4, DEC-B5-09/11): mesma infraestrutura
// (bucket privado "evidence-photos" no Supabase Storage) reaproveitada em
// perdas/ajustes (B3.4), contagem de recebimento (B4.2), recusa (B4.4) e
// impedimento de reposição (B5.2). Caminho do objeto: {company_id}/
// {market_id}/{uploaded_by}/{arquivo} — a política de leitura (ver
// migração do B5.4) reconhece dono, gerente com acesso ao mercado, ou o
// próprio uploader (DEC-B5-11). Nunca guardamos URL pública: o bucket é
// privado, então toda leitura passa por uma signed URL de curta duração.
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "evidence-photos";

/** Envia a foto capturada e devolve o caminho do objeto (para gravar no banco). */
export async function uploadEvidencePhoto(
  companyId: string,
  marketId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "É preciso estar autenticado para enviar a foto." };

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${companyId}/${marketId}/${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, path };
}

/** Gera uma URL temporária para exibir uma foto já enviada (bucket privado). */
export async function getEvidencePhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
