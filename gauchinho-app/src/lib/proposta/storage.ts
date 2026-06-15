import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PROPOSTAS_PDF_BUCKET = "propostas-pdf";

export function propostaPdfStoragePath(propostaId: string) {
  return `${propostaId}.pdf`;
}

export async function uploadPropostaPdf(propostaId: string, buffer: Buffer) {
  const admin = createAdminClient();
  const path = propostaPdfStoragePath(propostaId);
  const { error } = await admin.storage.from(PROPOSTAS_PDF_BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  return path;
}

export async function createPropostaPdfSignedUrl(storagePath: string, expiresIn = 3600) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PROPOSTAS_PDF_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "URL assinada falhou");
  return data.signedUrl;
}

/** Fallback local/dev quando bucket não existe — grava path lógico sem upload. */
export async function tryUploadPropostaPdf(propostaId: string, buffer: Buffer) {
  try {
    return await uploadPropostaPdf(propostaId, buffer);
  } catch (e) {
    console.error("[proposta-pdf] upload falhou, fallback path only:", e);
    return propostaPdfStoragePath(propostaId);
  }
}
