import { createClient } from "@/lib/supabase/server";
import type { LeadFilters, LeadListRow } from "./types";

const LIST_SELECT =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, temperatura, srd_responsavel_id, srd_responsavel_nome, proxima_acao, data_proxima_acao, proximo_retorno_data, ultima_interacao_at, valor_estimado, valor_simulado, fechado";

export async function queryLeadsList(filters: LeadFilters, limit = 200): Promise<LeadListRow[]> {
  const supabase = await createClient();
  let query = supabase.from("leads").select(LIST_SELECT).order("created_at", { ascending: false }).limit(limit);

  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.srd) query = query.eq("srd_responsavel_id", filters.srd);
  if (filters.temperatura) query = query.eq("temperatura", filters.temperatura);
  if (filters.cidade) query = query.ilike("cidade", `%${filters.cidade}%`);
  if (filters.produto) {
    query = query.or(
      `produto_interesse.ilike.%${filters.produto}%,tipo_interesse.ilike.%${filters.produto}%`,
    );
  }
  if (filters.sem_responsavel === "1") query = query.is("srd_responsavel_id", null);
  if (filters.somente_novos === "1") query = query.eq("status", "Novo");
  if (filters.somente_quentes === "1") {
    query = query.in("temperatura", ["Quente", "Muito quente"]);
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(
      `nome.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%,cidade.ilike.%${q}%,produto_interesse.ilike.%${q}%,origem.ilike.%${q}%`,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  if (filters.retorno === "hoje") {
    query = query.eq("proximo_retorno_data", today);
  } else if (filters.retorno === "atrasados") {
    query = query.lt("proximo_retorno_data", today).not("proximo_retorno_data", "is", null);
  } else if (filters.retorno === "futuros") {
    query = query.gt("proximo_retorno_data", today);
  } else if (filters.retorno === "sem") {
    query = query.is("proximo_retorno_data", null).is("data_proxima_acao", null);
  } else if (filters.retorno === "com") {
    query = query.or("proximo_retorno_data.not.is.null,data_proxima_acao.not.is.null");
  }

  if (filters.acao_vencida === "1") {
    query = query.lt("data_proxima_acao", nowIso).not("data_proxima_acao", "is", null);
  }

  if (filters.periodo === "7") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query = query.gte("created_at", d.toISOString());
  } else if (filters.periodo === "30") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query = query.gte("created_at", d.toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadListRow[];
}

export async function queryLeadsForKanban(): Promise<LeadListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LIST_SELECT)
    .neq("status", "Arquivado")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadListRow[];
}
