import { createAdminClient } from "@/lib/supabase/admin";

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
  percentual_aplicado: number;
  valor_previsto: number;
  status: "prevista" | "elegivel" | "suspensa" | "cancelada";
  snapshot_regra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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
  percentual_aplicado: number;
  valor_previsto: number;
  status: "prevista" | "elegivel" | "suspensa" | "cancelada";
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
): Promise<{ franquia: PrevisaoFranquiaRow[]; participantes: PrevisaoParticipanteRow[] }> {
  const admin = createAdminClient();

  // 1. Busca a venda
  const { data: venda, error: errVenda } = await admin
    .from("vendas")
    .select("*")
    .eq("id", vendaId)
    .single();

  if (errVenda || !venda) {
    throw new Error("Venda não encontrada para geração de previsões de comissão.");
  }

  // 2. Validação estrita de Tenant
  if (venda.empresa_id !== empresaId) {
    throw new Error("Acesso negado: a venda pertence a outro tenant.");
  }

  // 3. Busca a Cota Definitiva associada, se existir
  const { data: cotaDefinitiva } = await admin
    .from("cotas_definitivas")
    .select("id")
    .eq("venda_id", vendaId)
    .maybeSingle();

  const cotaId = cotaDefinitiva?.id ?? null;

  // 4. Busca programa e regra vigente da franquia para a empresa
  let { data: programa } = await admin
    .from("comissao_programas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();

  if (!programa) {
    // Cria programa padrão para a empresa se não existir
    const { data: novoProg } = await admin
      .from("comissao_programas")
      .insert({
        empresa_id: empresaId,
        nome: "Programa Padrão de Comissão",
        descricao: "Regra padrão da franquia",
        ativo: true,
      })
      .select("*")
      .single();
    programa = novoProg;
  }

  let { data: regraFranquia } = await admin
    .from("comissao_regras_franquia")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("programa_id", programa!.id)
    .eq("ativa", true)
    .maybeSingle();

  if (!regraFranquia) {
    // Regra padrão: 4.0% sobre o crédito em parcela única
    const { data: novaRegra } = await admin
      .from("comissao_regras_franquia")
      .insert({
        empresa_id: empresaId,
        programa_id: programa!.id,
        versao: 1,
        percentual_total_comissao: 4.0,
        base_calculo: "credito",
        ativa: true,
        etapas_cronograma: [
          { ordem: 1, mes_relativo: 1, percentual_etapa: 100, nome: "Parcela Única" },
        ],
      })
      .select("*")
      .single();
    regraFranquia = novaRegra;
  }

  // 5. Cálculo das Etapas da Franquia
  const etapas = (regraFranquia!.etapas_cronograma ?? []) as EtapaCronograma[];
  const valorCredito = Number(venda.valor_credito ?? 0);
  const pctTotalFranquia = Number(regraFranquia!.percentual_total_comissao ?? 4.0);
  const valorComissaoFranquiaTotal = (valorCredito * pctTotalFranquia) / 100;

  const previsoesFranquiaNovas: Partial<PrevisaoFranquiaRow>[] = [];

  for (const et of etapas) {
    const comp = calcularCompetencia(venda.data_venda ?? venda.created_at, Math.max(0, et.mes_relativo - 1));
    const valEtapa = (valorComissaoFranquiaTotal * Number(et.percentual_etapa ?? 100)) / 100;

    previsoesFranquiaNovas.push({
      empresa_id: empresaId,
      venda_id: vendaId,
      cota_definitiva_id: cotaId,
      administradora_id: venda.administradora_id,
      regra_franquia_id: regraFranquia!.id,
      ordem_etapa: et.ordem,
      nome_etapa: et.nome ?? `Etapa ${et.ordem}`,
      competencia: comp,
      base_calculo_valor: valorCredito,
      percentual_aplicado: pctTotalFranquia,
      valor_previsto: Number(valEtapa.toFixed(2)),
      status: "prevista",
      snapshot_regra: {
        programa_nome: programa!.nome,
        versao_regra: regraFranquia!.versao,
        percentual_total: pctTotalFranquia,
        etapa: et,
      },
    });
  }

  // Inserção idempotente na tabela comissao_previsoes_franquia
  const previsoesFranquiaResult: PrevisaoFranquiaRow[] = [];
  for (const prev of previsoesFranquiaNovas) {
    const { data: existente } = await admin
      .from("comissao_previsoes_franquia")
      .select("*")
      .eq("venda_id", vendaId)
      .eq("ordem_etapa", prev.ordem_etapa!)
      .maybeSingle();

    if (existente) {
      previsoesFranquiaResult.push(existente as PrevisaoFranquiaRow);
    } else {
      const { data: inserida } = await admin
        .from("comissao_previsoes_franquia")
        .insert(prev)
        .select("*")
        .single();
      if (inserida) previsoesFranquiaResult.push(inserida as PrevisaoFranquiaRow);
    }
  }

  // 6. Cálculo das Previsões de Participantes (Consultores / Parceiros)
  const previsoesParticipantesResult: PrevisaoParticipanteRow[] = [];

  if (venda.participante_comercial_id || venda.organizacao_parceira_id) {
    let { data: regraPart } = await admin
      .from("comissao_regras_participantes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("programa_id", programa!.id)
      .eq("ativa", true)
      .maybeSingle();

    if (!regraPart) {
      const { data: novaRegraPart } = await admin
        .from("comissao_regras_participantes")
        .insert({
          empresa_id: empresaId,
          programa_id: programa!.id,
          participante_comercial_id: venda.participante_comercial_id ?? null,
          organizacao_parceira_id: venda.organizacao_parceira_id ?? null,
          percentual_comissao: 1.5,
          base_calculo: "credito",
          ativa: true,
        })
        .select("*")
        .single();
      regraPart = novaRegraPart;
    }

    const pctPart = Number(regraPart!.percentual_comissao ?? 1.5);
    const basePart = regraPart!.base_calculo ?? "credito";
    let valorBasePart = valorCredito;
    if (basePart === "comissao_franquia") {
      valorBasePart = valorComissaoFranquiaTotal;
    }

    const valPartTotal = (valorBasePart * pctPart) / 100;

    for (const et of etapas) {
      const comp = calcularCompetencia(venda.data_venda ?? venda.created_at, Math.max(0, et.mes_relativo - 1));
      const valPartEtapa = (valPartTotal * Number(et.percentual_etapa ?? 100)) / 100;

      const { data: partExistente } = await admin
        .from("comissao_previsoes_participantes")
        .select("*")
        .eq("venda_id", vendaId)
        .eq("ordem_etapa", et.ordem)
        .maybeSingle();

      if (partExistente) {
        previsoesParticipantesResult.push(partExistente as PrevisaoParticipanteRow);
      } else {
        const { data: partInserido } = await admin
          .from("comissao_previsoes_participantes")
          .insert({
            empresa_id: empresaId,
            venda_id: vendaId,
            cota_definitiva_id: cotaId,
            participante_comercial_id: venda.participante_comercial_id ?? null,
            organizacao_parceira_id: venda.organizacao_parceira_id ?? null,
            regra_participante_id: regraPart!.id,
            ordem_etapa: et.ordem,
            nome_etapa: et.nome ?? `Etapa ${et.ordem}`,
            competencia: comp,
            base_calculo_valor: valorBasePart,
            percentual_aplicado: pctPart,
            valor_previsto: Number(valPartEtapa.toFixed(2)),
            status: "prevista",
            snapshot_regra: {
              programa_nome: programa!.nome,
              percentual_participante: pctPart,
              base_calculo: basePart,
            },
          })
          .select("*")
          .single();
        if (partInserido) previsoesParticipantesResult.push(partInserido as PrevisaoParticipanteRow);
      }
    }
  }

  return {
    franquia: previsoesFranquiaResult,
    participantes: previsoesParticipantesResult,
  };
}

/**
 * Suspende previsões de comissão não finalizadas para uma venda em caso de inadimplência/cancelamento.
 */
export async function suspenderPrevisoesComissao(
  empresaId: string,
  vendaId: string,
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();

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
  const admin = createAdminClient();

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
  const admin = createAdminClient();
  let query = admin.from("comissao_previsoes_franquia").select("*").eq("empresa_id", empresaId);

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
  const admin = createAdminClient();
  let query = admin.from("comissao_previsoes_participantes").select("*").eq("empresa_id", empresaId);

  if (competencia) {
    query = query.eq("competencia", competencia);
  }

  const { data, error } = await query.order("competencia", { ascending: true });
  if (error || !data) return [];
  return data as PrevisaoParticipanteRow[];
}
