import { createClient } from "@/lib/supabase/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import {
  filterLeadsByScope,
  loadLeadAccessScope,
} from "@/lib/crm/lead-access";
import type { LeadListRow } from "@/lib/crm/types";

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
  const usuario = await getUsuarioNegocio();
  const srdId = usuario?.leads_apenas_proprios ? usuario.id : null;

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
    (() => {
      let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "Novo");
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("fechado", false)
        .neq("status", "Novo")
        .neq("status", "Perdido")
        .neq("status", "Arquivado");
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .not("proximo_retorno_data", "is", null)
        .gte("proximo_retorno_data", today)
        .eq("fechado", false);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("fechado", true);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase.from("leads").select("valor_fechado").eq("fechado", true);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
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

async function applyLeadListScope<
  T extends { srd_responsavel_id?: string | null; evento_id?: string | null },
>(rows: T[]): Promise<T[]> {
  const usuario = await getUsuarioNegocio();
  if (!usuario) return [];
  if (!usuario.leads_apenas_proprios) return rows;
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  return filterLeadsByScope(rows as unknown as LeadListRow[], scope) as unknown as T[];
}

export async function fetchUltimosLeads(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, created_at, nome, whatsapp, origem, tipo_interesse, srd_responsavel_id, srd_responsavel_nome, status, proximo_retorno_data, proximo_retorno_hora, evento_id",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 5, 50));
  const filtered = await applyLeadListScope(data ?? []);
  return filtered.slice(0, limit);
}

export async function fetchLeadsRetornoAgendado(limit = 10) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("leads")
    .select(
      "id, proximo_retorno_data, proximo_retorno_hora, nome, whatsapp, tipo_interesse, srd_responsavel_id, srd_responsavel_nome, status, evento_id",
    )
    .not("proximo_retorno_data", "is", null)
    .gte("proximo_retorno_data", today)
    .eq("fechado", false)
    .order("proximo_retorno_data", { ascending: true })
    .limit(Math.max(limit * 5, 50));
  const filtered = await applyLeadListScope(data ?? []);
  return filtered.slice(0, limit);
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
