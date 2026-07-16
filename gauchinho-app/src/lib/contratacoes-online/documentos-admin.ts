import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsuarioNegocio } from "@/lib/auth/permissions";
import {
  canAccessContratacaoDocumentos,
  MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
} from "@/lib/auth/permissions";
import type { ContratacaoDocumentoRow, TipoDocumentoContratacao } from "./types";

export const SIGNED_URL_TTL_SEGUNDOS = 3600;

const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export const TIPOS_DOCUMENTO_ADMIN: TipoDocumentoContratacao[] = [
  "documento_foto",
  "cpf",
  "cartao_cnpj",
  "documento_responsavel",
  "cpf_responsavel",
  "comprovante_endereco",
  "comprovante_pix",
  "outro",
];

function isTipoDocumento(v: string): v is TipoDocumentoContratacao {
  return (TIPOS_DOCUMENTO_ADMIN as string[]).includes(v);
}

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

/** Upload de documento pelo painel admin (não depende do status público da proposta). */
export async function uploadDocumentoContratacaoAdmin(
  contratacaoId: string,
  tipoRaw: string,
  file: File,
): Promise<ContratacaoDocumentoRow> {
  if (!isTipoDocumento(tipoRaw)) {
    throw new Error("Tipo de documento inválido.");
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo válido.");
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 5 MB).");

  const admin = createAdminClient();
  const { data: contratacao, error: ctrErr } = await admin
    .from("contratacoes_online")
    .select("id")
    .eq("id", contratacaoId)
    .maybeSingle();
  if (ctrErr) throw new Error(ctrErr.message);
  if (!contratacao) throw new Error("Contratação não encontrada.");

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${contratacaoId}/${tipoRaw}_${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("contratacoes-documentos").upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { data: inserted, error: insErr } = await admin
    .from("contratacoes_documentos")
    .insert({
      contratacao_id: contratacaoId,
      tipo_documento: tipoRaw,
      arquivo_url: path,
      arquivo_nome: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
    })
    .select("*")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message ?? "Falha ao registrar documento.");

  if (tipoRaw === "comprovante_pix") {
    await admin
      .from("contratacoes_online")
      .update({ pix_comprovante_url: path, pix_status: "enviado" })
      .eq("id", contratacaoId);
  }

  return inserted as ContratacaoDocumentoRow;
}
