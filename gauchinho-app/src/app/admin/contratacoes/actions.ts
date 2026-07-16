"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import {
  canAccessContratacaoDocumentos,
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

export async function fetchContratacoesList(): Promise<ContratacaoOnlineRow[]> {
  await requireStaffAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratacoes_online")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratacaoOnlineRow[];
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

export async function updateContratacaoStatusAction(id: string, status: string) {
  await requireStaffAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("contratacoes_online").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/contratacoes/${id}`);
  revalidatePath("/admin/contratacoes");
}
