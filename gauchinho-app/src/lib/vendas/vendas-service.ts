import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertEmpresaPodeAcessarGrupo } from "@/lib/grupos/catalogo-autorizado-service";
import type { GrupoConsorcio } from "@/lib/types";

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
): Promise<{ venda: VendaRow; cotaDefinitiva: CotaDefinitivaRow }> {
  const admin = createAdminClient();

  // 1. Idempotência sempre escopada ao tenant: nunca devolve dados de outra empresa.
  const { data: vendaExistente } = await admin
    .from("vendas")
    .select("*")
    .eq("contratacao_id", contratacaoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (vendaExistente) {
    const { data: cotaExistente } = await admin
      .from("cotas_definitivas")
      .select("*")
      .eq("venda_id", vendaExistente.id)
      .maybeSingle();

    if (!cotaExistente || cotaExistente.empresa_id !== empresaId) {
      throw new Error("Venda existente sem cota definitiva íntegra para este tenant.");
    }

    return {
      venda: vendaExistente as VendaRow,
      cotaDefinitiva: cotaExistente as CotaDefinitivaRow,
    };
  }

  // 2. Busca a contratação online
  const { data: contratacao, error: errContr } = await admin
    .from("contratacoes_online")
    .select("*")
    .eq("id", contratacaoId)
    .single();

  if (errContr || !contratacao) {
    throw new Error("Contratação online não encontrada.");
  }

  // 3. Validação estrita de Tenant
  const contratacaoEmpresaId = contratacao.empresa_id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  if (contratacaoEmpresaId !== empresaId) {
    throw new Error("Acesso negado: a contratação pertence a outro tenant.");
  }

  // 4. Validação de Concessão e Catálogo Ativo
  const dados = (contratacao.dados_simulacao ?? {}) as Record<string, unknown>;
  const grupoId = String(contratacao.grupo_id ?? dados.grupoId ?? "");
  if (!grupoId) {
    throw new Error("Contratação sem grupo_id associado.");
  }

  const grupo = await assertEmpresaPodeAcessarGrupo(empresaId, grupoId);

  // 5. Extração dos dados do cliente e da proposta/simulação
  const clienteNome = String(contratacao.nome ?? dados.cliente_nome ?? "Cliente Consórcio");
  const clienteCpfCnpj = String(contratacao.cpf ?? contratacao.cnpj ?? dados.cliente_cpf ?? "");
  const clienteEmail = String(contratacao.email ?? dados.cliente_email ?? "");
  const clienteTelefone = String(contratacao.telefone ?? dados.cliente_telefone ?? "");

  const valorCredito = Number(contratacao.credito_selecionado ?? dados.valor_credito);
  const prazo = Number(contratacao.prazo ?? dados.prazo ?? grupo.prazo_total);
  const parcela = Number(contratacao.parcela_estimada ?? dados.valor_parcela);
  if (!Number.isFinite(valorCredito) || valorCredito <= 0) {
    throw new Error("Contratação sem valor de crédito válido.");
  }
  if (!Number.isInteger(prazo) || prazo <= 0) {
    throw new Error("Contratação sem prazo válido.");
  }
  if (!Number.isFinite(parcela) || parcela <= 0) {
    throw new Error("Contratação sem parcela válida.");
  }

  const snapshotVenda = {
    dados_simulacao: dados,
    grupo_codigo: grupo.codigo_grupo,
    administradora_id: grupo.administradora_id,
    data_conversao: new Date().toISOString(),
  };

  // 6. Inserção na tabela VENDAS
  const { data: vendaInserida, error: errVenda } = await admin
    .from("vendas")
    .insert({
      empresa_id: empresaId,
      lead_id: contratacao.lead_id ?? null,
      proposta_id: null,
      contratacao_id: contratacaoId,
      cliente_nome: clienteNome,
      cliente_cpf_cnpj: clienteCpfCnpj || null,
      cliente_email: clienteEmail || null,
      cliente_telefone: clienteTelefone || null,
      administradora_id: grupo.administradora_id!,
      grupo_id: grupo.id,
      opcao_cota_id: (contratacao.cota_id as string) ?? null,
      participante_comercial_id: contratacao.participante_comercial_id ?? null,
      organizacao_parceira_id: contratacao.organizacao_parceira_id ?? null,
      valor_credito: valorCredito,
      prazo: prazo,
      parcela: parcela,
      status: "confirmada",
      snapshot_venda: snapshotVenda,
    })
    .select("*")
    .single();

  if (errVenda || !vendaInserida) {
    throw new Error(`Erro ao registrar venda: ${errVenda?.message}`);
  }

  // 7. Inserção na tabela COTAS DEFINITIVAS
  const { data: cotaInserida, error: errCota } = await admin
    .from("cotas_definitivas")
    .insert({
      empresa_id: empresaId,
      venda_id: vendaInserida.id,
      administradora_id: grupo.administradora_id!,
      grupo_id: grupo.id,
      numero_grupo: grupo.codigo_grupo,
      numero_cota: (dados.numero_cota as string) ?? null,
      valor_credito: valorCredito,
      prazo: prazo,
      parcela: parcela,
      status: "ativa",
      participante_comercial_id: contratacao.participante_comercial_id ?? null,
      organizacao_parceira_id: contratacao.organizacao_parceira_id ?? null,
      snapshot_cota: snapshotVenda,
    })
    .select("*")
    .single();

  if (errCota || !cotaInserida) {
    throw new Error(`Erro ao registrar cota definitiva: ${errCota?.message}`);
  }

  // 8. Atualização do status da contratação online para finalizada
  await admin
    .from("contratacoes_online")
    .update({ status: "finalizada", updated_at: new Date().toISOString() })
    .eq("id", contratacaoId);

  // 9. Atualização do status do lead para convertido, se existir
  if (contratacao.lead_id) {
    await admin
      .from("leads")
      .update({ status: "convertido", updated_at: new Date().toISOString() })
      .eq("id", contratacao.lead_id);
  }

  return {
    venda: vendaInserida as VendaRow,
    cotaDefinitiva: cotaInserida as CotaDefinitivaRow,
  };
}

/**
 * Lista vendas registradas para uma empresa / tenant.
 * Para a Empresa B (0 concessões), retorna lista vazia.
 */
export async function listVendasForEmpresa(empresaId: string): Promise<VendaRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cotas_definitivas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as CotaDefinitivaRow[];
}
