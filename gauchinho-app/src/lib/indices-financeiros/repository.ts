import { createAdminClient } from "@/lib/supabase/admin";
import type { IndiceFinanceiroRow } from "./types";

function rowFromDb(r: Record<string, unknown>): IndiceFinanceiroRow {
  return {
    id: String(r.id),
    codigo: String(r.codigo),
    nome: String(r.nome),
    tipo: String(r.tipo),
    valor_mensal: r.valor_mensal != null ? Number(r.valor_mensal) : null,
    valor_anual: r.valor_anual != null ? Number(r.valor_anual) : null,
    valor_acumulado_12m: r.valor_acumulado_12m != null ? Number(r.valor_acumulado_12m) : null,
    fonte: r.fonte != null ? String(r.fonte) : null,
    fonte_url: r.fonte_url != null ? String(r.fonte_url) : null,
    data_referencia: r.data_referencia != null ? String(r.data_referencia) : null,
    ultima_atualizacao: r.ultima_atualizacao != null ? String(r.ultima_atualizacao) : null,
    ativo: Boolean(r.ativo),
    atualizacao_automatica: Boolean(r.atualizacao_automatica),
    fallback_manual: Boolean(r.fallback_manual),
    observacao: r.observacao != null ? String(r.observacao) : null,
  };
}

export async function listIndicesFinanceiros(): Promise<IndiceFinanceiroRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("indices_financeiros")
    .select("*")
    .order("codigo", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowFromDb(r as Record<string, unknown>));
}

export async function getIndiceByCodigo(codigo: string): Promise<IndiceFinanceiroRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("indices_financeiros")
    .select("*")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowFromDb(data as Record<string, unknown>);
}

export type UpdateIndiceInput = {
  codigo: string;
  nome?: string;
  valor_mensal?: number | null;
  valor_anual?: number | null;
  valor_acumulado_12m?: number | null;
  fonte?: string | null;
  fonte_url?: string | null;
  data_referencia?: string | null;
  ativo?: boolean;
  atualizacao_automatica?: boolean;
  fallback_manual?: boolean;
  observacao?: string | null;
};

export async function updateIndiceFinanceiro(input: UpdateIndiceInput): Promise<void> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.nome !== undefined) patch.nome = input.nome;
  if (input.valor_mensal !== undefined) patch.valor_mensal = input.valor_mensal;
  if (input.valor_anual !== undefined) patch.valor_anual = input.valor_anual;
  if (input.valor_acumulado_12m !== undefined) patch.valor_acumulado_12m = input.valor_acumulado_12m;
  if (input.fonte !== undefined) patch.fonte = input.fonte;
  if (input.fonte_url !== undefined) patch.fonte_url = input.fonte_url;
  if (input.data_referencia !== undefined) patch.data_referencia = input.data_referencia;
  if (input.ativo !== undefined) patch.ativo = input.ativo;
  if (input.atualizacao_automatica !== undefined) patch.atualizacao_automatica = input.atualizacao_automatica;
  if (input.fallback_manual !== undefined) patch.fallback_manual = input.fallback_manual;
  if (input.observacao !== undefined) patch.observacao = input.observacao;

  const { error } = await admin.from("indices_financeiros").update(patch).eq("codigo", input.codigo);
  if (error) throw new Error(error.message);
}

export async function persistIndiceAtualizado(
  codigo: string,
  fields: {
    valor_mensal?: number | null;
    valor_anual?: number | null;
    valor_acumulado_12m?: number | null;
    fonte?: string | null;
    fonte_url?: string | null;
    data_referencia?: string | null;
    observacao?: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("indices_financeiros")
    .update({
      ...fields,
      ultima_atualizacao: now,
    })
    .eq("codigo", codigo);
  if (error) throw new Error(error.message);
}
