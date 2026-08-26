import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResumoCaixaEmpresa } from "@/lib/financeiro/financeiro-service";
import { calcularApuracaoMeta } from "@/lib/gestao/metas-service";

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
    .eq("status", "confirmada")
    .eq("afeta_faturamento", true);

  const totalCredito = (vendas || []).reduce((acc: number, v: any) => acc + Number(v.valor_credito || 0), 0);
  const vendasCount = (vendas || []).length;
  const ticketMedio = vendasCount > 0 ? Number((totalCredito / vendasCount).toFixed(2)) : 0;

  // 2. Previsões Franquia & Participantes
  const { data: prevFranquia } = await admin
    .from("comissao_previsoes_franquia")
    .select("valor_previsto")
    .eq("empresa_id", empresaId);
  const recPrevFranquia = (prevFranquia || []).reduce((acc: number, p: any) => acc + Number(p.valor_previsto || 0), 0);

  const { data: prevPart } = await admin
    .from("comissao_previsoes_participantes")
    .select("valor_previsto")
    .eq("empresa_id", empresaId);
  const repPrevPart = (prevPart || []).reduce((acc: number, p: any) => acc + Number(p.valor_previsto || 0), 0);

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

  const apuracoes = await Promise.all(
    (metas || []).map((meta) => calcularApuracaoMeta(empresaId, meta.id)),
  );
  const atingimentoSoma = apuracoes.reduce(
    (total, apuracao) => total + apuracao.percentual_atingimento,
    0,
  );

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
    .eq("status", "confirmada")
    .eq("afeta_faturamento", true);

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
    .select("valor_previsto")
    .eq("empresa_id", empresaId);
  const recPrevFranquia = (prevFranquia || []).reduce((acc: number, p: any) => acc + Number(p.valor_previsto || 0), 0);

  const { data: prevPart } = await admin
    .from("comissao_previsoes_participantes")
    .select("valor_previsto")
    .eq("empresa_id", empresaId);
  const repPrevPart = (prevPart || []).reduce((acc: number, p: any) => acc + Number(p.valor_previsto || 0), 0);

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

export type ErpDashboardPeriodFilter =
  | "mes_atual"
  | "mes_anterior"
  | "ultimos_3_meses"
  | "ultimos_6_meses"
  | "ultimos_12_meses"
  | "personalizado";

export type ErpDashboardFiltros = {
  periodo?: ErpDashboardPeriodFilter;
  mesCompetencia?: string;
  dataInicio?: string;
  dataFim?: string;
  administradoraId?: string;
  tipoSegmento?: string;
  usuarioId?: string;
};

export type ErpDashboardCardVendas = {
  creditoVendidoMes: number;
  cotasVendidasMes: number;
  ticketMedio: number;
  creditoMesAnterior: number;
  cotasMesAnterior: number;
  variacaoCreditoPercentual: number | null;
  variacaoCotasPercentual: number | null;
  historicoMensal: Array<{
    mes: string;
    label: string;
    credito: number;
    cotas: number;
  }>;
};

export type ErpDashboardCardComissaoFranquia = {
  gerada: number;
  previstaElegivel: number;
  recebida: number;
  pendente: number;
  historicoMensal: Array<{
    mes: string;
    label: string;
    gerada: number;
    recebida: number;
  }>;
};

export type ErpDashboardCardComissaoParticipantes = {
  gerada: number;
  disponivelElegivel: number;
  paga: number;
  pendente: number;
  participantesComPendenciaCount: number;
};

export type ErpDashboardCardCaixaFinanceiro = {
  saldoDisponivel: number;
  entradasMes: number;
  saidasMes: number;
  contasPagarVencidas: number;
  contasPagarMes: number;
  contasPagarCount: number;
};

export type ErpDashboardCardComercial = {
  leadsNovos: number;
  leadsSemContato: number;
  propostasEmAndamento: number;
  contratosAguardandoAssinatura: number;
  contratosAssinadosFormalizacao: number;
};

export type ErpDashboardCardClientesCotas = {
  clientesAtivos: number;
  clientesNovosMes: number;
  cotasAtivas: number;
  cotasContempladas: number;
  cotasAguardandoNumero: number;
};

export type ErpDashboardCardMetas = {
  disponivel: boolean;
  metaCredito: number;
  creditoRealizado: number;
  atingimentoPercentual: number;
  metaComissao?: number;
  comissaoRealizada?: number;
};

export type ErpDashboardAlertaItem = {
  id: string;
  prioridade: "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  quantidade: number;
  href: string;
  moduloId: string;
};

export type ErpDashboardProximaAssembleia = {
  grupoId: string;
  codigoGrupo: string;
  administradoraNome: string;
  dataAssembleia: string;
  vagasDisponiveis: number;
};

export type ErpDashboardFullDTO = {
  empresa: {
    id: string;
    nomeFantasia: string;
    cnpj?: string | null;
    planoNome?: string;
  };
  modulosLiberados: string[];
  periodo: {
    filtro: ErpDashboardPeriodFilter;
    mesAtual: string;
    dataInicio: string;
    dataFim: string;
  };
  vendas: ErpDashboardCardVendas;
  comissaoFranquia: ErpDashboardCardComissaoFranquia;
  comissaoParticipantes: ErpDashboardCardComissaoParticipantes;
  caixa: ErpDashboardCardCaixaFinanceiro;
  comercial: ErpDashboardCardComercial;
  clientesCotas: ErpDashboardCardClientesCotas;
  metas?: ErpDashboardCardMetas;
  alertas: ErpDashboardAlertaItem[];
  proximasAssembleias: ErpDashboardProximaAssembleia[];
  administradorasDisponiveis: Array<{ id: string; nome: string }>;
};

function formatMesLabel(mesIso: string): string {
  const [ano, mes] = mesIso.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mIndex = parseInt(mes, 10) - 1;
  return `${meses[mIndex] || mes}/${ano?.slice(2) || ""}`;
}

export async function getErpDashboardCompleto(
  empresaId: string,
  filtros: ErpDashboardFiltros = {},
): Promise<ErpDashboardFullDTO> {
  const admin = createAdminClient();
  const now = new Date();

  const filtroPeriodo = filtros.periodo || "mes_atual";
  const anoAtual = now.getFullYear();
  const mesAtualNum = now.getMonth() + 1;
  const mesAtualIso = `${anoAtual}-${String(mesAtualNum).padStart(2, "0")}`;

  // Cálculo de datas
  let dataInicioIso: string;
  let dataFimIso: string;

  if (filtroPeriodo === "mes_anterior") {
    const prevMonth = new Date(anoAtual, mesAtualNum - 2, 1);
    const lastDayPrev = new Date(anoAtual, mesAtualNum - 1, 0);
    dataInicioIso = prevMonth.toISOString().slice(0, 10);
    dataFimIso = lastDayPrev.toISOString().slice(0, 10);
  } else if (filtroPeriodo === "ultimos_3_meses") {
    const start = new Date(anoAtual, mesAtualNum - 3, 1);
    dataInicioIso = start.toISOString().slice(0, 10);
    dataFimIso = now.toISOString().slice(0, 10);
  } else if (filtroPeriodo === "ultimos_6_meses") {
    const start = new Date(anoAtual, mesAtualNum - 6, 1);
    dataInicioIso = start.toISOString().slice(0, 10);
    dataFimIso = now.toISOString().slice(0, 10);
  } else if (filtroPeriodo === "ultimos_12_meses") {
    const start = new Date(anoAtual, mesAtualNum - 12, 1);
    dataInicioIso = start.toISOString().slice(0, 10);
    dataFimIso = now.toISOString().slice(0, 10);
  } else if (filtroPeriodo === "personalizado" && filtros.dataInicio && filtros.dataFim) {
    dataInicioIso = filtros.dataInicio;
    dataFimIso = filtros.dataFim;
  } else {
    // Mês Atual
    const firstDay = new Date(anoAtual, mesAtualNum - 1, 1);
    const lastDay = new Date(anoAtual, mesAtualNum, 0);
    dataInicioIso = firstDay.toISOString().slice(0, 10);
    dataFimIso = lastDay.toISOString().slice(0, 10);
  }

  // Mês anterior de referência para cálculo MoM
  const prevMonthDate = new Date(anoAtual, mesAtualNum - 2, 1);
  const prevMonthIso = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // 1. Dados da Empresa e Configurações
  const [empresaRes, administradorasRes] = await Promise.all([
    admin
      .from("empresas")
      .select("id, nome_fantasia, cnpj, configuracoes, status")
      .eq("id", empresaId)
      .single(),
    admin
      .from("administradoras")
      .select("id, nome")
      .eq("status", "ATIVA")
      .order("nome"),
  ]);

  const empresaData = empresaRes.data;
  const modulosLiberados: string[] =
    (empresaData?.configuracoes as any)?.erp_sistema?.modulos || [
      "clientes",
      "consultores",
      "lances",
      "assembleias",
      "regras-comissao",
      "repasse-franquia",
      "minhas-comissoes",
      "contas-pagar",
      "metas",
    ];

  // 2. Vendas do Período + Histórico (Multi-tenant scoped)
  let vendasQuery = admin
    .from("vendas")
    .select("id, valor_credito, created_at, mes_competencia, administradora_id, status")
    .eq("empresa_id", empresaId)
    .eq("status", "confirmada")
    .eq("afeta_faturamento", true);

  if (filtros.administradoraId) {
    vendasQuery = vendasQuery.eq("administradora_id", filtros.administradoraId);
  }

  const { data: todasVendas } = await vendasQuery;

  // Filtragem em memória para eficiência
  const vendasMesAtual = (todasVendas || []).filter((v) => {
    const comp = v.mes_competencia || (v.created_at ? v.created_at.slice(0, 7) : "");
    return comp === mesAtualIso;
  });

  const vendasMesAnterior = (todasVendas || []).filter((v) => {
    const comp = v.mes_competencia || (v.created_at ? v.created_at.slice(0, 7) : "");
    return comp === prevMonthIso;
  });

  const creditoMesAtual = vendasMesAtual.reduce((acc, v) => acc + Number(v.valor_credito || 0), 0);
  const cotasMesAtual = vendasMesAtual.length;
  const ticketMedio = cotasMesAtual > 0 ? Number((creditoMesAtual / cotasMesAtual).toFixed(2)) : 0;

  const creditoMesAnterior = vendasMesAnterior.reduce((acc, v) => acc + Number(v.valor_credito || 0), 0);
  const cotasMesAnterior = vendasMesAnterior.length;

  const variacaoCredito =
    creditoMesAnterior > 0
      ? Number((((creditoMesAtual - creditoMesAnterior) / creditoMesAnterior) * 100).toFixed(1))
      : null;

  const variacaoCotas =
    cotasMesAnterior > 0
      ? Number((((cotasMesAtual - cotasMesAnterior) / cotasMesAnterior) * 100).toFixed(1))
      : null;

  // Histórico últimos 6 meses para gráficos
  const historicoVendas: Array<{ mes: string; label: string; credito: number; cotas: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoAtual, mesAtualNum - 1 - i, 1);
    const mIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const vMes = (todasVendas || []).filter((v) => {
      const comp = v.mes_competencia || (v.created_at ? v.created_at.slice(0, 7) : "");
      return comp === mIso;
    });
    const cTotal = vMes.reduce((acc, v) => acc + Number(v.valor_credito || 0), 0);
    historicoVendas.push({
      mes: mIso,
      label: formatMesLabel(mIso),
      credito: Number(cTotal.toFixed(2)),
      cotas: vMes.length,
    });
  }

  // 3. Comissões da Franquia & Participantes
  const [prevFranquiaRes, prevPartRes, caixaResumo, contasPagarRes] = await Promise.all([
    admin
      .from("comissao_previsoes_franquia")
      .select("id, valor_previsto, valor_liquidado, status, competencia, created_at")
      .eq("empresa_id", empresaId),
    admin
      .from("comissao_previsoes_participantes")
      .select("id, participante_comercial_id, valor_previsto, valor_liquidado, status, competencia, created_at")
      .eq("empresa_id", empresaId),
    getResumoCaixaEmpresa(empresaId),
    admin
      .from("financeiro_contas_pagar")
      .select("id, valor, status, data_vencimento")
      .eq("empresa_id", empresaId),
  ]);

  const previsoesFranquia = prevFranquiaRes.data || [];
  const comissaoFranquiaGerada = previsoesFranquia.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0);
  const comissaoFranquiaRecebida = previsoesFranquia.reduce((acc, p) => acc + Number(p.valor_liquidado || 0), 0);
  const comissaoFranquiaPendente = Math.max(0, comissaoFranquiaGerada - comissaoFranquiaRecebida);

  const historicoComissao: Array<{ mes: string; label: string; gerada: number; recebida: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoAtual, mesAtualNum - 1 - i, 1);
    const mIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const pMes = previsoesFranquia.filter((p) => {
      const comp = p.competencia || (p.created_at ? p.created_at.slice(0, 7) : "");
      return comp === mIso;
    });
    const gTotal = pMes.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0);
    const rTotal = pMes.reduce((acc, p) => acc + Number(p.valor_liquidado || 0), 0);
    historicoComissao.push({
      mes: mIso,
      label: formatMesLabel(mIso),
      gerada: Number(gTotal.toFixed(2)),
      recebida: Number(rTotal.toFixed(2)),
    });
  }

  const previsoesPart = prevPartRes.data || [];
  const comissaoPartGerada = previsoesPart.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0);
  const comissaoPartPaga = previsoesPart.reduce((acc, p) => acc + Number(p.valor_liquidado || 0), 0);
  const comissaoPartPendente = Math.max(0, comissaoPartGerada - comissaoPartPaga);

  // Contagem de participantes distintos com pendência
  const participantesComPendencia = new Set(
    previsoesPart
      .filter((p) => Number(p.valor_previsto || 0) > Number(p.valor_liquidado || 0))
      .map((p) => p.participante_comercial_id)
      .filter(Boolean),
  );

  // 4. Financeiro & Contas a Pagar
  const hojeIso = now.toISOString().slice(0, 10);
  const contasPagar = contasPagarRes.data || [];
  const contasPagarAbertas = contasPagar.filter((c) => c.status === "aberto" || c.status === "pendente");
  const contasPagarVencidas = contasPagarAbertas.filter((c) => c.data_vencimento && c.data_vencimento < hojeIso);
  const totalContasPagarVencidas = contasPagarVencidas.reduce((acc, c) => acc + Number(c.valor || 0), 0);
  const totalContasPagarMes = contasPagarAbertas.reduce((acc, c) => acc + Number(c.valor || 0), 0);

  // 5. Comercial & CRM
  const [leadsRes, propostasRes, contratacoesRes, clientesRes, gruposRes, metasRes] = await Promise.all([
    admin
      .from("leads")
      .select("id, status, created_at")
      .eq("empresa_id", empresaId),
    admin
      .from("propostas")
      .select("id, status, valor_credito, created_at")
      .eq("empresa_id", empresaId),
    admin
      .from("contratacoes_online")
      .select("id, status, formalizacao_status, created_at")
      .eq("empresa_id", empresaId),
    admin
      .from("clientes")
      .select("id, created_at, status")
      .eq("empresa_id", empresaId),
    admin
      .from("grupos_consorcio")
      .select("id, codigo_grupo, data_proxima_assembleia, vagas_disponiveis, administradora_id")
      .eq("empresa_id", empresaId)
      .order("data_proxima_assembleia", { ascending: true })
      .limit(10),
    admin
      .from("metas_comerciais")
      .select("id, valor_meta, tipo_meta")
      .eq("empresa_id", empresaId)
      .limit(1),
  ]);

  const leads = leadsRes.data || [];
  const leadsNovos = leads.filter((l) => l.created_at && l.created_at >= dataInicioIso).length;
  const leadsSemContato = leads.filter((l) => l.status === "novo" || l.status === "sem_contato").length;

  const propostas = propostasRes.data || [];
  const propostasEmAndamento = propostas.filter(
    (p) => p.status === "rascunho" || p.status === "enviada" || p.status === "em_analise",
  ).length;

  const contratacoes = contratacoesRes.data || [];
  const contratosAguardandoAssinatura = contratacoes.filter(
    (c) => c.status === "iniciada" || c.status === "documentos_enviados" || c.status === "aguardando_assinatura",
  ).length;
  const contratosAssinadosFormalizacao = contratacoes.filter(
    (c) => c.status === "assinada" && (c.formalizacao_status === "pendente" || !c.formalizacao_status),
  ).length;

  // 6. Clientes & Cotas
  const clientes = clientesRes.data || [];
  const clientesAtivos = clientes.length;
  const clientesNovosMes = clientes.filter((c) => c.created_at && c.created_at >= dataInicioIso).length;
  const cotasAtivas = (todasVendas || []).length;
  const cotasContempladas = 0; // Contemplações canônicas registradas
  const cotasAguardandoNumero = contratosAssinadosFormalizacao;

  // 7. Metas Comerciais
  let metasData: ErpDashboardCardMetas | undefined = undefined;
  if (modulosLiberados.includes("metas")) {
    const metaObj = metasRes.data?.[0];
    const metaCredito = Number(metaObj?.valor_meta || 1000000);
    const atingimento = metaCredito > 0 ? Number(((creditoMesAtual / metaCredito) * 100).toFixed(1)) : 0;
    metasData = {
      disponivel: true,
      metaCredito,
      creditoRealizado: Number(creditoMesAtual.toFixed(2)),
      atingimentoPercentual: atingimento,
    };
  }

  // 8. Alertas Operacionais Reais
  const alertas: ErpDashboardAlertaItem[] = [];

  if (contratosAssinadosFormalizacao > 0) {
    alertas.push({
      id: "alerta-formalizacao",
      prioridade: "alta",
      titulo: "Contratos assinados aguardando formalização",
      descricao: `${contratosAssinadosFormalizacao} contrato(s) assinado(s) pendente(s) de finalização no ERP.`,
      quantidade: contratosAssinadosFormalizacao,
      href: "/erp/contratacoes",
      moduloId: "contratacoes",
    });
  }

  if (contasPagarVencidas.length > 0) {
    alertas.push({
      id: "alerta-contas-vencidas",
      prioridade: "alta",
      titulo: "Contas a pagar vencidas",
      descricao: `${contasPagarVencidas.length} conta(s) vencida(s) totalizando R$ ${totalContasPagarVencidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      quantidade: contasPagarVencidas.length,
      href: "/erp/contas-pagar",
      moduloId: "contas-pagar",
    });
  }

  if (comissaoFranquiaPendente > 0) {
    alertas.push({
      id: "alerta-comissao-pendente",
      prioridade: "media",
      titulo: "Comissões da Franquia com recebimento pendente",
      descricao: `R$ ${comissaoFranquiaPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pendentes de liquidação da Administradora.`,
      quantidade: 1,
      href: "/erp/repasse-franquia",
      moduloId: "repasse-franquia",
    });
  }

  if (comissaoPartPendente > 0 && participantesComPendencia.size > 0) {
    alertas.push({
      id: "alerta-repasse-participantes",
      prioridade: "media",
      titulo: "Repasses de comissão pendentes aos participantes",
      descricao: `${participantesComPendencia.size} participante(s) com repasse a pagar (R$ ${comissaoPartPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
      quantidade: participantesComPendencia.size,
      href: "/erp/minhas-comissoes",
      moduloId: "minhas-comissoes",
    });
  }

  if (leadsSemContato > 5) {
    alertas.push({
      id: "alerta-leads-sem-contato",
      prioridade: "baixa",
      titulo: "Leads aguardando primeiro contato",
      descricao: `${leadsSemContato} leads no funil ainda sem atendimento.`,
      quantidade: leadsSemContato,
      href: "/admin/leads",
      moduloId: "leads",
    });
  }

  // 9. Próximas Assembleias
  const grupos = gruposRes.data || [];
  const proximasAssembleias: ErpDashboardProximaAssembleia[] = grupos
    .filter((g) => g.data_proxima_assembleia && g.data_proxima_assembleia >= hojeIso)
    .map((g) => {
      const adm = administradorasRes.data?.find((a) => a.id === g.administradora_id);
      return {
        grupoId: g.id,
        codigoGrupo: g.codigo_grupo,
        administradoraNome: adm?.nome || "Administradora",
        dataAssembleia: g.data_proxima_assembleia,
        vagasDisponiveis: g.vagas_disponiveis || 0,
      };
    });

  return {
    empresa: {
      id: empresaId,
      nomeFantasia: empresaData?.nome_fantasia || "Master Franquia",
      cnpj: empresaData?.cnpj,
      planoNome: (empresaData?.configuracoes as any)?.plano_nome || "Plano Profissional ERP",
    },
    modulosLiberados,
    periodo: {
      filtro: filtroPeriodo,
      mesAtual: mesAtualIso,
      dataInicio: dataInicioIso,
      dataFim: dataFimIso,
    },
    vendas: {
      creditoVendidoMes: Number(creditoMesAtual.toFixed(2)),
      cotasVendidasMes: cotasMesAtual,
      ticketMedio,
      creditoMesAnterior: Number(creditoMesAnterior.toFixed(2)),
      cotasMesAnterior,
      variacaoCreditoPercentual: variacaoCredito,
      variacaoCotasPercentual: variacaoCotas,
      historicoMensal: historicoVendas,
    },
    comissaoFranquia: {
      gerada: Number(comissaoFranquiaGerada.toFixed(2)),
      previstaElegivel: Number(comissaoFranquiaGerada.toFixed(2)),
      recebida: Number(comissaoFranquiaRecebida.toFixed(2)),
      pendente: Number(comissaoFranquiaPendente.toFixed(2)),
      historicoMensal: historicoComissao,
    },
    comissaoParticipantes: {
      gerada: Number(comissaoPartGerada.toFixed(2)),
      disponivelElegivel: Number(comissaoPartGerada.toFixed(2)),
      paga: Number(comissaoPartPaga.toFixed(2)),
      pendente: Number(comissaoPartPendente.toFixed(2)),
      participantesComPendenciaCount: participantesComPendencia.size,
    },
    caixa: {
      saldoDisponivel: Number((caixaResumo?.saldoCaixa || 0).toFixed(2)),
      entradasMes: Number((caixaResumo?.totalEntradas || 0).toFixed(2)),
      saidasMes: Number((caixaResumo?.totalSaidas || 0).toFixed(2)),
      contasPagarVencidas: Number(totalContasPagarVencidas.toFixed(2)),
      contasPagarMes: Number(totalContasPagarMes.toFixed(2)),
      contasPagarCount: contasPagarAbertas.length,
    },
    comercial: {
      leadsNovos,
      leadsSemContato,
      propostasEmAndamento,
      contratosAguardandoAssinatura,
      contratosAssinadosFormalizacao,
    },
    clientesCotas: {
      clientesAtivos,
      clientesNovosMes,
      cotasAtivas,
      cotasContempladas,
      cotasAguardandoNumero,
    },
    metas: metasData,
    alertas,
    proximasAssembleias,
    administradorasDisponiveis: administradorasRes.data || [],
  };
}

