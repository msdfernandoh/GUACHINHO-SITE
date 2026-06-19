import { createClient } from "@/lib/supabase/server";
import { KANBAN_STATUSES, labelOrigem, valorEstimadoLead } from "./constants";

export type CrmDashboardMetrics = {
  leadsHoje: number;
  leads7d: number;
  leadsMes: number;
  semResponsavel: number;
  followupsVencidos: number;
  proximasAcoesHoje: number;
  valorPotencial: number;
  fechamentosMes: number;
  propostasCount: number;
};

export async function fetchCrmDashboardMetrics(): Promise<CrmDashboardMetrics> {
  const supabase = await createClient();
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const start7 = new Date(now);
  start7.setDate(start7.getDate() - 7);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayIso = startToday.toISOString();

  const [
    hoje,
    d7,
    mes,
    semResp,
    vencidos,
    hojeAcao,
    potencialRows,
    fechadosMes,
    propostas,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayIso),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", start7.toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", startMonth.toISOString()),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("srd_responsavel_id", null)
      .eq("fechado", false)
      .neq("status", "Perdido"),
    supabase
      .from("lead_atividades")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .lt("data_agendada", todayIso),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("data_proxima_acao", todayIso)
      .lt("data_proxima_acao", new Date(startToday.getTime() + 86400000).toISOString()),
    supabase
      .from("leads")
      .select("valor_estimado, valor_simulado, status, fechado")
      .eq("fechado", false)
      .neq("status", "Perdido"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("fechado", true)
      .gte("fechado_at", startMonth.toISOString()),
    supabase
      .from("propostas")
      .select("id", { count: "exact", head: true })
      .in("status", ["Gerada", "Enviada", "Em negociação"]),
  ]);

  const valorPotencial =
    potencialRows.data?.reduce((acc, row) => acc + valorEstimadoLead(row), 0) ?? 0;

  return {
    leadsHoje: hoje.count ?? 0,
    leads7d: d7.count ?? 0,
    leadsMes: mes.count ?? 0,
    semResponsavel: semResp.count ?? 0,
    followupsVencidos: vencidos.count ?? 0,
    proximasAcoesHoje: hojeAcao.count ?? 0,
    valorPotencial,
    fechamentosMes: fechadosMes.count ?? 0,
    propostasCount: propostas.count ?? 0,
  };
}

export type OrigemReportRow = {
  origem: string;
  label: string;
  leads: number;
  qualificados: number;
  propostas: number;
  fechados: number;
  perdidos: number;
  valorPotencial: number;
};

export async function fetchOrigemReport(): Promise<OrigemReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("origem, status, fechado, valor_estimado, valor_simulado");
  const map = new Map<string, OrigemReportRow>();

  for (const row of data ?? []) {
    const key = row.origem ?? "desconhecido";
    let r = map.get(key);
    if (!r) {
      r = {
        origem: key,
        label: labelOrigem(key),
        leads: 0,
        qualificados: 0,
        propostas: 0,
        fechados: 0,
        perdidos: 0,
        valorPotencial: 0,
      };
      map.set(key, r);
    }
    r.leads += 1;
    const st = row.status ?? "";
    if (["Qualificado", "Simulação enviada", "Proposta enviada", "Negociação"].includes(st)) {
      r.qualificados += 1;
    }
    if (st === "Proposta enviada" || st === "Negociação") r.propostas += 1;
    if (row.fechado || st === "Fechado") r.fechados += 1;
    if (st === "Perdido") r.perdidos += 1;
    if (!row.fechado && st !== "Perdido") {
      r.valorPotencial += valorEstimadoLead(row);
    }
  }

  return [...map.values()].sort((a, b) => b.leads - a.leads);
}

export type FunnelReportRow = {
  status: string;
  quantidade: number;
  valorPotencial: number;
};

export async function fetchFunnelReport(): Promise<FunnelReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("status, valor_estimado, valor_simulado, fechado");
  const map = new Map<string, FunnelReportRow>();

  for (const st of KANBAN_STATUSES) {
    map.set(st, { status: st, quantidade: 0, valorPotencial: 0 });
  }

  for (const row of data ?? []) {
    const st = row.status ?? "Novo";
    if (!map.has(st)) map.set(st, { status: st, quantidade: 0, valorPotencial: 0 });
    const r = map.get(st)!;
    r.quantidade += 1;
    if (!row.fechado && st !== "Perdido") r.valorPotencial += valorEstimadoLead(row);
  }

  return [...map.values()];
}

export type ConsultorReportRow = {
  consultorId: string | null;
  consultorNome: string;
  recebidos: number;
  emAtendimento: number;
  propostas: number;
  fechados: number;
  perdidos: number;
  valorFechado: number;
};

export async function fetchConsultorReport(): Promise<ConsultorReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "srd_responsavel_id, srd_responsavel_nome, status, fechado, valor_fechado",
    );

  const map = new Map<string, ConsultorReportRow>();

  for (const row of data ?? []) {
    const id = row.srd_responsavel_id ?? "__sem__";
    const nome = row.srd_responsavel_nome ?? "Sem responsável";
    let r = map.get(id);
    if (!r) {
      r = {
        consultorId: row.srd_responsavel_id,
        consultorNome: nome,
        recebidos: 0,
        emAtendimento: 0,
        propostas: 0,
        fechados: 0,
        perdidos: 0,
        valorFechado: 0,
      };
      map.set(id, r);
    }
    r.recebidos += 1;
    const st = row.status ?? "";
    if (st === "Em atendimento" || st === "Tentativa de contato") r.emAtendimento += 1;
    if (st === "Proposta enviada" || st === "Negociação") r.propostas += 1;
    if (row.fechado || st === "Fechado") {
      r.fechados += 1;
      r.valorFechado += Number(row.valor_fechado) || 0;
    }
    if (st === "Perdido") r.perdidos += 1;
  }

  return [...map.values()].sort((a, b) => b.recebidos - a.recebidos);
}
