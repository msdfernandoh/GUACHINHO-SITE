import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsuarioNegocio } from "@/lib/auth/permissions";
import {
  canAccessContratacaoDocumentos,
  MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
} from "@/lib/auth/permissions";
import type { ContratacaoDocumentoRow } from "./types";

export const SIGNED_URL_TTL_SEGUNDOS = 3600;

export function assertAcessoDocumentosContratacao(usuario: UsuarioNegocio | null): void {
  if (!usuario || !canAccessContratacaoDocumentos(usuario.perfil)) {
    throw new Error(MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO);
  }
}

export async function listarDocumentosContratacaoStaff(
  supabase: SupabaseClient,
  contratacaoId: string,
): Promise<ContratacaoDocumentoRow[]> {
  const { data: contratacao, error: ctrErr } = await supabase
    .from("contratacoes_online")
    .select("id")
    .eq("id", contratacaoId)
    .maybeSingle();
  if (ctrErr) throw new Error(ctrErr.message);
  if (!contratacao) throw new Error(MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO);

  const { data, error } = await supabase
    .from("contratacoes_documentos")
    .select("*")
    .eq("contratacao_id", contratacaoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratacaoDocumentoRow[];
}

export async function obterSignedUrlDocumentoContratacao(
  supabase: SupabaseClient,
  params: {
    contratacaoId: string;
    documentoId: string;
    download: boolean;
  },
): Promise<string> {
  const { data: doc, error: docErr } = await supabase
    .from("contratacoes_documentos")
    .select("id, contratacao_id, arquivo_url, arquivo_nome")
    .eq("id", params.documentoId)
    .eq("contratacao_id", params.contratacaoId)
    .maybeSingle();
  if (docErr) throw new Error(docErr.message);
  if (!doc?.arquivo_url) {
    throw new Error(MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO);
  }

  const downloadOpt = params.download
    ? doc.arquivo_nome?.trim() || true
    : false;

  const { data: signed, error: signErr } = await supabase.storage
    .from("contratacoes-documentos")
    .createSignedUrl(doc.arquivo_url, SIGNED_URL_TTL_SEGUNDOS, {
      download: downloadOpt,
    });

  if (!signErr && signed?.signedUrl) {
    return signed.signedUrl;
  }

  const admin = createAdminClient();
  const { data: signedAdmin, error: adminErr } = await admin.storage
    .from("contratacoes-documentos")
    .createSignedUrl(doc.arquivo_url, SIGNED_URL_TTL_SEGUNDOS, {
      download: downloadOpt,
    });
  if (adminErr || !signedAdmin?.signedUrl) {
    throw new Error(adminErr?.message ?? signErr?.message ?? "Não foi possível gerar link temporário");
  }
  return signedAdmin.signedUrl;
}
