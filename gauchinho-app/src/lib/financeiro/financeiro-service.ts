import { createAdminClient } from "@/lib/supabase/admin";

export type RecebimentoInput = {
  empresaId: string;
  administradoraId: string;
  competencia: string; // YYYY-MM
  dataRecebimento?: string;
  valorTotal: number;
  formaPagamento?: "pix" | "ted" | "boleto" | "outros";
  referenciaDocumento?: string;
  observacoes?: string;
  itens: {
    previsaoFranquiaId: string;
    valorLiquidado: number;
  }[];
};

export type PagamentoInput = {
  empresaId: string;
  participanteComercialId?: string | null;
  organizacaoParceiraId?: string | null;
  competencia: string; // YYYY-MM
  dataPagamento?: string;
  valorBruto: number;
  formaPagamento?: "pix" | "ted" | "outros";
  referenciaDocumento?: string;
  observacoes?: string;
  itens: {
    previsaoParticipanteId: string;
    valorLiquidado: number;
  }[];
};

export type ResumoCaixa = {
  totalEntradas: number;
  totalSaidas: number;
  saldoCaixa: number;
  totalPrevisoesReceber: number;
  totalPrevisoesPagar: number;
  totalSaldosACompensar: number;
};

/**
 * Registra o recebimento real de comissão enviado pela administradora.
 * Liquida parcial ou totalmente as previsões da franquia e lança movimento de ENTRADA no caixa.
 */
export async function registrarRecebimentoAdministradora(input: RecebimentoInput) {
  const admin = createAdminClient();

  // 1. Validação estrita de valor
  if (input.valorTotal <= 0) {
    throw new Error("O valor total do recebimento deve ser maior que zero.");
  }

  // 2. Cria registro de recebimento no banco
  const { data: recebimento, error: errRec } = await admin
    .from("financeiro_recebimentos")
    .insert({
      empresa_id: input.empresaId,
      administradora_id: input.administradoraId,
      competencia: input.competencia,
      data_recebimento: input.dataRecebimento ?? new Date().toISOString().split("T")[0],
      valor_total: input.valorTotal,
      forma_pagamento: input.formaPagamento ?? "pix",
      referencia_documento: input.referenciaDocumento ?? null,
      observacoes: input.observacoes ?? null,
      status: "confirmado",
    })
    .select("*")
    .single();

  if (errRec || !recebimento) {
    throw new Error(`Erro ao registrar recebimento: ${errRec?.message}`);
  }

  // 3. Registra os itens e liquida previsões da franquia
  for (const item of input.itens) {
    await admin.from("financeiro_recebimento_itens").insert({
      recebimento_id: recebimento.id,
      previsao_franquia_id: item.previsaoFranquiaId,
      valor_liquidado: item.valorLiquidado,
    });

    // Atualiza status da previsão da franquia para elegivel
    await admin
      .from("comissao_previsoes_franquia")
      .update({ status: "elegivel", updated_at: new Date().toISOString() })
      .eq("id", item.previsaoFranquiaId)
      .eq("empresa_id", input.empresaId);
  }

  // 4. Lança movimento de ENTRADA no Caixa imutável
  await admin.from("caixa_movimentos").insert({
    empresa_id: input.empresaId,
    tipo_movimento: "entrada",
    origem_tipo: "recebimento_administradora",
    origem_id: recebimento.id,
    data_movimento: recebimento.data_recebimento,
    competencia: input.competencia,
    valor: input.valorTotal,
    descricao: `Recebimento da Administradora (${input.competencia}) - Doc: ${input.referenciaDocumento ?? "S/Ref"}`,
  });

  return recebimento;
}

/**
 * Registra o pagamento/repasse real efetuado ao consultor ou organização parceira.
 * Abate automaticamente saldos a compensar existentes e lança movimento de SAÍDA no caixa.
 */
export async function registrarPagamentoParticipante(input: PagamentoInput) {
  const admin = createAdminClient();

  if (input.valorBruto <= 0) {
    throw new Error("O valor bruto do pagamento deve ser maior que zero.");
  }

  // 1. Verifica saldos a compensar pendentes para o participante/parceiro
  let valorCompensado = 0;
  let queryComp = admin
    .from("financeiro_compensacoes")
    .select("*")
    .eq("empresa_id", input.empresaId)
    .eq("status", "pendente");

  if (input.participanteComercialId) {
    queryComp = queryComp.eq("participante_comercial_id", input.participanteComercialId);
  } else if (input.organizacaoParceiraId) {
    queryComp = queryComp.eq("organizacao_parceira_id", input.organizacaoParceiraId);
  }

  const { data: compensacoes } = await queryComp;

  let valorRestanteParaAbater = input.valorBruto;

  if (compensacoes && compensacoes.length > 0) {
    for (const comp of compensacoes) {
      if (valorRestanteParaAbater <= 0) break;

      const saldoAtualComp = Number(comp.valor_saldo ?? 0);
      if (saldoAtualComp <= 0) continue;

      const abate = Math.min(saldoAtualComp, valorRestanteParaAbater);
      valorCompensado += abate;
      valorRestanteParaAbater -= abate;

      const novoSaldoComp = saldoAtualComp - abate;
      const novoStatus = novoSaldoComp === 0 ? "compensada" : "parcial";

      await admin
        .from("financeiro_compensacoes")
        .update({
          valor_saldo: novoSaldoComp,
          status: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", comp.id);
    }
  }

  const valorLiquido = Math.max(0, input.valorBruto - valorCompensado);

  // 2. Cria registro de pagamento
  const { data: pagamento, error: errPag } = await admin
    .from("financeiro_pagamentos")
    .insert({
      empresa_id: input.empresaId,
      participante_comercial_id: input.participanteComercialId ?? null,
      organizacao_parceira_id: input.organizacaoParceiraId ?? null,
      competencia: input.competencia,
      data_pagamento: input.dataPagamento ?? new Date().toISOString().split("T")[0],
      valor_bruto: input.valorBruto,
      valor_compensado: valorCompensado,
      valor_liquido: valorLiquido,
      forma_pagamento: input.formaPagamento ?? "pix",
      referencia_documento: input.referenciaDocumento ?? null,
      observacoes: input.observacoes ?? null,
      status: "confirmado",
    })
    .select("*")
    .single();

  if (errPag || !pagamento) {
    throw new Error(`Erro ao registrar pagamento: ${errPag?.message}`);
  }

  // 3. Registra os itens e liquida previsões dos participantes
  for (const item of input.itens) {
    await admin.from("financeiro_pagamento_itens").insert({
      pagamento_id: pagamento.id,
      previsao_participante_id: item.previsaoParticipanteId,
      valor_liquidado: item.valorLiquidado,
    });

    await admin
      .from("comissao_previsoes_participantes")
      .update({ status: "elegivel", updated_at: new Date().toISOString() })
      .eq("id", item.previsaoParticipanteId)
      .eq("empresa_id", input.empresaId);
  }

  // 4. Lança movimento de SAÍDA no Caixa imutável (apenas se valorLiquido > 0)
  if (valorLiquido > 0) {
    await admin.from("caixa_movimentos").insert({
      empresa_id: input.empresaId,
      tipo_movimento: "saida",
      origem_tipo: "pagamento_participante",
      origem_id: pagamento.id,
      data_movimento: pagamento.data_pagamento,
      competencia: input.competencia,
      valor: valorLiquido,
      descricao: `Pagamento a Participante (${input.competencia}) - Líquido: R$ ${valorLiquido.toFixed(2)} (Abatido: R$ ${valorCompensado.toFixed(2)})`,
    });
  }

  return pagamento;
}

/**
 * Gera um valor A COMPENSAR para um participante (ex: estorno ou cancelamento de venda já paga).
 */
export async function gerarCompensacaoParticipante(
  empresaId: string,
  motivo: string,
  valor: number,
  participanteComercialId?: string | null,
  organizacaoParceiraId?: string | null,
  vendaId?: string | null,
) {
  const admin = createAdminClient();

  const { data: comp, error } = await admin
    .from("financeiro_compensacoes")
    .insert({
      empresa_id: empresaId,
      participante_comercial_id: participanteComercialId ?? null,
      organizacao_parceira_id: organizacaoParceiraId ?? null,
      venda_id: vendaId ?? null,
      motivo: motivo,
      valor_original: valor,
      valor_saldo: valor,
      status: "pendente",
    })
    .select("*")
    .single();

  if (error || !comp) {
    throw new Error(`Erro ao gerar compensação: ${error?.message}`);
  }

  return comp;
}

/**
 * Obtém o resumo consolidado do Caixa e das Obrigações Financeiras do Tenant.
 * Para a Empresa B (0 concessões), retorna zeros absolutos.
 */
export async function getResumoCaixaEmpresa(empresaId: string): Promise<ResumoCaixa> {
  const admin = createAdminClient();

  // Movimentos de caixa
  const { data: movs } = await admin
    .from("caixa_movimentos")
    .select("tipo_movimento, valor")
    .eq("empresa_id", empresaId);

  let totalEntradas = 0;
  let totalSaidas = 0;

  if (movs) {
    for (const m of movs) {
      const val = Number(m.valor ?? 0);
      if (m.tipo_movimento === "entrada") totalEntradas += val;
      if (m.tipo_movimento === "saida") totalSaidas += val;
    }
  }

  const saldoCaixa = totalEntradas - totalSaidas;

  // Previsões Franquia
  const { data: prevsF } = await admin
    .from("comissao_previsoes_franquia")
    .select("valor_previsto")
    .eq("empresa_id", empresaId)
    .in("status", ["prevista", "elegivel"]);

  const totalPrevisoesReceber = prevsF
    ? prevsF.reduce((acc, curr) => acc + Number(curr.valor_previsto ?? 0), 0)
    : 0;

  // Previsões Participantes
  const { data: prevsP } = await admin
    .from("comissao_previsoes_participantes")
    .select("valor_previsto")
    .eq("empresa_id", empresaId)
    .in("status", ["prevista", "elegivel"]);

  const totalPrevisoesPagar = prevsP
    ? prevsP.reduce((acc, curr) => acc + Number(curr.valor_previsto ?? 0), 0)
    : 0;

  // Compensações Pendentes
  const { data: comps } = await admin
    .from("financeiro_compensacoes")
    .select("valor_saldo")
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "parcial"]);

  const totalSaldosACompensar = comps
    ? comps.reduce((acc, curr) => acc + Number(curr.valor_saldo ?? 0), 0)
    : 0;

  return {
    totalEntradas: Number(totalEntradas.toFixed(2)),
    totalSaidas: Number(totalSaidas.toFixed(2)),
    saldoCaixa: Number(saldoCaixa.toFixed(2)),
    totalPrevisoesReceber: Number(totalPrevisoesReceber.toFixed(2)),
    totalPrevisoesPagar: Number(totalPrevisoesPagar.toFixed(2)),
    totalSaldosACompensar: Number(totalSaldosACompensar.toFixed(2)),
  };
}
