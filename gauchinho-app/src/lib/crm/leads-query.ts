import { createClient } from "@/lib/supabase/server";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";
import type { LeadFilters, LeadListRow } from "./types";

/** Colunas mínimas — inclui quem indicou para a coluna Origem. */
const LIST_SELECT_MINIMAL =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, srd_responsavel_id, srd_responsavel_nome, parceiro_indicador_nome";

/** Último recurso se a coluna parceiro_indicador_nome ainda não existir no banco. */
const LIST_SELECT_ULTRA_MINIMAL =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, srd_responsavel_id, srd_responsavel_nome";

const LIST_SELECT_BASE =
  `${LIST_SELECT_MINIMAL}, temperatura, proxima_acao, data_proxima_acao, proximo_retorno_data, ultima_interacao_at, valor_estimado, valor_simulado, fechado, evento_id, evento_nome`;

const LIST_SELECT_INDICADOR_CORE =
  `${LIST_SELECT_BASE}, parceiro_indicador_empresa, parceiro_indicador_telefone`;

const LIST_SELECT_INDICADOR =
  `${LIST_SELECT_INDICADOR_CORE}, parentesco_indicacao, indicador_lead_id`;

function applyLeadFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: LeadFilters,
  opts?: { skipOptionalCrmFilters?: boolean },
) {
  const skipOptional = opts?.skipOptionalCrmFilters === true;

  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.srd) query = query.eq("srd_responsavel_id", filters.srd);
  if (filters.cidade) query = query.ilike("cidade", `%${filters.cidade}%`);
  if (filters.produto) {
    query = query.or(
      `produto_interesse.ilike.%${filters.produto}%,tipo_interesse.ilike.%${filters.produto}%`,
    );
  }
  if (filters.sem_responsavel === "1") query = query.is("srd_responsavel_id", null);
  if (filters.somente_novos === "1") query = query.eq("status", "Novo");

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(
      `nome.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%,cidade.ilike.%${q}%,produto_interesse.ilike.%${q}%,origem.ilike.%${q}%`,
    );
  }

  if (!skipOptional) {
    if (filters.evento) query = query.eq("evento_id", filters.evento);
    if (filters.temperatura) query = query.eq("temperatura", filters.temperatura);
    if (filters.somente_quentes === "1") {
      query = query.in("temperatura", ["Quente", "Muito quente"]);
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

type QueryResult = { data: LeadListRow[] | null; error: { message: string } | null };

async function selectLeads(
  build: (select: string, skipOptionalCrmFilters: boolean) => Promise<QueryResult>,
): Promise<LeadListRow[]> {
  const attempts: Array<{ select: string; skipOptional: boolean }> = [
    { select: LIST_SELECT_INDICADOR, skipOptional: false },
    { select: LIST_SELECT_INDICADOR_CORE, skipOptional: false },
    { select: LIST_SELECT_BASE, skipOptional: false },
    { select: LIST_SELECT_MINIMAL, skipOptional: true },
    { select: LIST_SELECT_ULTRA_MINIMAL, skipOptional: true },
  ];

  let lastError: { message: string } | null = null;

  for (const attempt of attempts) {
    const result = await build(attempt.select, attempt.skipOptional);
    if (!result.error) return (result.data ?? []) as LeadListRow[];
    lastError = result.error;
    // Continua tentando em qualquer erro de coluna/schema; outros erros também
    // tentam fallback mínimo antes de falhar de vez.
    if (!isDbMissingColumnError(result.error) && attempt.select !== LIST_SELECT_MINIMAL) {
      // ainda tenta o mínimo
      continue;
    }
  }

  throw new Error(lastError?.message ?? "Falha ao listar leads");
}

export async function queryLeadsList(filters: LeadFilters, limit = 200): Promise<LeadListRow[]> {
  const supabase = await createClient();
  return selectLeads(async (select, skipOptional) => {
    const query = applyLeadFilters(
      supabase.from("leads").select(select).order("created_at", { ascending: false }).limit(limit),
      filters,
      { skipOptionalCrmFilters: skipOptional },
    );
    return query;
  });
}

export async function queryLeadsForKanban(): Promise<LeadListRow[]> {
  const supabase = await createClient();
  return selectLeads(async (select, skipOptional) => {
    const query = applyLeadFilters(
      supabase.from("leads").select(select).order("created_at", { ascending: false }).limit(500),
      { status: skipOptional ? undefined : undefined },
      { skipOptionalCrmFilters: true },
    );
    // Evita filtrar por "Arquivado" se status tiver valores legados; só ordena.
    return query;
  });
}
