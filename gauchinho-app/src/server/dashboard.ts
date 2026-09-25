import { createClient } from "@/lib/supabase/server";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
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
  const { empresaAtiva, usuario } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const srdId = usuario?.leads_apenas_proprios ? usuario.id : null;
  const empresaId = empresaAtiva.id;
  const isGauchinho = empresaAtiva.slug === GAUCHINHO_SLUG;
  const gruposAutorizados = await listGruposAutorizadosForEmpresa(empresaId, { incluirInativos: true });
  const gruposAtivosIds = gruposAutorizados
    .filter((grupo) => grupo.ativo && grupo.status !== "Inativo")
    .map((grupo) => grupo.id);

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
      q = isGauchinho ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.eq("empresa_id", empresaId);
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
      q = isGauchinho ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.eq("empresa_id", empresaId);
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
      q = isGauchinho ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.eq("empresa_id", empresaId);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("fechado", true);
      q = isGauchinho ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.eq("empresa_id", empresaId);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (() => {
      let q = supabase.from("leads").select("valor_fechado").eq("fechado", true);
      q = isGauchinho ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.eq("empresa_id", empresaId);
      if (srdId) q = q.eq("srd_responsavel_id", srdId);
      return q;
    })(),
    (isGauchinho
      ? supabase.from("propostas").select("id", { count: "exact", head: true })
        .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      : supabase.from("propostas").select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId))
      .in("status", ["Gerada", "Enviada", "Em negociação"]),
    Promise.resolve({ count: gruposAtivosIds.length }),
    gruposAtivosIds.length ? supabase
      .from("grupos_cotas")
      .select("id", { count: "exact", head: true })
      .in("grupo_id", gruposAtivosIds)
      .eq("ativo", true)
      .in("status", ["Disponível", "Últimas"]) : Promise.resolve({ count: 0 }),
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
  const { usuario } = await requireCurrentTenantContext();
  if (!usuario.leads_apenas_proprios) return rows;
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  return filterLeadsByScope(rows as unknown as LeadListRow[], scope) as unknown as T[];
}

export async function fetchUltimosLeads(limit = 10) {
  const { empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "id, created_at, nome, whatsapp, origem, tipo_interesse, srd_responsavel_id, srd_responsavel_nome, status, proximo_retorno_data, proximo_retorno_hora, evento_id",
    );
  query = empresaAtiva.slug === GAUCHINHO_SLUG
    ? query.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
    : query.eq("empresa_id", empresaAtiva.id);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 5, 50));
  const filtered = await applyLeadListScope(data ?? []);
  return filtered.slice(0, limit);
}

export async function fetchLeadsRetornoAgendado(limit = 10) {
  const { empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("leads")
    .select(
      "id, proximo_retorno_data, proximo_retorno_hora, nome, whatsapp, tipo_interesse, srd_responsavel_id, srd_responsavel_nome, status, evento_id",
    );
  query = empresaAtiva.slug === GAUCHINHO_SLUG
    ? query.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
    : query.eq("empresa_id", empresaAtiva.id);
  const { data } = await query
    .not("proximo_retorno_data", "is", null)
    .gte("proximo_retorno_data", today)
    .eq("fechado", false)
    .order("proximo_retorno_data", { ascending: true })
    .limit(Math.max(limit * 5, 50));
  const filtered = await applyLeadListScope(data ?? []);
  return filtered.slice(0, limit);
}

export async function fetchUltimasPropostas(limit = 10) {
  const { empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  let query = supabase
    .from("propostas")
    .select(
      "id, created_at, nome_cliente, tipo_proposta, valor_credito, consultor_nome, status",
    );
  query = empresaAtiva.slug === GAUCHINHO_SLUG
    ? query.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
    : query.eq("empresa_id", empresaAtiva.id);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
