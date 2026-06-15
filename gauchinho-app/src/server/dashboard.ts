import { createClient } from "@/lib/supabase/server";

export type DashboardStats = {
  leadsNovos: number;
  leadsEmAtendimento: number;
  leadsRetornoAgendado: number;
  leadsFechados: number;
  valorTotalFechado: number;
  propostasGeradas: number;
  gruposAtivos: number;
  cotasDisponiveis: number;
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    leadsNovos,
    leadsEmAtendimento,
    leadsRetorno,
    leadsFechados,
    valorFechado,
    propostas,
    grupos,
    cotas,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "Novo"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("fechado", false)
      .neq("status", "Novo")
      .neq("status", "Perdido")
      .neq("status", "Arquivado"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("proximo_retorno_data", "is", null)
      .gte("proximo_retorno_data", today)
      .eq("fechado", false),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("fechado", true),
    supabase.from("leads").select("valor_fechado").eq("fechado", true),
    supabase
      .from("propostas")
      .select("id", { count: "exact", head: true })
      .in("status", ["Gerada", "Enviada", "Em negociação"]),
    supabase
      .from("grupos_consorcio")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase
      .from("grupos_cotas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["Disponível", "Últimas"]),
  ]);

  const valorTotal =
    valorFechado.data?.reduce(
      (acc, row) => acc + (Number(row.valor_fechado) || 0),
      0,
    ) ?? 0;

  return {
    leadsNovos: leadsNovos.count ?? 0,
    leadsEmAtendimento: leadsEmAtendimento.count ?? 0,
    leadsRetornoAgendado: leadsRetorno.count ?? 0,
    leadsFechados: leadsFechados.count ?? 0,
    valorTotalFechado: valorTotal,
    propostasGeradas: propostas.count ?? 0,
    gruposAtivos: grupos.count ?? 0,
    cotasDisponiveis: cotas.count ?? 0,
  };
}

export async function fetchUltimosLeads(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, created_at, nome, whatsapp, origem, tipo_interesse, srd_responsavel_nome, status, proximo_retorno_data, proximo_retorno_hora",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchLeadsRetornoAgendado(limit = 10) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("leads")
    .select(
      "id, proximo_retorno_data, proximo_retorno_hora, nome, whatsapp, tipo_interesse, srd_responsavel_nome, status",
    )
    .not("proximo_retorno_data", "is", null)
    .gte("proximo_retorno_data", today)
    .eq("fechado", false)
    .order("proximo_retorno_data", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function fetchUltimasPropostas(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas")
    .select(
      "id, created_at, nome_cliente, tipo_proposta, valor_credito, consultor_nome, status",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
