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

export async function creditarEConferirComissaoAction(formData: FormData) {
  const access = await requireErpRouteAccess("minhas-comissoes");
  const podeGerenciar =
    access.vinculo.papel?.codigo === "super_admin" ||
    access.permissoes.has("gerenciar_financeiro") ||
    access.permissoes.has("gerenciar_comissoes");

  const previsaoId = String(formData.get("previsao_id") ?? "");
  const db = await createClient();

  const { data: previsao, error } = await db
    .from("comissao_previsoes_participantes")
    .select("id,participante_comercial_id,organizacao_parceira_id,competencia,valor_elegivel,valor_pago,status")
    .eq("id", previsaoId)
    .eq("empresa_id", access.empresaAtiva.id)
    .maybeSingle();

  if (error || !previsao) throw new Error("Previsão não encontrada.");

  const { data: participante } = await db
    .from("participantes_comerciais")
    .select("id, usuario_id")
    .eq("id", previsao.participante_comercial_id)
    .eq("empresa_id", access.empresaAtiva.id)
    .maybeSingle();

  const proprioBeneficiario = participante?.usuario_id === access.usuario.id;
  if (!proprioBeneficiario && !podeGerenciar) {
    throw new Error("Sem permissão para creditar esta comissão.");
  }

  const saldo = Number(previsao.valor_elegivel) - Number(previsao.valor_pago);
  if (saldo > 0) {
    // Registra o pagamento contábil sem conta bancária de saída (o dinheiro continua no caixa da empresa para despesas)
    await registrarPagamentoParticipante({
      empresaId: access.empresaAtiva.id,
      participanteComercialId: previsao.participante_comercial_id,
      organizacaoParceiraId: previsao.organizacao_parceira_id,
      competencia: previsao.competencia,
      valorBruto: saldo.toFixed(2),
      observacoes: "Crédito de comissão do sócio mantido na empresa para despesas",
      idempotencyKey: `credito-socio:${previsao.id}:${saldo.toFixed(2)}`,
      itens: [{ previsaoParticipanteId: previsao.id, valorLiquidado: saldo.toFixed(2) }],
    });
  }

  // Marca como conferido pelo usuário
  await db
    .from("comissao_previsoes_participantes")
    .update({
      conferido_por_participante: true,
      conferido_em: new Date().toISOString(),
      conferido_por_usuario_id: access.usuario.id,
    })
    .eq("id", previsao.id)
    .eq("empresa_id", access.empresaAtiva.id);

  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/financeiro");
  revalidatePath("/erp/fechamento-socios");
}

export async function pagarComissoesAgrupadasAction(formData: FormData) {
  const access = await requireErpRouteAccess("minhas-comissoes");
  if (!(access.vinculo.papel?.codigo === "super_admin" || access.permissoes.has("gerenciar_financeiro"))) {
    throw new Error("Sem permissão para pagar comissões da equipe.");
  }
  const participanteId = String(formData.get("participante_id") ?? "");
  const contaOrigemId = String(formData.get("conta_origem_id") ?? "");
  const operacaoId = String(formData.get("operacao_id") ?? "");
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("previsoes_ids") ?? "[]"));
  } catch {
    throw new Error("Seleção de comissões inválida.");
  }
  ids = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (!ids.length || operacaoId.length < 8) throw new Error("Selecione comissões e a operação.");
  const db = await createClient();
  const [{ data: participante }, { data: previsoes, error }] = await Promise.all([
    db.from("participantes_comerciais").select("id, usuario_id").eq("id", participanteId).eq("empresa_id", access.empresaAtiva.id).maybeSingle(),
    db.from("comissao_previsoes_participantes")
      .select("id,participante_comercial_id,organizacao_parceira_id,competencia,valor_elegivel,valor_pago")
      .eq("empresa_id", access.empresaAtiva.id).eq("participante_comercial_id", participanteId).in("id", ids),
  ]);

  const { data: socio } = participante?.usuario_id
    ? await db.from("empresa_socios").select("id,nome").eq("empresa_id", access.empresaAtiva.id).eq("usuario_id", participante.usuario_id).eq("ativo", true).maybeSingle()
    : { data: null };

  const manterNaEmpresa = contaOrigemId === "manter_empresa" || (!contaOrigemId && Boolean(socio));

  let contaIdParaBaixa: string | null = null;
  if (!manterNaEmpresa) {
    if (!contaOrigemId) throw new Error("Selecione a conta bancária de saída.");
    const { data: conta } = await db.from("financeiro_contas_bancarias").select("id,participante_comercial_id").eq("id", contaOrigemId).eq("empresa_id", access.empresaAtiva.id).eq("ativo", true).maybeSingle();
    if (!conta || conta.participante_comercial_id) throw new Error("Selecione uma conta da empresa para pagar comissões; contas pessoais são somente destino.");
    contaIdParaBaixa = conta.id;
  }

  if (error || (previsoes?.length ?? 0) !== ids.length) throw new Error("Uma ou mais comissões não pertencem ao beneficiário selecionado.");
  const porCompetencia = new Map<string, typeof previsoes>();
  for (const previsao of previsoes ?? []) {
    const saldo = Number(previsao.valor_elegivel) - Number(previsao.valor_pago);
    if (saldo <= 0) throw new Error("Uma das comissões já foi paga ou deixou de estar elegível.");
    porCompetencia.set(previsao.competencia, [...(porCompetencia.get(previsao.competencia) ?? []), previsao]);
  }
  for (const [competencia, grupo] of porCompetencia) {
    const itens = grupo.map((previsao) => ({
      previsaoParticipanteId: previsao.id,
      valorLiquidado: (Number(previsao.valor_elegivel) - Number(previsao.valor_pago)).toFixed(2),
    }));
    const total = itens.reduce((soma, item) => soma + Number(item.valorLiquidado), 0);
    await registrarPagamentoParticipante({
      empresaId: access.empresaAtiva.id,
      participanteComercialId: grupo[0].participante_comercial_id,
      organizacaoParceiraId: grupo[0].organizacao_parceira_id,
      competencia,
      valorBruto: total.toFixed(2),
      ...(contaIdParaBaixa ? { contaBancariaOrigemId: contaIdParaBaixa } : {}),
      observacoes: manterNaEmpresa
        ? "Crédito de comissão do sócio mantido na empresa para despesas operacionais"
        : "Pagamento agrupado de comissões",
      referenciaDocumento: `Lote ${operacaoId}`,
      idempotencyKey: `pagamento-agrupado:${operacaoId}:${competencia}`,
      itens,
    });
  }

  if (manterNaEmpresa) {
    await db
      .from("comissao_previsoes_participantes")
      .update({
        conferido_por_participante: true,
        conferido_em: new Date().toISOString(),
        conferido_por_usuario_id: access.usuario.id,
      })
      .in("id", ids)
      .eq("empresa_id", access.empresaAtiva.id);
  }

  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/financeiro");
  revalidatePath("/erp/fechamento-socios");
  revalidatePath("/erp/contas-pagar");
}

export async function ajustarParcelamentoComissaoAction(formData: FormData) {
  const access = await requireErpRouteAccess("minhas-comissoes");
  if (access.vinculo.papel?.codigo !== "super_admin") throw new Error("Somente o Master pode alterar o modelo de uma comissão já gerada.");
  const participanteId = String(formData.get("participante_id") || "");
  const percentual = Number(formData.get("percentual_empresa") || 0);
  const percentualEmpresa = Number(formData.get("percentual_empresa_total") || 0);
  const modo = String(formData.get("modo") || "igual");
  const ids = JSON.parse(String(formData.get("previsoes_ids") || "[]"));
  if (!Array.isArray(ids) || ids.length < 4 || percentual <= 0) throw new Error("Selecione as parcelas da mesma venda e informe o percentual.");
  const db = await createClient();
  const { data: previsoes, error } = await db.from("comissao_previsoes_participantes")
    .select("id,venda_id,competencia,nome_etapa,valor_pago,status").eq("empresa_id", access.empresaAtiva.id).eq("participante_comercial_id", participanteId).in("id", ids).order("competencia");
  if (error || !previsoes || previsoes.length !== ids.length) throw new Error("Não foi possível localizar as parcelas selecionadas.");
  if (new Set(previsoes.map((item) => item.venda_id)).size !== 1) throw new Error("Selecione somente parcelas da mesma venda.");
  if (previsoes.some((item) => Number(item.valor_pago) > 0)) throw new Error("Parcelas já pagas não podem ser alteradas.");
  const { data: venda } = await db.from("vendas").select("valor_credito").eq("id", previsoes[0].venda_id).eq("empresa_id", access.empresaAtiva.id).single();
  const brutoTotal = Number(venda?.valor_credito || 0) * percentualEmpresa / 100 * percentual / 100;
  if (!brutoTotal) throw new Error("Não foi possível calcular a comissão pelo crédito da venda.");
  const valores = modo === "personalizada" ? [1,2,3,4].map((n) => Number(formData.get(`parcela_${n}`) || 0)) : Array(4).fill(Math.round(brutoTotal * 25) / 100);
  valores[3] = Math.round((brutoTotal - valores.slice(0, 3).reduce((s, v) => s + v, 0)) * 100) / 100;
  if (valores.some((valor) => valor < 0) || Math.abs(valores.reduce((s,v) => s + v, 0) - brutoTotal) > 0.01) throw new Error("A soma das quatro parcelas deve ser igual ao total da comissão.");
  for (const [indice, previsao] of previsoes.entries()) {
    const bruto = indice < 4 ? valores[indice] : 0;
    const liquido = Math.round(bruto * 0.825 * 100) / 100;
    const snapshot_regra = { ajuste_manual: { aplicado_em: new Date().toISOString(), percentual_sobre_empresa: percentual, percentual_empresa: percentualEmpresa, bruto, imposto: Math.round((bruto - liquido) * 100) / 100, modo } };
    const { error: updateError } = await db.from("comissao_previsoes_participantes").update({ valor_previsto: liquido, valor_elegivel: previsao.status === "elegivel" ? liquido : 0, percentual_aplicado: percentual, status: bruto ? previsao.status : "suspensa", snapshot_regra }).eq("id", previsao.id).eq("empresa_id", access.empresaAtiva.id);
    if (updateError) throw new Error(updateError.message);
  }
  revalidatePath("/erp/minhas-comissoes");
}
