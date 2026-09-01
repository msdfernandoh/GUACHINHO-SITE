import "server-only";

import { createClient } from "@/lib/supabase/server";

export type EtapaCronograma = {
  ordem: number;
  mes_relativo: number;
  percentual_etapa: number;
  nome: string;
};

export type PrevisaoFranquiaRow = {
  id: string;
  empresa_id: string;
  venda_id: string;
  cota_definitiva_id: string | null;
  administradora_id: string;
  regra_franquia_id: string | null;
  ordem_etapa: number;
  nome_etapa: string;
  competencia: string;
  base_calculo_valor: number;
  percentual_aplicado: number | null;
  valor_fixo_aplicado: number | null;
  valor_previsto: number;
  valor_liquidado: number;
  tipo_gatilho?: "MES_RELATIVO" | "CONTEMPLACAO";
  valor_bruto?: number | null;
  percentual_imposto?: number | null;
  valor_imposto?: number | null;
  valor_liquido?: number | null;
  status: "prevista" | "parcialmente_liquidada" | "liquidada" | "suspensa" | "cancelada";
  snapshot_regra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  venda?: { cliente_nome: string | null } | Array<{ cliente_nome: string | null }> | null;
  cota?: { numero_grupo: string | null; numero_cota: string | null } | Array<{ numero_grupo: string | null; numero_cota: string | null }> | null;
};

export type PrevisaoParticipanteRow = {
  id: string;
  empresa_id: string;
  venda_id: string;
  cota_definitiva_id: string | null;
  participante_comercial_id: string | null;
  organizacao_parceira_id: string | null;
  regra_participante_id: string | null;
  ordem_etapa: number;
  nome_etapa: string;
  competencia: string;
  base_calculo_valor: number;
  percentual_aplicado: number | null;
  valor_fixo_aplicado: number | null;
  valor_previsto: number;
  valor_elegivel: number;
  valor_pago: number;
  tipo_gatilho?: "MES_RELATIVO" | "CONTEMPLACAO";
  conferido_por_participante?: boolean;
  status: "prevista" | "parcialmente_elegivel" | "elegivel" | "parcialmente_paga" | "paga" | "suspensa" | "cancelada";
  snapshot_regra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Calcula o formato de competência YYYY-MM a partir de uma data e deslocamento em meses.
 */
export function calcularCompetencia(dataIso: string, mesDeslocamento = 0): string {
  const d = new Date(dataIso);
  d.setMonth(d.getMonth() + mesDeslocamento);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/**
 * Gera deterministicamente as previsões de comissão da Franquia e dos Participantes
 * para uma venda efetivada. É IDEMPOTENTE: não duplica previsões se executada novamente.
 */
export async function gerarPrevisoesComissaoParaVenda(
  empresaId: string,
  vendaId: string,
  idempotencyKey = `previsoes:${vendaId}`,
): Promise<{ franquia: PrevisaoFranquiaRow[]; participantes: PrevisaoParticipanteRow[] }> {
  const admin = await createClient();
  const { data, error } = await admin.rpc("rpc_gerar_previsoes_comissao", {
    p_empresa_id: empresaId,
    p_venda_id: vendaId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const result = data as { franquia?: PrevisaoFranquiaRow[]; participantes?: PrevisaoParticipanteRow[] } | null;
  return { franquia: result?.franquia ?? [], participantes: result?.participantes ?? [] };
}

/**
 * Suspende previsões de comissão não finalizadas para uma venda em caso de inadimplência/cancelamento.
 */
export async function suspenderPrevisoesComissao(
  empresaId: string,
  vendaId: string,
): Promise<{ ok: boolean }> {
  const admin = await createClient();

  await admin
    .from("comissao_previsoes_franquia")
    .update({ status: "suspensa", updated_at: new Date().toISOString() })
    .eq("venda_id", vendaId)
    .eq("empresa_id", empresaId)
    .eq("status", "prevista");

  await admin
    .from("comissao_previsoes_participantes")
    .update({ status: "suspensa", updated_at: new Date().toISOString() })
    .eq("venda_id", vendaId)
    .eq("empresa_id", empresaId)
    .eq("status", "prevista");

  return { ok: true };
}

/**
 * Reativa previsões de comissão suspensas quando a venda/cota volta a ser elegível.
 */
export async function reativarPrevisoesComissao(
  empresaId: string,
  vendaId: string,
): Promise<{ ok: boolean }> {
  const admin = await createClient();

  await admin
    .from("comissao_previsoes_franquia")
    .update({ status: "prevista", updated_at: new Date().toISOString() })
    .eq("venda_id", vendaId)
    .eq("empresa_id", empresaId)
    .eq("status", "suspensa");

  await admin
    .from("comissao_previsoes_participantes")
    .update({ status: "prevista", updated_at: new Date().toISOString() })
    .eq("venda_id", vendaId)
    .eq("empresa_id", empresaId)
    .eq("status", "suspensa");

  return { ok: true };
}

/**
 * Lista previsões de comissão da franquia para um tenant (opcionalmente filtrado por competência YYYY-MM).
 * Para a Empresa B (0 concessões e 0 vendas), retorna lista vazia.
 */
export async function listPrevisoesFranquiaForEmpresa(
  empresaId: string,
  competencia?: string,
): Promise<PrevisaoFranquiaRow[]> {
  const admin = await createClient();
  let query = admin
    .from("comissao_previsoes_franquia")
    .select("*,venda:vendas(cliente_nome),cota:cotas_definitivas(numero_grupo,numero_cota)")
    .eq("empresa_id", empresaId);

  if (competencia) {
    query = query.eq("competencia", competencia);
  }

  const { data, error } = await query.order("competencia", { ascending: true });
  if (error || !data) return [];
  return data as PrevisaoFranquiaRow[];
}

/**
 * Lista previsões de comissão dos participantes para um tenant.
 */
export async function listPrevisoesParticipantesForEmpresa(
  empresaId: string,
  competencia?: string,
): Promise<PrevisaoParticipanteRow[]> {
  const admin = await createClient();
  let query = admin.from("comissao_previsoes_participantes").select("*").eq("empresa_id", empresaId);

  if (competencia) {
    query = query.eq("competencia", competencia);
  }

  const { data, error } = await query.order("competencia", { ascending: true });
  if (error || !data) return [];
  return data as PrevisaoParticipanteRow[];
}
