import "server-only";

import { createClient } from "@/lib/supabase/server";
import { FASE3_PERMISSOES } from "./constants";
import { podeVerRegistroComercial } from "./rules";

export type AreaParceiroContexto = {
  empresaId: string;
  participantId: string | null;
  organizacaoIds: string[];
  isResponsavelPrincipalPorOrg: Record<string, boolean>;
  isResponsavelParceiroTipo: boolean;
  temVisaoAmpliada: boolean;
};

/**
 * Contexto comercial do parceiro.
 * Resolução: sessão → usuario → empresa_usuarios → participante → orgs ativas.
 * Nunca confiar em empresa/org/participant vindos do cliente como autorização.
 */
export async function loadAreaParceiroContexto(empresaId: string): Promise<AreaParceiroContexto | null> {
  const supabase = await createClient();
  const { data: participantId, error } = await supabase.rpc("current_participante_id", {
    p_empresa_id: empresaId,
  });
  if (error || !participantId) return null;

  const { data: orgs } = await supabase.rpc("participante_organizacoes_ativas", {
    p_empresa_id: empresaId,
  });
  const organizacaoIds = (orgs ?? []) as string[];

  const isResponsavelPrincipalPorOrg: Record<string, boolean> = {};
  for (const orgId of organizacaoIds) {
    const { data: isResp } = await supabase.rpc("is_responsavel_principal_org", {
      p_empresa_id: empresaId,
      p_organizacao_id: orgId,
    });
    isResponsavelPrincipalPorOrg[orgId] = Boolean(isResp);
  }

  const { data: tipos } = await supabase
    .from("participante_tipos")
    .select("tipo_codigo")
    .eq("empresa_id", empresaId)
    .eq("participante_id", participantId);
  const isResponsavelParceiroTipo = (tipos ?? []).some(
    (t) => t.tipo_codigo === "RESPONSAVEL_PARCEIRO"
  );

  const { data: visao } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: FASE3_PERMISSOES.visaoAmpliadaOrg,
  });

  return {
    empresaId,
    participantId: String(participantId),
    organizacaoIds,
    isResponsavelPrincipalPorOrg,
    isResponsavelParceiroTipo,
    temVisaoAmpliada: Boolean(visao),
  };
}

export function filtrarRegistrosAreaParceiro<
  T extends { organizacao_parceira_id: string | null; participant_id: string | null },
>(ctx: AreaParceiroContexto, rows: T[]): T[] {
  return rows.filter((row) => {
    const orgId = row.organizacao_parceira_id;
    if (!orgId) return false;
    return podeVerRegistroComercial({
      isResponsavelPrincipal: Boolean(ctx.isResponsavelPrincipalPorOrg[orgId]),
      isResponsavelParceiroTipo: ctx.isResponsavelParceiroTipo,
      temVisaoAmpliada: ctx.temVisaoAmpliada,
      registroOrganizacaoId: orgId,
      registroParticipantId: row.participant_id,
      orgsDoUsuario: ctx.organizacaoIds,
      participantIdAtual: ctx.participantId,
    });
  });
}

export function podeVerRegistroNoContexto(
  ctx: AreaParceiroContexto,
  row: {
    empresa_id?: string | null;
    organizacao_parceira_id: string | null;
    participant_id: string | null;
  }
): boolean {
  if (row.empresa_id && row.empresa_id !== ctx.empresaId) return false;
  if (!row.empresa_id && row.empresa_id !== undefined) return false;
  return podeVerRegistroComercial({
    isResponsavelPrincipal: Boolean(
      row.organizacao_parceira_id && ctx.isResponsavelPrincipalPorOrg[row.organizacao_parceira_id]
    ),
    isResponsavelParceiroTipo: ctx.isResponsavelParceiroTipo,
    temVisaoAmpliada: ctx.temVisaoAmpliada,
    registroOrganizacaoId: row.organizacao_parceira_id,
    registroParticipantId: row.participant_id,
    orgsDoUsuario: ctx.organizacaoIds,
    participantIdAtual: ctx.participantId,
  });
}
