import { createClient } from "@/lib/supabase/server";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";
import type { LeadFilters, LeadListRow } from "./types";

const LIST_SELECT_BASE =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, temperatura, srd_responsavel_id, srd_responsavel_nome, proxima_acao, data_proxima_acao, proximo_retorno_data, ultima_interacao_at, valor_estimado, valor_simulado, fechado, evento_id, evento_nome";

const LIST_SELECT_INDICADOR_CORE =
  `${LIST_SELECT_BASE}, parceiro_indicador_nome, parceiro_indicador_empresa, parceiro_indicador_telefone`;

const LIST_SELECT_INDICADOR =
  `${LIST_SELECT_INDICADOR_CORE}, parentesco_indicacao, indicador_lead_id`;

function applyLeadFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: LeadFilters,
) {
  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.evento) query = query.eq("evento_id", filters.evento);
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

  return query;
}

async function selectLeads(
  build: (select: string) => Promise<{ data: LeadListRow[] | null; error: { message: string } | null }>,
): Promise<LeadListRow[]> {
  const attempts = [LIST_SELECT_INDICADOR, LIST_SELECT_INDICADOR_CORE, LIST_SELECT_BASE];
  let lastError: { message: string } | null = null;

  for (const select of attempts) {
    const result = await build(select);
    if (!result.error) return (result.data ?? []) as LeadListRow[];
    lastError = result.error;
    if (!isDbMissingColumnError(result.error)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error(lastError?.message ?? "Falha ao listar leads");
}

export async function queryLeadsList(filters: LeadFilters, limit = 200): Promise<LeadListRow[]> {
  const supabase = await createClient();
  return selectLeads(async (select) => {
    const query = applyLeadFilters(
      supabase.from("leads").select(select).order("created_at", { ascending: false }).limit(limit),
      filters,
    );
    return query;
  });
}

export async function queryLeadsForKanban(): Promise<LeadListRow[]> {
  const supabase = await createClient();
  return selectLeads(async (select) =>
    supabase
      .from("leads")
      .select(select)
      .neq("status", "Arquivado")
      .order("updated_at", { ascending: false })
      .limit(500),
  );
}
