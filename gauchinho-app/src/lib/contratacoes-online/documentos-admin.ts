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
const DOCUMENTOS_BUCKET = "contratacoes-documentos";

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

function validarMetadadosUpload(tipoRaw: string, mimeType: string, tamanhoBytes: number) {
  if (!isTipoDocumento(tipoRaw)) {
    throw new Error("Tipo de documento inválido.");
  }
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
    throw new Error("Selecione um arquivo válido.");
  }
  if (!MIME_PERMITIDOS.has(mimeType)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.");
  }
  if (tamanhoBytes > MAX_BYTES) {
    throw new Error("Arquivo muito grande (máx. 5 MB).");
  }
}

function extensaoPorMime(mimeType: string) {
  return mimeType === "application/pdf"
    ? "pdf"
    : mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";
}

async function validarContratacaoExiste(contratacaoId: string) {
  const admin = createAdminClient();
  const { data: contratacao, error } = await admin
    .from("contratacoes_online")
    .select("id")
    .eq("id", contratacaoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contratacao) throw new Error("Contratação não encontrada.");
  return admin;
}

async function registrarDocumentoContratacao(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    contratacaoId: string;
    tipo: TipoDocumentoContratacao;
    path: string;
    arquivoNome: string;
    mimeType: string;
    tamanhoBytes: number;
  },
): Promise<ContratacaoDocumentoRow> {
  const { data: inserted, error: insErr } = await admin
    .from("contratacoes_documentos")
    .insert({
      contratacao_id: params.contratacaoId,
      tipo_documento: params.tipo,
      arquivo_url: params.path,
      arquivo_nome: params.arquivoNome,
      mime_type: params.mimeType,
      tamanho_bytes: params.tamanhoBytes,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    await admin.storage.from(DOCUMENTOS_BUCKET).remove([params.path]);
    throw new Error(insErr?.message ?? "Falha ao registrar documento.");
  }

  if (params.tipo === "comprovante_pix") {
    await admin
      .from("contratacoes_online")
      .update({ pix_comprovante_url: params.path, pix_status: "enviado" })
      .eq("id", params.contratacaoId);
  }

  return inserted as ContratacaoDocumentoRow;
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

/** Autoriza um único upload direto do navegador para o bucket privado. */
export async function prepararUploadDocumentoContratacaoAdmin(params: {
  contratacaoId: string;
  tipo: string;
  mimeType: string;
  tamanhoBytes: number;
}): Promise<{ path: string; token: string }> {
  validarMetadadosUpload(params.tipo, params.mimeType, params.tamanhoBytes);
  const admin = await validarContratacaoExiste(params.contratacaoId);
  const ext = extensaoPorMime(params.mimeType);
  const path = `${params.contratacaoId}/${params.tipo}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await admin.storage
    .from(DOCUMENTOS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token) {
    throw new Error(error?.message ?? "Não foi possível preparar o envio do documento.");
  }
  return { path, token: data.token };
}

/** Confirma no banco um arquivo que já foi enviado por URL assinada. */
export async function concluirUploadDocumentoContratacaoAdmin(params: {
  contratacaoId: string;
  tipo: string;
  path: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
}): Promise<ContratacaoDocumentoRow> {
  validarMetadadosUpload(params.tipo, params.mimeType, params.tamanhoBytes);
  const prefixoEsperado = `${params.contratacaoId}/${params.tipo}_`;
  if (!params.path.startsWith(prefixoEsperado) || params.path.includes("..")) {
    throw new Error("Caminho do documento inválido.");
  }

  const admin = await validarContratacaoExiste(params.contratacaoId);
  const nomeObjeto = params.path.slice(params.contratacaoId.length + 1);
  const { data: objetos, error: listErr } = await admin.storage
    .from(DOCUMENTOS_BUCKET)
    .list(params.contratacaoId, { search: nomeObjeto, limit: 10 });
  if (listErr) throw new Error(listErr.message);
  if (!(objetos ?? []).some((objeto) => objeto.name === nomeObjeto)) {
    throw new Error("O arquivo enviado não foi encontrado no armazenamento.");
  }

  return registrarDocumentoContratacao(admin, {
    contratacaoId: params.contratacaoId,
    tipo: params.tipo as TipoDocumentoContratacao,
    path: params.path,
    arquivoNome: params.arquivoNome,
    mimeType: params.mimeType,
    tamanhoBytes: params.tamanhoBytes,
  });
}
