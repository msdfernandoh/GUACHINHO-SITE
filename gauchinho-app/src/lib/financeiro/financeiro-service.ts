import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Valor decimal serializado. O PostgreSQL faz toda aritmética monetária crítica. */
export type ValorMonetario = string;

export type RecebimentoInput = {
  empresaId: string;
  administradoraId: string;
  competencia: string;
  idempotencyKey: string;
  dataRecebimento?: string;
  valorTotal: ValorMonetario;
  formaPagamento?: "pix" | "ted" | "boleto" | "outros";
  referenciaDocumento?: string;
  observacoes?: string;
  itens: { previsaoFranquiaId: string; valorLiquidado: ValorMonetario }[];
};

export type PagamentoInput = {
  empresaId: string;
  participanteComercialId?: string | null;
  organizacaoParceiraId?: string | null;
  competencia: string;
  idempotencyKey: string;
  dataPagamento?: string;
  valorBruto: ValorMonetario;
  formaPagamento?: "pix" | "ted" | "outros";
  referenciaDocumento?: string;
  observacoes?: string;
  itens: { previsaoParticipanteId: string; valorLiquidado: ValorMonetario }[];
};

export type ResumoCaixa = {
  totalEntradas: number;
  totalSaidas: number;
  saldoCaixa: number;
  totalPrevisoesReceber: number;
  totalPrevisoesPagar: number;
  totalSaldosACompensar: number;
};

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function registrarRecebimentoAdministradora(input: RecebimentoInput) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_registrar_recebimento", {
    p_empresa_id: input.empresaId,
    p_administradora_id: input.administradoraId,
    p_competencia: input.competencia,
    p_data_recebimento: input.dataRecebimento ?? hojeIso(),
    p_valor_total: input.valorTotal,
    p_forma_pagamento: input.formaPagamento ?? "pix",
    p_referencia_documento: input.referenciaDocumento ?? null,
    p_observacoes: input.observacoes ?? null,
    p_itens: input.itens.map((item) => ({
      previsao_franquia_id: item.previsaoFranquiaId,
      valor_liquidado: item.valorLiquidado,
    })),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return (data as { recebimento?: unknown } | null)?.recebimento ?? data;
}

export async function registrarPagamentoParticipante(input: PagamentoInput) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_registrar_pagamento", {
    p_empresa_id: input.empresaId,
    p_competencia: input.competencia,
    p_data_pagamento: input.dataPagamento ?? hojeIso(),
    p_valor_bruto: input.valorBruto,
    p_forma_pagamento: input.formaPagamento ?? "pix",
    p_referencia_documento: input.referenciaDocumento ?? null,
    p_observacoes: input.observacoes ?? null,
    p_itens: input.itens.map((item) => ({
      previsao_participante_id: item.previsaoParticipanteId,
      valor_liquidado: item.valorLiquidado,
    })),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return (data as { pagamento?: unknown } | null)?.pagamento ?? data;
}

export async function gerarCompensacaoParticipante(
  empresaId: string,
  motivo: string,
  valor: ValorMonetario,
  participanteComercialId: string | null,
  organizacaoParceiraId: string | null,
  vendaId: string | null,
  idempotencyKey: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_gerar_compensacao", {
    p_empresa_id: empresaId,
    p_motivo: motivo,
    p_valor: valor,
    p_participante_comercial_id: participanteComercialId,
    p_organizacao_parceira_id: organizacaoParceiraId,
    p_venda_id: vendaId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return (data as { compensacao?: unknown } | null)?.compensacao ?? data;
}

export async function cancelarVendaComCompensacao(
  empresaId: string,
  vendaId: string,
  motivo: string,
  idempotencyKey: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_cancelar_venda_comissoes", {
    p_empresa_id: empresaId,
    p_venda_id: vendaId,
    p_motivo: motivo,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function estornarRecebimento(
  empresaId: string,
  recebimentoId: string,
  motivo: string,
  idempotencyKey: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_estornar_recebimento", {
    p_empresa_id: empresaId,
    p_recebimento_id: recebimentoId,
    p_motivo: motivo,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function estornarPagamento(
  empresaId: string,
  pagamentoId: string,
  motivo: string,
  idempotencyKey: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_estornar_pagamento", {
    p_empresa_id: empresaId,
    p_pagamento_id: pagamentoId,
    p_motivo: motivo,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getResumoCaixaEmpresa(empresaId: string): Promise<ResumoCaixa> {
  const admin = createAdminClient();
  const [movimentos, franquia, participantes, compensacoes] = await Promise.all([
    admin.from("caixa_movimentos").select("tipo_movimento, valor").eq("empresa_id", empresaId),
    admin.from("comissao_previsoes_franquia").select("valor_previsto, valor_liquidado").eq("empresa_id", empresaId).in("status", ["prevista", "parcialmente_liquidada"]),
    admin.from("comissao_previsoes_participantes").select("valor_elegivel, valor_pago").eq("empresa_id", empresaId).in("status", ["parcialmente_elegivel", "elegivel", "parcialmente_paga"]),
    admin.from("financeiro_compensacoes_saldos").select("saldo_calculado").eq("empresa_id", empresaId).gt("saldo_calculado", 0),
  ]);

  const entradas = (movimentos.data ?? []).filter((m) => m.tipo_movimento === "entrada").reduce((s, m) => s + Number(m.valor), 0);
  const saidas = (movimentos.data ?? []).filter((m) => m.tipo_movimento === "saida").reduce((s, m) => s + Number(m.valor), 0);
  const receber = (franquia.data ?? []).reduce((s, p) => s + Number(p.valor_previsto) - Number(p.valor_liquidado), 0);
  const pagar = (participantes.data ?? []).reduce((s, p) => s + Number(p.valor_elegivel) - Number(p.valor_pago), 0);
  const compensar = (compensacoes.data ?? []).reduce((s, c) => s + Number(c.saldo_calculado), 0);
  const centavos = (valor: number) => Number(valor.toFixed(2));

  return {
    totalEntradas: centavos(entradas),
    totalSaidas: centavos(saidas),
    saldoCaixa: centavos(entradas - saidas),
    totalPrevisoesReceber: centavos(receber),
    totalPrevisoesPagar: centavos(pagar),
    totalSaldosACompensar: centavos(compensar),
  };
}
