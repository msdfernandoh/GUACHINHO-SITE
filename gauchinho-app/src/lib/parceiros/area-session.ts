import "server-only";

import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { getUserCompanies } from "@/lib/tenant/context";
import {
  hasPermissaoAreaParceiro,
  requireAcessarAreaParceiro,
  requirePermissaoAreaParceiro,
} from "./authorization";
import {
  loadAreaParceiroContexto,
  type AreaParceiroContexto,
} from "./area-contexto";
import { FASE3_PERMISSOES } from "./constants";
import {
  fase3ParceiroAreaDisabledMessage,
  isFase3ParceiroAreaReady,
} from "./schema-ready";

export type AreaParceiroSession = {
  usuarioId: string;
  usuarioNome: string;
  papelCodigo: string | null;
  empresaId: string;
  empresaNome: string;
  ctx: AreaParceiroContexto;
  organizacaoAtivaId: string | null;
  permissoes: {
    visualizarLeads: boolean;
    criarLeads: boolean;
    editarLeads: boolean;
    visualizarPropostas: boolean;
    criarPropostas: boolean;
    editarPropostas: boolean;
  };
};

/**
 * Resolve contexto obrigatório sem confiar em IDs do cliente como autorização.
 * `orgPreferida` só seleciona entre orgs já autorizadas pelo servidor.
 */
export async function requireAreaParceiroSession(options?: {
  orgPreferida?: string | null;
}): Promise<AreaParceiroSession> {
  const ready = await isFase3ParceiroAreaReady();
  if (!ready) {
    throw new Error(fase3ParceiroAreaDisabledMessage());
  }

  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    redirect("/login?next=/area-parceiro");
  }

  const vinculos = await getUserCompanies(usuario.id);
  if (!vinculos.length) {
    throw new Error("Usuário sem vínculo empresarial ativo.");
  }

  let chosen: {
    empresaId: string;
    empresaNome: string;
    papelCodigo: string | null;
    ctx: AreaParceiroContexto;
  } | null = null;

  for (const v of vinculos) {
    const empresaId = v.empresa_id;
    const papelCodigo = v.papel?.codigo ?? null;
    try {
      await requireAcessarAreaParceiro(empresaId);
    } catch {
      continue;
    }
    const ctx = await loadAreaParceiroContexto(empresaId);
    if (!ctx?.participantId) continue;
    if (!ctx.organizacaoIds.length) {
      // Participante sem org ativa: sessão existe mas sem dados comerciais.
      chosen = {
        empresaId,
        empresaNome: v.empresa?.nome_fantasia || v.empresa?.razao_social || empresaId,
        papelCodigo,
        ctx,
      };
      break;
    }
    chosen = {
      empresaId,
      empresaNome: v.empresa?.nome_fantasia || v.empresa?.razao_social || empresaId,
      papelCodigo,
      ctx,
    };
    break;
  }

  if (!chosen) {
    throw new Error("Acesso à área do parceiro indisponível para este usuário.");
  }

  const orgPreferida = options?.orgPreferida?.trim() || null;
  let organizacaoAtivaId: string | null = null;
  if (orgPreferida && chosen.ctx.organizacaoIds.includes(orgPreferida)) {
    organizacaoAtivaId = orgPreferida;
  } else {
    organizacaoAtivaId = chosen.ctx.organizacaoIds[0] ?? null;
  }

  const [visualizarLeads, criarLeads, editarLeads, visualizarPropostas, criarPropostas, editarPropostas] =
    await Promise.all([
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.visualizarLeads),
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.criarLeads),
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.editarLeads),
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.visualizarPropostas),
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.criarPropostas),
      hasPermissaoAreaParceiro(chosen.empresaId, FASE3_PERMISSOES.editarPropostas),
    ]);

  return {
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    papelCodigo: chosen.papelCodigo,
    empresaId: chosen.empresaId,
    empresaNome: chosen.empresaNome,
    ctx: chosen.ctx,
    organizacaoAtivaId,
    permissoes: {
      visualizarLeads,
      criarLeads,
      editarLeads,
      visualizarPropostas,
      criarPropostas,
      editarPropostas,
    },
  };
}

export async function requireAreaPerm(session: AreaParceiroSession, code: string) {
  await requirePermissaoAreaParceiro(session.empresaId, code);
}
