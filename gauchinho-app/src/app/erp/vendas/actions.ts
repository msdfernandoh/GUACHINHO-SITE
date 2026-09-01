"use server";

import { revalidatePath } from "next/cache";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

function val(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireVendaWrite() {
  await requireErpRouteAccess("vendas");
  return requireTenantPermission("formalizar_vendas");
}

async function requireVendaMaster() {
  const context = await requireVendaWrite();
  const isAdminEmpresa = context.vinculoAtivo.papel?.codigo === "admin_empresa";
  if (!isAdminEmpresa && !(await isPlatformSuperadmin())) {
    throw new Error("Apenas o administrador da empresa pode executar esta operação crítica.");
  }
  return context;
}

export async function masterAtualizarVendaAction(formData: FormData) {
  const { empresaAtiva } = await requireVendaMaster();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const vendaId = val(formData, "venda_id");
  const numeroGrupo = val(formData, "numero_grupo");
  const numeroCota = val(formData, "numero_cota");
  const quantidadeCotas = val(formData, "quantidade_cotas");
  const valorCredito = val(formData, "valor_credito");
  const valorParcela = val(formData, "valor_parcela");
  const prazo = val(formData, "prazo");
  const principalId = val(formData, "participante_principal_id") || null;
  const secundarioId = val(formData, "participante_secundario_id") || null;
  const fracao = val(formData, "fracao_secundario");
  const perfilPrincipalId = val(formData, "perfil_principal_id") || null;
  const perfilSecundarioId = val(formData, "perfil_secundario_id") || null;
  const modalidadeComissaoId = val(formData, "modalidade_comissao_id") || null;
  const tipoVenda = val(formData, "tipo_venda") || "INTEGRAL";
  const dataPrimeira = val(formData, "data_primeira_parcela") || null;
  const dataSegunda = val(formData, "data_segunda_parcela") || null;
  const recalcular = formData.get("recalcular_futuras") === "on" || formData.get("recalcular_futuras") === "true";

  const admin = createAdminClient();

  // 1. Atualiza dados da venda (incluindo modalidade de venda e snapshot)
  const vendaUpdatePayload: Record<string, unknown> = {
    participante_comercial_id: principalId,
    participante_secundario_id: secundarioId,
    participante_secundario_fracao_percentual: secundarioId && fracao ? Number(fracao) : null,
    perfil_principal_id: perfilPrincipalId,
    perfil_secundario_id: perfilSecundarioId,
    data_primeira_parcela: dataPrimeira,
    data_segunda_parcela: dataSegunda,
    updated_at: new Date().toISOString(),
  };

  if (valorCredito) vendaUpdatePayload.valor_credito = Number(valorCredito);
  if (valorParcela) vendaUpdatePayload.parcela = Number(valorParcela);
  if (prazo) vendaUpdatePayload.prazo = Number(prazo);

  if (modalidadeComissaoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(modalidadeComissaoId)) {
    vendaUpdatePayload.modalidade_comissao_id = modalidadeComissaoId;
  }

  const { data: currentVenda } = await admin.from("vendas").select("snapshot_venda").eq("id", vendaId).maybeSingle();
  if (currentVenda) {
    vendaUpdatePayload.snapshot_venda = {
      ...(currentVenda.snapshot_venda || {}),
      numero_grupo: numeroGrupo || currentVenda.snapshot_venda?.numero_grupo,
      numero_cota: numeroCota || currentVenda.snapshot_venda?.numero_cota,
      quantidade_cotas: quantidadeCotas ? Number(quantidadeCotas) : currentVenda.snapshot_venda?.quantidade_cotas || 1,
      modalidade_comissao_id: modalidadeComissaoId,
      tipo_venda: tipoVenda,
      tipo_negociacao: tipoVenda === "REDUZIDA_60_99" ? "Reduzida 60%" : tipoVenda === "REDUZIDA_ABAIXO_59" ? "Abaixo de 59%" : "Integral",
    };
  }

  const { error: vendaUpdateError } = await admin
    .from("vendas")
    .update(vendaUpdatePayload)
    .eq("id", vendaId)
    .eq("empresa_id", empresaAtiva.id);
  if (vendaUpdateError) throw new Error(vendaUpdateError.message);

  // 2. Atualiza número da cota e grupo se fornecido
  const cotaPayload: Record<string, unknown> = {
    participante_comercial_id: principalId,
    updated_at: new Date().toISOString(),
  };
  if (numeroCota !== undefined) {
    cotaPayload.numero_cota = numeroCota ? numeroCota.trim() : null;
  }
  if (numeroGrupo) {
    cotaPayload.numero_grupo = numeroGrupo.trim();
  }
  if (valorCredito) cotaPayload.valor_credito = Number(valorCredito);
  if (valorParcela) cotaPayload.parcela = Number(valorParcela);
  if (prazo) cotaPayload.prazo = Number(prazo);

  const { error: cotaUpdateError } = await admin
    .from("cotas_definitivas")
    .update(cotaPayload)
    .eq("venda_id", vendaId)
    .eq("empresa_id", empresaAtiva.id);
  if (cotaUpdateError) throw new Error(cotaUpdateError.message);

  // 3. A RPC autenticada substitui as previsões dentro de uma única transação.
  // Não apague antes: se a geração falhar, o PostgreSQL preserva o cronograma anterior.
  if (recalcular) {
    const db = await createClient();
    const { error: recalculoError } = await db.rpc("rpc_gerar_previsoes_comissao_v2", {
      p_empresa_id: empresaAtiva.id,
      p_venda_id: vendaId,
      p_idempotency_key: `recalculo_master:${vendaId}:${Date.now()}`
    });
    if (recalculoError) throw new Error(`Não foi possível recalcular as comissões: ${recalculoError.message}`);

    // O motor calcula o total agregado da venda. Em vendas multicotas, cada
    // cota recebe seu próprio cronograma sem alterar o total geral.
    const { error: distribuicaoError } = await admin.rpc("distribuir_previsoes_por_cota", {
      p_empresa_id: empresaAtiva.id,
      p_venda_id: vendaId,
    });
    if (distribuicaoError) {
      throw new Error(`As comissões foram recalculadas, mas não puderam ser separadas por cota: ${distribuicaoError.message}`);
    }
  }

  revalidatePath("/erp/vendas");
  revalidatePath("/admin/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true };
}

export async function cancelarCotaEstornoAction(formData: FormData) {
  const { empresaAtiva } = await requireVendaWrite();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const motivo = val(formData, "motivo") || "Cancelamento de cota solicitado pelo cliente.";

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_cancelar_cota_com_estorno", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true, data };
}

export async function masterExcluirOuEstornarVendaAction(formData: FormData) {
  const { empresaAtiva } = await requireVendaMaster();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const vendaId = val(formData, "venda_id");
  const acao = val(formData, "acao"); // "EXCLUIR" ou "ESTORNAR"
  const confirmacao = val(formData, "confirmacao_texto");
  const cancelarPagas = formData.get("cancelar_pagas") === "true";
  const motivo = val(formData, "motivo") || "Ação administrativa do usuário Master.";

  if (acao === "EXCLUIR" && confirmacao !== "EXCLUIR") {
    throw new Error('Para confirmar a exclusão definitiva, você deve digitar "EXCLUIR".');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("rpc_master_excluir_ou_estornar_venda", {
    p_empresa_id: empresaAtiva.id,
    p_venda_id: vendaId,
    p_acao: acao,
    p_cancelar_comissoes_pagas: cancelarPagas,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/contratacoes");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  revalidatePath("/erp/repasse-franquia");
  return { ok: true, acao };
}

export async function atualizarNumeroCotaAction(formData: FormData) {
  const { empresaAtiva } = await requireVendaWrite();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const numeroCota = val(formData, "numero_cota");

  const admin = createAdminClient();
  const { error } = await admin
    .from("cotas_definitivas")
    .update({ numero_cota: NULLIF_OR_VAL(numeroCota), updated_at: new Date().toISOString() })
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id);

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  return { ok: true };
}

export async function registrarContemplacaoAction(formData: FormData) {
  const { empresaAtiva } = await requireVendaWrite();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const tipoContemplacao = val(formData, "tipo_contemplacao") || "SORTEIO";
  const dataContemplacao = val(formData, "data_contemplacao") || new Date().toISOString().slice(0, 10);
  const antecipar = formData.get("antecipar_comissoes") === "true";
  const competencia = val(formData, "competencia_antecipada") || dataContemplacao.slice(0, 7);
  const observacao = val(formData, "observacao") || null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_registrar_contemplacao_comissoes", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_tipo_contemplacao: tipoContemplacao,
    p_data_contemplacao: dataContemplacao,
    p_antecipar_comissoes: antecipar,
    p_competencia_antecipada: competencia,
    p_observacao: observacao,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true, data };
}

function NULLIF_OR_VAL(v: string) {
  return v.trim().length > 0 ? v.trim() : null;
}
