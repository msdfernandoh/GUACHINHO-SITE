"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import {
  canAccessContratacaoDocumentos,
  canDeleteRecords,
  MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
} from "@/lib/auth/permissions";
import {
  assertAcessoDocumentosContratacao,
  listarDocumentosContratacaoStaff,
  obterSignedUrlDocumentoContratacao,
} from "@/lib/contratacoes-online/documentos-admin";
import { hydrateContratacaoEndereco } from "@/lib/contratacoes-online/endereco";
import { statusLabel } from "@/lib/contratacoes-online/status";
import { resumoFinanceiroFromDados, linhasGrupoResumoFromDados } from "@/lib/contratacoes-online/extract-fields";
import type { ContratacaoDocumentoRow, ContratacaoOnlineRow } from "@/lib/contratacoes-online/types";
import { buildPropostaPublicUrl } from "@/lib/url/public-url";
import { DEFAULT_SITE, getConfigJsonPublic } from "@/server/config";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";

export async function fetchContratacoesList(): Promise<ContratacaoOnlineRow[]> {
  const usuario = await requireStaffAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("contratacoes_online")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (usuario.leads_apenas_proprios) {
    query = query.eq("gerado_por_usuario_id", usuario.id);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratacaoOnlineRow[];
}

async function removerArquivosDocumentos(contratacaoIds: string[]) {
  if (contratacaoIds.length === 0) return;
  const admin = createAdminClient();
  const { data: docs } = await admin
    .from("contratacoes_documentos")
    .select("arquivo_url")
    .in("contratacao_id", contratacaoIds);
  const paths = (docs ?? [])
    .map((d) => d.arquivo_url as string | null)
    .filter((p): p is string => Boolean(p?.trim()));
  if (paths.length === 0) return;
  // remove em lotes
  for (let i = 0; i < paths.length; i += 50) {
    await admin.storage.from("contratacoes-documentos").remove(paths.slice(i, i + 50));
  }
}

export async function deleteContratacaoAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const usuario = await requireStaffAdmin();
    if (!canDeleteRecords(usuario.perfil) && usuario.perfil !== "srd") {
      return { ok: false, error: "Sem permissão para excluir contratações." };
    }
    await removerArquivosDocumentos([id]);
    const admin = createAdminClient();
    const { error } = await admin.from("contratacoes_online").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/contratacoes");
    revalidatePath(`/admin/contratacoes/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir." };
  }
}

/** Remove propostas sem nome do cliente (lixo de simulações abandonadas). */
export async function deleteContratacoesSemClienteAction(): Promise<
  { ok: true; removed: number } | { ok: false; error: string }
> {
  try {
    const usuario = await requireStaffAdmin();
    if (!canDeleteRecords(usuario.perfil) && usuario.perfil !== "srd") {
      return { ok: false, error: "Sem permissão para excluir contratações." };
    }
    const admin = createAdminClient();
    const { data: rows, error: listErr } = await admin
      .from("contratacoes_online")
      .select("id, nome")
      .order("created_at", { ascending: false })
      .limit(500);
    if (listErr) return { ok: false, error: listErr.message };

    const ids = ((rows ?? []) as Array<{ id: string; nome: string | null }>)
      .filter((r) => !r.nome?.trim())
      .map((r) => r.id);
    if (ids.length === 0) return { ok: true, removed: 0 };

    await removerArquivosDocumentos(ids);
    const { error } = await admin.from("contratacoes_online").delete().in("id", ids);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/contratacoes");
    return { ok: true, removed: ids.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir." };
  }
}

export async function fetchContratacaoDetalhe(id: string) {
  const usuario = await requireStaffAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratacoes_online")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const contratacao = hydrateContratacaoEndereco(data as ContratacaoOnlineRow);
  if (
    usuario.leads_apenas_proprios &&
    contratacao.gerado_por_usuario_id !== usuario.id
  ) {
    return null;
  }
  const podeAcessarDocumentos = canAccessContratacaoDocumentos(usuario.perfil);
  let documentos: ContratacaoDocumentoRow[] = [];
  if (podeAcessarDocumentos) {
    try {
      documentos = await listarDocumentosContratacaoStaff(supabase, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg !== MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO) throw e;
    }
  }

  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  const publicUrl = buildPropostaPublicUrl(contratacao.public_token, site.siteUrl || undefined);
  const resumoFinanceiro = resumoFinanceiroFromDados(
    contratacao.origem,
    (contratacao.dados_simulacao ?? {}) as Record<string, unknown>,
  );
  const gruposLinhas = linhasGrupoResumoFromDados(
    contratacao.origem,
    (contratacao.dados_simulacao ?? {}) as Record<string, unknown>,
  );
  return {
    contratacao,
    documentos,
    publicUrl,
    resumoFinanceiro,
    gruposLinhas,
    statusLabel: statusLabel(contratacao.status),
    podeAcessarDocumentos,
    mensagemSemPermissaoDocumentos: MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
  };
}

export async function getContratacaoDocumentosBulkDownloadAction(
  contratacaoId: string,
): Promise<
  | { ok: true; arquivos: Array<{ documentoId: string; url: string; nome: string }> }
  | { ok: false; error: string }
> {
  try {
    const usuario = await requireStaffAdmin();
    assertAcessoDocumentosContratacao(usuario);
    const supabase = await createClient();
    const docs = await listarDocumentosContratacaoStaff(supabase, contratacaoId);
    const arquivos: Array<{ documentoId: string; url: string; nome: string }> = [];
    for (const d of docs) {
      const url = await obterSignedUrlDocumentoContratacao(supabase, {
        contratacaoId,
        documentoId: d.id,
        download: true,
      });
      arquivos.push({
        documentoId: d.id,
        url,
        nome: d.arquivo_nome?.trim() || `${d.tipo_documento}-${d.id.slice(0, 8)}`,
      });
    }
    return { ok: true, arquivos };
  } catch (e) {
    const message = e instanceof Error ? e.message : MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO;
    return { ok: false, error: message };
  }
}

export async function getContratacaoDocumentoSignedUrlAction(
  contratacaoId: string,
  documentoId: string,
  mode: "view" | "download",
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const usuario = await requireStaffAdmin();
    assertAcessoDocumentosContratacao(usuario);
    const supabase = await createClient();
    const url = await obterSignedUrlDocumentoContratacao(supabase, {
      contratacaoId,
      documentoId,
      download: mode === "download",
    });
    return { ok: true, url };
  } catch (e) {
    const message = e instanceof Error ? e.message : MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO;
    return { ok: false, error: message };
  }
}

export async function prepararUploadContratacaoDocumentoAdminAction(input: {
  contratacaoId: string;
  tipo: string;
  mimeType: string;
  tamanhoBytes: number;
}): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  try {
    const usuario = await requireStaffAdmin();
    assertAcessoDocumentosContratacao(usuario);
    const { prepararUploadDocumentoContratacaoAdmin } = await import(
      "@/lib/contratacoes-online/documentos-admin"
    );
    const preparado = await prepararUploadDocumentoContratacaoAdmin(input);
    return { ok: true, ...preparado };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
    };
  }
}

export async function concluirUploadContratacaoDocumentoAdminAction(input: {
  contratacaoId: string;
  tipo: string;
  path: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const usuario = await requireStaffAdmin();
    assertAcessoDocumentosContratacao(usuario);
    const { concluirUploadDocumentoContratacaoAdmin } = await import(
      "@/lib/contratacoes-online/documentos-admin"
    );
    await concluirUploadDocumentoContratacaoAdmin(input);
    revalidatePath(`/admin/contratacoes/${input.contratacaoId}`);
    revalidatePath("/admin/contratacoes");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
    };
  }
}

export async function updateContratacaoStatusAction(id: string, status: string) {
  await requireStaffAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("contratacoes_online").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/contratacoes/${id}`);
  revalidatePath("/admin/contratacoes");
}

export async function updateContratoAssinadoAction(
  id: string,
  assinado: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const usuario = await requireStaffAdmin();
    const supabase = await createClient();
    let query = supabase
      .from("contratacoes_online")
      .update({
        contrato_assinado: assinado,
        contrato_assinado_em: assinado ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (usuario.leads_apenas_proprios) {
      query = query.eq("gerado_por_usuario_id", usuario.id);
    }
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      if (isDbMissingColumnError(error)) {
        return {
          ok: false,
          error:
            "O controle de contrato assinado ainda não está configurado. Aplique a migration 041_contratacoes_contrato_assinado.sql.",
        };
      }
      return { ok: false, error: error.message };
    }
    if (!data) return { ok: false, error: "Contratação não encontrada ou sem permissão." };

    revalidatePath(`/admin/contratacoes/${id}`);
    revalidatePath("/admin/contratacoes");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao atualizar contrato assinado.",
    };
  }
}

export type UpdateContratacaoClienteInput = {
  nome: string;
  telefone: string;
  email?: string;
  tipo_pessoa: "cpf" | "cnpj";
  cpf?: string;
  data_nascimento?: string;
  razao_social?: string;
  cnpj?: string;
  responsavel_nome?: string;
  responsavel_cpf?: string;
  observacao_cliente?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export async function updateContratacaoClienteAction(
  id: string,
  input: UpdateContratacaoClienteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireStaffAdmin();
    const { atualizarDadosClienteAdmin } = await import("@/lib/contratacoes-online/service");
    await atualizarDadosClienteAdmin(id, input);
    revalidatePath(`/admin/contratacoes/${id}`);
    revalidatePath("/admin/contratacoes");
    if (input.telefone || input.nome) {
      revalidatePath("/admin/leads");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao salvar dados do cliente." };
  }
}
