import { createClient } from "@/lib/supabase/server";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";
import type { CrmFunilEtapaRow, LeadFilters, LeadListRow } from "./types";
import { CRM_12_ETAPAS } from "./constants";

/** Colunas mínimas — inclui quem indicou para a coluna Origem. */
const LIST_SELECT_MINIMAL =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, srd_responsavel_id, srd_responsavel_nome, parceiro_indicador_nome";

/** Último recurso se a coluna parceiro_indicador_nome ainda não existir no banco. */
const LIST_SELECT_ULTRA_MINIMAL =
  "id, created_at, nome, whatsapp, email, cidade, origem, tipo_interesse, produto_interesse, status, srd_responsavel_id, srd_responsavel_nome";

const LIST_SELECT_BASE =
  `${LIST_SELECT_MINIMAL}, etapa_id, is_incompleto, modelo_interesse, data_ultimo_contato, motivo_perda_codigo, temperatura, proxima_acao, data_proxima_acao, proximo_retorno_data, ultima_interacao_at, valor_estimado, valor_credito, valor_simulado, valor_parcela, valor_fechado, valor_parcela_fechamento, dados_simulacao, fechado, evento_id, evento_nome, historico_cadastros, observacoes, tags`;

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
  if (filters.etapa_id) query = query.eq("etapa_id", filters.etapa_id);
  if (filters.srd) query = query.eq("srd_responsavel_id", filters.srd);
  if (filters.cidade) query = query.ilike("cidade", `%${filters.cidade}%`);
  if (filters.produto) {
    query = query.or(
      `produto_interesse.ilike.%${filters.produto}%,tipo_interesse.ilike.%${filters.produto}%`,
    );
  }
  if (filters.sem_responsavel === "1") query = query.is("srd_responsavel_id", null);
  if (filters.somente_novos === "1") query = query.eq("status", "Novo");
  if (filters.somente_incompletos === "1") query = query.eq("is_incompleto", true);
  if (filters.modelo_interesse) query = query.eq("modelo_interesse", filters.modelo_interesse);

  if (filters.parados_dias) {
    const days = parseInt(filters.parados_dias, 10);
    if (!isNaN(days) && days > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      const iso = targetDate.toISOString();
      query = query.or(`ultima_interacao_at.lt.${iso},and(ultima_interacao_at.is.null,created_at.lt.${iso})`);
    }
  }

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
      query = query.in("temperatura", ["Quente", "Muito quente", "Urgente"]);
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
    if (!isDbMissingColumnError(result.error) && attempt.select !== LIST_SELECT_MINIMAL) {
      continue;
    }
  }

  throw new Error(lastError?.message ?? "Falha ao listar leads");
}

export async function fetchCrmFunilEtapas(empresaId?: string): Promise<CrmFunilEtapaRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("crm_funil_etapas")
    .select("id, empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby, is_ativo, created_at")
    .eq("is_ativo", true)
    .order("ordem", { ascending: true });

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    // Fallback gracioso com as 12 etapas canônicas se a tabela ainda não tiver sido populada no banco remoto
    return CRM_12_ETAPAS.map((etapa) => ({
      id: etapa.slug,
      empresa_id: empresaId ?? "",
      nome: etapa.nome,
      slug: etapa.slug,
      ordem: etapa.ordem,
      cor: etapa.cor,
      is_won: "isWon" in etapa ? Boolean(etapa.isWon) : false,
      is_lost: "isLost" in etapa ? Boolean(etapa.isLost) : false,
      is_standby: "isStandby" in etapa ? Boolean(etapa.isStandby) : false,
      is_ativo: true,
    }));
  }

  return data as CrmFunilEtapaRow[];
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

export async function queryLeadsForKanban(
  filters?: LeadFilters,
  empresaId?: string,
): Promise<LeadListRow[]> {
  const supabase = await createClient();
  return selectLeads(async (select, skipOptional) => {
    let q = supabase.from("leads").select(select);
    if (empresaId) {
      if (empresaId === "7170f38e-15dd-4b19-8588-51e9a9cf0d4c") {
        q = q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      } else {
        q = q.eq("empresa_id", empresaId);
      }
    }
    const query = applyLeadFilters(
      q.order("created_at", { ascending: false }).limit(600),
      filters ?? {},
      { skipOptionalCrmFilters: skipOptional },
    );
    return query;
  });
}
