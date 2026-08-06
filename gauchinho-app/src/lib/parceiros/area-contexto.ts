import "server-only";

import { createClient } from "@/lib/supabase/server";
import { podeVerRegistroComercial } from "./rules";

export type AreaParceiroContexto = {
  empresaId: string;
  participantId: string | null;
  organizacaoIds: string[];
  isResponsavelPrincipalPorOrg: Record<string, boolean>;
  temVisaoAmpliada: boolean;
};

/**
 * Fundação do contexto da área comercial (E7 usará plenamente).
 * Nesta rodada: apenas helpers tipados — sem rotas públicas da área.
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

  return {
    empresaId,
    participantId: String(participantId),
    organizacaoIds,
    isResponsavelPrincipalPorOrg,
    temVisaoAmpliada: false,
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
      temVisaoAmpliada: ctx.temVisaoAmpliada,
      registroOrganizacaoId: orgId,
      registroParticipantId: row.participant_id,
      orgsDoUsuario: ctx.organizacaoIds,
      participantIdAtual: ctx.participantId,
    });
  });
}
