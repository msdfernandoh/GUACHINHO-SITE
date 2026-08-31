"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { registrarPagamentoParticipante } from "@/lib/financeiro/financeiro-service";
export async function conferirPagamentoAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("minhas-comissoes");
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const id = String(formData.get("previsao_id") ?? "");
  const db = await createClient();
  const { error } = await db.rpc("rpc_conferir_pagamento_participante", {
    p_empresa_id: empresaAtiva.id,
    p_previsao_participante_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/minhas-comissoes");
}

export async function pagarComissaoEquipeAction(formData: FormData) {
  const access = await requireErpRouteAccess("minhas-comissoes");
  const podePagarEquipe =
    access.vinculo.papel?.codigo === "super_admin" ||
    access.permissoes.has("gerenciar_financeiro");
  if (!podePagarEquipe) {
    throw new Error("Sem permissão para pagar comissões da equipe.");
  }
  const previsaoId = String(formData.get("previsao_id") ?? "");
  const participanteId = String(formData.get("participante_id") ?? "");
  const db = await createClient();
  const { data: previsao, error } = await db
    .from("comissao_previsoes_participantes")
    .select("id,participante_comercial_id,organizacao_parceira_id,competencia,valor_elegivel,valor_pago")
    .eq("id", previsaoId)
    .eq("empresa_id", access.empresaAtiva.id)
    .eq("participante_comercial_id", participanteId)
    .maybeSingle();
  if (error || !previsao) throw new Error("Previsão não encontrada para este consultor.");
  const saldo = Number(previsao.valor_elegivel) - Number(previsao.valor_pago);
  if (!Number.isFinite(saldo) || saldo <= 0) {
    throw new Error("Esta comissão não possui saldo elegível para pagamento.");
  }
  await registrarPagamentoParticipante({
    empresaId: access.empresaAtiva.id,
    participanteComercialId: previsao.participante_comercial_id,
    organizacaoParceiraId: previsao.organizacao_parceira_id,
    competencia: previsao.competencia,
    valorBruto: saldo.toFixed(2),
    observacoes: "Pagamento da comissão pela visão de equipe",
    idempotencyKey: `pagamento-equipe:${previsao.id}:${saldo.toFixed(2)}`,
    itens: [{ previsaoParticipanteId: previsao.id, valorLiquidado: saldo.toFixed(2) }],
  });
  revalidatePath("/erp/minhas-comissoes");
}
