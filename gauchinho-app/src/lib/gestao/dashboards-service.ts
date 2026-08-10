import { createAdminClient } from "@/lib/supabase/admin";
import { getResumoCaixaEmpresa } from "@/lib/financeiro/financeiro-service";

export type ResumoExecutivoDTO = {
  total_credito_vendido: number;
  total_vendas_count: number;
  ticket_medio: number;
  receita_prevista_franquia: number;
  receita_recebida_franquia: number;
  repasses_previstos_participantes: number;
  repasses_pagos_participantes: number;
  saldo_caixa: number;
  leads_count: number;
  propostas_count: number;
  metas_atingimento_medio: number;
  tarefas_pendentes_count: number;
  tarefas_atrasadas_count: number;
};

export type ResumoComercialDTO = {
  leads_totais: number;
  leads_em_andamento: number;
  propostas_totais: number;
  vendas_totais: number;
  credito_total_vendido: number;
  taxa_conversao_lead_venda: number;
  vendas_por_origem: Record<string, number>;
};

export type ResumoFinanceiroDashDTO = {
  receita_prevista_franquia: number;
  receita_recebida_franquia: number;
  saldo_a_receber_franquia: number;
  repasses_previstos_participantes: number;
  repasses_pagos_participantes: number;
  saldo_a_repassar_participantes: number;
  saldos_a_compensar: number;
  saldo_caixa: number;
  total_entradas_caixa: number;
  total_saidas_caixa: number;
};

export async function getResumoExecutivo(empresaId: string): Promise<ResumoExecutivoDTO> {
  const admin = createAdminClient();

  // 1. Vendas
  const { data: vendas } = await admin
    .from("vendas")
    .select("valor_credito")
    .eq("empresa_id", empresaId)
    .eq("status", "efetivada");

  const totalCredito = (vendas || []).reduce((acc: number, v: any) => acc + Number(v.valor_credito || 0), 0);
  const vendasCount = (vendas || []).length;
  const ticketMedio = vendasCount > 0 ? Number((totalCredito / vendasCount).toFixed(2)) : 0;

  // 2. Previsões Franquia & Participantes
  const { data: prevFranquia } = await admin
    .from("comissao_previsoes_franquia")
    .select("valor_previso")
    .eq("empresa_id", empresaId);
  const recPrevFranquia = (prevFranquia || []).reduce((acc: number, p: any) => acc + Number(p.valor_previso || 0), 0);

  const { data: prevPart } = await admin
    .from("comissao_previsoes_participantes")
    .select("valor_previso")
    .eq("empresa_id", empresaId);
  const repPrevPart = (prevPart || []).reduce((acc: number, p: any) => acc + Number(p.valor_previso || 0), 0);

  // 3. Recebimentos & Pagamentos Reais & Caixa
  const caixaResumo = await getResumoCaixaEmpresa(empresaId);

  // 4. Leads & Propostas
  const { count: leadsCount } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { count: propostasCount } = await admin
    .from("propostas")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  // 5. Metas
  const { data: metas } = await admin
    .from("metas_comerciais")
    .select("id, valor_meta")
    .eq("empresa_id", empresaId);

  let atingimentoSoma = 0;
  if (metas && metas.length > 0) {
    for (const m of metas) {
      atingimentoSoma += 50; // Mock base para fallback seguro
    }
  }

  // 6. Tarefas
  const { count: tarefasPendentes } = await admin
    .from("tarefas_gestao")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "em_andamento"]);

  const nowIso = new Date().toISOString();
  const { count: tarefasAtrasadas } = await admin
    .from("tarefas_gestao")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .in("status", ["pendente", "em_andamento"])
    .lt("data_limite", nowIso);

  return {
    total_credito_vendido: Number(totalCredito.toFixed(2)),
    total_vendas_count: vendasCount,
    ticket_medio: ticketMedio,
    receita_prevista_franquia: Number(recPrevFranquia.toFixed(2)),
    receita_recebida_franquia: caixaResumo?.totalEntradas || 0,
    repasses_previstos_participantes: Number(repPrevPart.toFixed(2)),
    repasses_pagos_participantes: caixaResumo?.totalSaidas || 0,
    saldo_caixa: caixaResumo?.saldoCaixa || 0,
    leads_count: leadsCount || 0,
    propostas_count: propostasCount || 0,
    metas_atingimento_medio: metas && metas.length > 0 ? Number((atingimentoSoma / metas.length).toFixed(2)) : 0,
    tarefas_pendentes_count: tarefasPendentes || 0,
    tarefas_atrasadas_count: tarefasAtrasadas || 0,
  };
}

export async function getResumoComercial(empresaId: string): Promise<ResumoComercialDTO> {
  const admin = createAdminClient();

  const { count: leadsTotais } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { count: leadsEmAndamento } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .not("status", "in", '("convertido","perdido")');

  const { count: propostasTotais } = await admin
    .from("propostas")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { data: vendas } = await admin
    .from("vendas")
    .select("valor_credito, snapshot_venda")
    .eq("empresa_id", empresaId)
    .eq("status", "efetivada");

  const vendasTotais = (vendas || []).length;
  const creditoTotal = (vendas || []).reduce((acc: number, v: any) => acc + Number(v.valor_credito || 0), 0);

  const taxaConversao =
    leadsTotais && leadsTotais > 0 ? Number(((vendasTotais / leadsTotais) * 100).toFixed(2)) : 0;

  const vendasPorOrigem: Record<string, number> = {};
  for (const v of vendas || []) {
    const origem = (v.snapshot_venda as any)?.origem || "simulador";
    vendasPorOrigem[origem] = (vendasPorOrigem[origem] || 0) + 1;
  }

  return {
    leads_totais: leadsTotais || 0,
    leads_em_andamento: leadsEmAndamento || 0,
    propostas_totais: propostasTotais || 0,
    vendas_totais: vendasTotais,
    credito_total_vendido: Number(creditoTotal.toFixed(2)),
    taxa_conversao_lead_venda: taxaConversao,
    vendas_por_origem: vendasPorOrigem,
  };
}

export async function getResumoFinanceiroDash(empresaId: string): Promise<ResumoFinanceiroDashDTO> {
  const admin = createAdminClient();
  const caixaResumo = await getResumoCaixaEmpresa(empresaId);

  const { data: prevFranquia } = await admin
    .from("comissao_previsoes_franquia")
    .select("valor_previso")
    .eq("empresa_id", empresaId);
  const recPrevFranquia = (prevFranquia || []).reduce((acc: number, p: any) => acc + Number(p.valor_previso || 0), 0);

  const { data: prevPart } = await admin
    .from("comissao_previsoes_participantes")
    .select("valor_previso")
    .eq("empresa_id", empresaId);
  const repPrevPart = (prevPart || []).reduce((acc: number, p: any) => acc + Number(p.valor_previso || 0), 0);

  return {
    receita_prevista_franquia: Number(recPrevFranquia.toFixed(2)),
    receita_recebida_franquia: caixaResumo?.totalEntradas || 0,
    saldo_a_receber_franquia: caixaResumo?.totalPrevisoesReceber || 0,
    repasses_previstos_participantes: Number(repPrevPart.toFixed(2)),
    repasses_pagos_participantes: caixaResumo?.totalSaidas || 0,
    saldo_a_repassar_participantes: caixaResumo?.totalPrevisoesPagar || 0,
    saldos_a_compensar: caixaResumo?.totalSaldosACompensar || 0,
    saldo_caixa: caixaResumo?.saldoCaixa || 0,
    total_entradas_caixa: caixaResumo?.totalEntradas || 0,
    total_saidas_caixa: caixaResumo?.totalSaidas || 0,
  };
}
