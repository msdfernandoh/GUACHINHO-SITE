import { createClient } from "@/lib/supabase/server";
import { CRM_12_ETAPAS, CRM_MACRO_TIERS, mapLegacyStatusToEtapaSlug } from "./constants";
import type { CrmFunilEtapaRow } from "./types";
import { fetchCrmFunilEtapas } from "./leads-query";

export type CrmDashboardKpis = {
  leadsNoMes: number;
  leadsNovosHoje: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  oportunidadesNegociacaoValor: number;
  vendasFechadasMesValor: number;
  taxaConversao: number;
  metaMensalAtingida: number;
};

export type CrmFunilEtapaStats = {
  id: string;
  slug: string;
  nome: string;
  ordem: number;
  cor: string;
  totalLeads: number;
  valorTotal: number;
  valorParcelaTotal: number;
  percentual: number;
};

export type CrmFunilMacroTier = {
  id: string;
  slug: string;
  nivelNumero: number;
  fase: "topo" | "meio_sup" | "meio_inf" | "fundo";
  nomeNivel: string;
  categoria: string;
  subtitulo: string;
  conceito: string;
  corHex: string;
  corGradiente: string;
  icone: "eye" | "mail" | "magnet" | "handshake";
  totalLeads: number;
  valorCreditoTotal: number;
  valorParcelaTotal: number;
  percentualTotal: number;
  taxaPassagem: number;
  etapasNomes: string[];
  etapasSlugs: readonly string[];
};

export type CrmDashboardTotais = {
  totalLeads: number;
  totalCredito: number;
  totalParcelaMensal: number;
  ticketMedioCredito: number;
  ticketMedioParcela: number;
  leadsPerdidos: number;
  creditoPerdido: number;
  parcelaPerdida: number;
  leadsStandby: number;
  creditoStandby: number;
};

export type CrmAlertasOperacionais = {
  leadsSemResponsavel: number;
  leadsSemContato24h: number;
  reunioesHoje: number;
  reunioesAtrasadas: number;
  leadsParados7d: number;
  leadsQuentesUrgentes: number;
};

export type CrmConsultorPerformance = {
  id: string;
  nome: string;
  totalLeads: number;
  reunioesRealizadas: number;
  vendasFechadas: number;
  valorFechado: number;
  taxaConversao: number;
  tempoMedioPrimeiroContatoHoras?: number;
};

export type CrmDashboardData = {
  kpis: CrmDashboardKpis;
  funil: CrmFunilEtapaStats[];
  macroFunil: CrmFunilMacroTier[];
  totaisGerais: CrmDashboardTotais;
  alertas: CrmAlertasOperacionais;
  etapas: CrmFunilEtapaRow[];
  performance: CrmConsultorPerformance[];
};

export function extrairValorParcelaLead(lead: {
  valor_fechado?: number | null;
  valor_parcela_fechamento?: number | null;
  valor_estimado?: number | null;
  valor_simulado?: number | null;
  prazo_simulado?: number | null;
  dados_simulacao?: unknown;
}): number {
  if (lead.valor_parcela_fechamento && Number(lead.valor_parcela_fechamento) > 0) {
    return Number(lead.valor_parcela_fechamento);
  }

  if (lead.dados_simulacao && typeof lead.dados_simulacao === "object") {
    const ds = lead.dados_simulacao as Record<string, unknown>;
    const res = ds.resultado as Record<string, unknown> | undefined;
    const p1 = res?.parcela ?? res?.valorParcela ?? res?.parcelaReduzida ?? res?.parcelaIntegral;
    if (p1 && Number(p1) > 0) return Number(p1);

    const p2 = ds.parcela ?? ds.valorParcela ?? ds.valor_parcela;
    if (p2 && Number(p2) > 0) return Number(p2);
  }

  const cred = Number(lead.valor_fechado ?? lead.valor_estimado ?? lead.valor_simulado ?? 0);
  if (cred <= 0) return 0;

  const prazo = Number(lead.prazo_simulado && lead.prazo_simulado > 0 ? lead.prazo_simulado : 160);
  const parcelaEstimada = (cred * 1.18) / prazo;
  return Math.round(parcelaEstimada * 100) / 100;
}

export async function fetchCrmDashboardData(empresaId: string): Promise<CrmDashboardData> {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Buscar etapas da empresa
  const etapas = await fetchCrmFunilEtapas(empresaId);

  // 2. Buscar todos os leads do tenant para agregação segura
  // Para Gauchinho Consórcios (Tenant 1), inclui leads legados com empresa_id nulo
  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, status, etapa_id, valor_estimado, valor_simulado, valor_fechado, valor_parcela_fechamento, prazo_simulado, dados_simulacao, fechado, temperatura, srd_responsavel_id, srd_responsavel_nome, created_at, ultima_interacao_at, data_fechamento, perdido_at",
    );

  if (empresaId === "7170f38e-15dd-4b19-8588-51e9a9cf0d4c") {
    leadsQuery = leadsQuery.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
  } else {
    leadsQuery = leadsQuery.eq("empresa_id", empresaId);
  }

  const { data: leadsRaw } = await leadsQuery;

  const leads = leadsRaw ?? [];

  // 3. Buscar compromissos de agenda do mês para a empresa
  const { data: compromissosRaw } = await supabase
    .from("agenda_compromissos")
    .select("id, consultor_id, status, data_inicio, data_fim")
    .eq("empresa_id", empresaId)
    .gte("data_inicio", startOfMonth);

  const compromissos = compromissosRaw ?? [];

  // Mapear etapas por ID e slug para contagem
  const etapaMap = new Map<string, CrmFunilEtapaStats>();
  for (const e of etapas) {
    etapaMap.set(e.id, {
      id: e.id,
      slug: e.slug,
      nome: e.nome,
      ordem: e.ordem,
      cor: e.cor,
      totalLeads: 0,
      valorTotal: 0,
      valorParcelaTotal: 0,
      percentual: 0,
    });
  }

  // KPIs
  let leadsNoMes = 0;
  let leadsNovosHoje = 0;
  let oportunidadesNegociacaoValor = 0;
  let vendasFechadasMesValor = 0;
  let totalFechados = 0;

  // Alertas
  let leadsSemResponsavel = 0;
  let leadsSemContato24h = 0;
  let leadsParados7d = 0;
  let leadsQuentesUrgentes = 0;

  // Performance por responsável
  const consultoresMap = new Map<string, { nome: string; totalLeads: number; vendasFechadas: number; valorFechado: number }>();

  for (const l of leads) {
    const val = Number(l.valor_estimado ?? l.valor_simulado ?? 0);
    const parcela = extrairValorParcelaLead(l);
    const createdAtIso = l.created_at;
    const isThisMonth = createdAtIso >= startOfMonth;
    const isToday = createdAtIso?.slice(0, 10) === todayStr;

    if (isThisMonth) leadsNoMes++;
    if (isToday) leadsNovosHoje++;

    // Responsável tracking
    if (l.srd_responsavel_id && l.srd_responsavel_nome) {
      if (!consultoresMap.has(l.srd_responsavel_id)) {
        consultoresMap.set(l.srd_responsavel_id, {
          nome: l.srd_responsavel_nome,
          totalLeads: 0,
          vendasFechadas: 0,
          valorFechado: 0,
        });
      }
      const c = consultoresMap.get(l.srd_responsavel_id)!;
      c.totalLeads++;
      if (l.fechado) {
        c.vendasFechadas++;
        c.valorFechado += Number(l.valor_fechado ?? val);
      }
    } else {
      leadsSemResponsavel++;
    }

    // Alertas de contato
    const ultimaInteracao = l.ultima_interacao_at ?? createdAtIso;
    if (!l.fechado && !l.perdido_at) {
      if (ultimaInteracao < yesterdayIso) leadsSemContato24h++;
      if (ultimaInteracao < sevenDaysAgoIso) leadsParados7d++;
    }

    if (l.temperatura === "Quente" || l.temperatura === "Muito quente" || l.temperatura === "Urgente") {
      if (!l.fechado && !l.perdido_at) leadsQuentesUrgentes++;
    }

    // Fechamento e valores
    if (l.fechado) {
      totalFechados++;
      if (l.data_fechamento && l.data_fechamento >= startOfMonth.slice(0, 10)) {
        vendasFechadasMesValor += Number(l.valor_fechado ?? val);
      }
    } else if (!l.perdido_at) {
      oportunidadesNegociacaoValor += val;
    }

    // Etapas aggregation
    let etapaKey = l.etapa_id;
    if (!etapaKey || !etapaMap.has(etapaKey)) {
      // Tenta fallback por slug mapeado, direto ou nome
      const mappedSlug = mapLegacyStatusToEtapaSlug(l.status);
      const found = etapas.find(
        (e) =>
          e.slug === mappedSlug ||
          e.slug === l.status ||
          e.nome.toLowerCase() === (l.status ?? "").toLowerCase(),
      );
      if (found) etapaKey = found.id;
      else if (etapas.length > 0) etapaKey = etapas[0].id;
    }

    if (etapaKey && etapaMap.has(etapaKey)) {
      const st = etapaMap.get(etapaKey)!;
      st.totalLeads++;
      st.valorTotal += val;
      st.valorParcelaTotal += parcela;
    }
  }

  // Reuniões
  let reunioesAgendadas = 0;
  let reunioesRealizadas = 0;
  let reunioesHoje = 0;
  let reunioesAtrasadas = 0;

  for (const c of compromissos) {
    const dInicio = c.data_inicio?.slice(0, 10);
    if (c.status === "realizado") reunioesRealizadas++;
    if (c.status === "agendado") {
      reunioesAgendadas++;
      if (dInicio === todayStr) reunioesHoje++;
      if (c.data_fim && c.data_fim < now.toISOString()) reunioesAtrasadas++;
    }
  }

  // Taxa de conversão
  const taxaConversao = leads.length > 0 ? (totalFechados / leads.length) * 100 : 0;
  const metaMensalFixa = 2000000; // R$ 2M como referência padrão da franquia
  const metaMensalAtingida = metaMensalFixa > 0 ? Math.min(100, (vendasFechadasMesValor / metaMensalFixa) * 100) : 0;

  // Montar array do funil com percentual relativo ao total de leads
  const totalLeadsCount = leads.length;
  const funilStats: CrmFunilEtapaStats[] = Array.from(etapaMap.values())
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => ({
      ...item,
      percentual: totalLeadsCount > 0 ? (item.totalLeads / totalLeadsCount) * 100 : 0,
    }));

  // Montar agrupamento macro dos 4 níveis estratégicos de funil (3D)
  let prevTierLeads = 0;
  const macroFunil: CrmFunilMacroTier[] = CRM_MACRO_TIERS.map((cfg, idx) => {
    const etapasMatched = funilStats.filter((e) =>
      (cfg.etapasSlugs as readonly string[]).includes(e.slug),
    );
    const totalLeads = etapasMatched.reduce((acc, e) => acc + e.totalLeads, 0);
    const valorCreditoTotal = etapasMatched.reduce((acc, e) => acc + e.valorTotal, 0);
    const valorParcelaTotal = etapasMatched.reduce((acc, e) => acc + e.valorParcelaTotal, 0);
    const etapasNomes = etapasMatched.map((e) => e.nome);

    let taxaPassagem = 100;
    if (idx > 0 && prevTierLeads > 0) {
      taxaPassagem = Math.min(100, (totalLeads / prevTierLeads) * 100);
    }
    prevTierLeads = totalLeads;

    return {
      ...cfg,
      totalLeads,
      valorCreditoTotal,
      valorParcelaTotal,
      percentualTotal: totalLeadsCount > 0 ? (totalLeads / totalLeadsCount) * 100 : 0,
      taxaPassagem: Math.round(taxaPassagem * 10) / 10,
      etapasNomes,
    };
  });

  const etapaPerdido = funilStats.find((e) => e.slug === "perdido");
  const etapaStandby = funilStats.find((e) => e.slug === "standby_futuro");

  const totalCreditoGeral = funilStats.reduce((acc, e) => acc + e.valorTotal, 0);
  const totalParcelaGeral = funilStats.reduce((acc, e) => acc + e.valorParcelaTotal, 0);

  const totaisGerais: CrmDashboardTotais = {
    totalLeads: totalLeadsCount,
    totalCredito: totalCreditoGeral,
    totalParcelaMensal: totalParcelaGeral,
    ticketMedioCredito: totalLeadsCount > 0 ? totalCreditoGeral / totalLeadsCount : 0,
    ticketMedioParcela: totalLeadsCount > 0 ? totalParcelaGeral / totalLeadsCount : 0,
    leadsPerdidos: etapaPerdido?.totalLeads ?? 0,
    creditoPerdido: etapaPerdido?.valorTotal ?? 0,
    parcelaPerdida: etapaPerdido?.valorParcelaTotal ?? 0,
    leadsStandby: etapaStandby?.totalLeads ?? 0,
    creditoStandby: etapaStandby?.valorTotal ?? 0,
  };

  // Performance da equipe
  const performance: CrmConsultorPerformance[] = Array.from(consultoresMap.entries()).map(
    ([id, item]) => ({
      id,
      nome: item.nome,
      totalLeads: item.totalLeads,
      reunioesRealizadas: compromissos.filter((comp) => comp.consultor_id === id && comp.status === "realizado").length,
      vendasFechadas: item.vendasFechadas,
      valorFechado: item.valorFechado,
      taxaConversao: item.totalLeads > 0 ? (item.vendasFechadas / item.totalLeads) * 100 : 0,
    }),
  );

  return {
    kpis: {
      leadsNoMes,
      leadsNovosHoje,
      reunioesAgendadas,
      reunioesRealizadas,
      oportunidadesNegociacaoValor,
      vendasFechadasMesValor,
      taxaConversao,
      metaMensalAtingida,
    },
    funil: funilStats,
    macroFunil,
    totaisGerais,
    alertas: {
      leadsSemResponsavel,
      leadsSemContato24h,
      reunioesHoje,
      reunioesAtrasadas,
      leadsParados7d,
      leadsQuentesUrgentes,
    },
    etapas,
    performance,
  };
}
