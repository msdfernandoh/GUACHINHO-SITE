import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VendaRow = {
  id: string;
  empresa_id: string;
  lead_id: string | null;
  proposta_id: string | null;
  contratacao_id: string | null;
  cliente_nome: string;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  administradora_id: string;
  grupo_id: string;
  opcao_cota_id: string | null;
  participante_comercial_id: string | null;
  organizacao_parceira_id: string | null;
  valor_credito: number;
  prazo: number;
  parcela: number;
  status: "pendente" | "confirmada" | "cancelada" | "suspensa";
  snapshot_venda: Record<string, unknown>;
  data_venda: string;
  created_at: string;
  updated_at: string;
};

export type CotaDefinitivaRow = {
  id: string;
  empresa_id: string;
  venda_id: string;
  administradora_id: string;
  grupo_id: string;
  numero_grupo: string;
  numero_cota: string | null;
  valor_credito: number;
  prazo: number;
  parcela: number;
  status: "ativa" | "cancelada" | "contemplada" | "quitada";
  participante_comercial_id: string | null;
  organizacao_parceira_id: string | null;
  snapshot_cota: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Converte uma contratação online aprovada em Venda Efetivada e gera a Cota Definitiva.
 * Possui IDEMPOTÊNCIA rigorosa: se a contratação já gerou venda, retorna a venda existente sem duplicar.
 */
export async function converterContratacaoEmVenda(
  empresaId: string,
  contratacaoId: string,
  idempotencyKey = `conversao:${contratacaoId}`,
): Promise<{ venda: VendaRow; cotaDefinitiva: CotaDefinitivaRow }> {
  const db = await createClient();
  const { data, error } = await db.rpc("rpc_converter_contratacao_venda", {
    p_empresa_id: empresaId,
    p_contratacao_id: contratacaoId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const result = data as { venda?: VendaRow; cotaDefinitiva?: CotaDefinitivaRow } | null;
  if (!result?.venda || !result.cotaDefinitiva) {
    throw new Error("Conversão transacional não retornou venda e cota definitiva íntegras.");
  }
  return { venda: result.venda, cotaDefinitiva: result.cotaDefinitiva };
}

/**
 * Lista vendas registradas para uma empresa / tenant.
 * Para a Empresa B (0 concessões), retorna lista vazia.
 */
export async function listVendasForEmpresa(empresaId: string): Promise<VendaRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("vendas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as VendaRow[];
}

/**
 * Lista cotas definitivas de clientes para uma empresa / tenant.
 */
export async function listCotasDefinitivasForEmpresa(empresaId: string): Promise<CotaDefinitivaRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("cotas_definitivas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as CotaDefinitivaRow[];
}
