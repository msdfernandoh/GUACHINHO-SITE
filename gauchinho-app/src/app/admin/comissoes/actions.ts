"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import {
  registrarPagamentoParticipante,
  registrarRecebimentoAdministradora,
  transferirPendenciaRecebimento,
} from "@/lib/financeiro/financeiro-service";
const decimal = (value: FormDataEntryValue | null) =>
  Number(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
export async function confirmarRecebimentoComissaoAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const id = String(formData.get("previsao_id") ?? "");
  const valor = decimal(formData.get("valor"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const db = await createClient();
  const { data: p, error } = await db
    .from("comissao_previsoes_franquia")
    .select("administradora_id,competencia,valor_previsto,valor_liquidado")
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .maybeSingle();
  if (error || !p) throw new Error("Previsão não encontrada.");
  const saldo = Number(p.valor_previsto) - Number(p.valor_liquidado);
  if (!Number.isFinite(valor) || valor <= 0)
    throw new Error("Valor recebido inválido.");
  if (valor > saldo && (!motivo || !observacao))
    throw new Error("Diferença positiva exige motivo e observação.");
  let pendenciaId: string | undefined;
  if (valor > saldo) {
    const { data: pendencia } = await db
      .from("financeiro_pendencias_recebimento")
      .select("id")
      .eq("empresa_id", empresaAtiva.id)
      .eq("administradora_id", p.administradora_id)
      .lte("competencia_destino", p.competencia)
      .order("competencia_original", { ascending: true })
      .limit(1)
      .maybeSingle();
    pendenciaId = pendencia?.id;
  }
  await registrarRecebimentoAdministradora({
    empresaId: empresaAtiva.id,
    administradoraId: p.administradora_id,
    competencia: p.competencia,
    valorTotal: valor.toFixed(2),
    observacoes: [motivo, observacao].filter(Boolean).join(" — "),
    motivoDivergencia: valor > saldo ? motivo : undefined,
    pendenciaId,
    idempotencyKey: `recebimento:${id}:${valor.toFixed(2)}:${new Date().toISOString().slice(0, 10)}`,
    itens: [{ previsaoFranquiaId: id, valorLiquidado: valor.toFixed(2) }],
  });
  revalidatePath("/erp/comissoes");
  revalidatePath("/erp/repasse-franquia");
}

export async function transferirPendenciaComissaoAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const previsaoId = String(formData.get("previsao_id") ?? "");
  const competenciaDestino = String(formData.get("competencia_destino") ?? "");
  const motivo = String(formData.get("motivo_transferencia") ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaDestino) || !motivo)
    throw new Error("Informe competência destino e motivo da transferência.");
  await transferirPendenciaRecebimento({
    empresaId: empresaAtiva.id,
    previsaoFranquiaId: previsaoId,
    competenciaDestino,
    motivo,
    idempotencyKey: `transferencia:${previsaoId}:${competenciaDestino}`,
  });
  revalidatePath("/erp/comissoes");
}
export async function confirmarPagamentoComissaoAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const id = String(formData.get("previsao_id") ?? "");
  const contaOrigemId = String(formData.get("conta_origem_id") ?? "");
  const contaDestinoId = String(formData.get("conta_destino_id") ?? "") || null;
  const valor = decimal(formData.get("valor"));
  const db = await createClient();
  const { data: p, error } = await db
    .from("comissao_previsoes_participantes")
    .select(
      "participante_comercial_id,organizacao_parceira_id,competencia,valor_elegivel,valor_pago",
    )
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .maybeSingle();
  if (error || !p) throw new Error("Previsão não encontrada.");
  const saldo = Number(p.valor_elegivel) - Number(p.valor_pago);
  if (!contaOrigemId) throw new Error("Selecione a conta bancária de saída.");
  if (!Number.isFinite(valor) || valor <= 0 || valor > saldo)
    throw new Error("Pagamento excede a elegibilidade liberada pela fonte.");
  await registrarPagamentoParticipante({
    empresaId: empresaAtiva.id,
    participanteComercialId: p.participante_comercial_id,
    organizacaoParceiraId: p.organizacao_parceira_id,
    competencia: p.competencia,
    valorBruto: valor.toFixed(2),
    contaBancariaOrigemId: contaOrigemId,
    contaBancariaDestinoId: contaDestinoId,
    idempotencyKey: `pagamento:${id}:${valor.toFixed(2)}:${new Date().toISOString().slice(0, 10)}`,
    itens: [{ previsaoParticipanteId: id, valorLiquidado: valor.toFixed(2) }],
  });
  revalidatePath("/erp/comissoes");
  revalidatePath("/erp/minhas-comissoes");
}

export async function ajustarPrevisaoParticipanteManualAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const previsaoId = String(formData.get("previsao_id") ?? "").trim();
  const valorPrevisto = decimal(formData.get("valor_previsto"));
  const valorElegivel = decimal(formData.get("valor_elegivel"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!previsaoId) throw new Error("Previsão não informada.");
  if (!Number.isFinite(valorPrevisto) || !Number.isFinite(valorElegivel)) {
    throw new Error("Informe valores válidos para gerado e disponível.");
  }
  if (motivo.length < 5) throw new Error("Informe o motivo do ajuste.");
  const db = await createClient();
  const { error } = await db.rpc("rpc_ajustar_previsao_participante_manual", {
    p_empresa_id: empresaAtiva.id,
    p_previsao_id: previsaoId,
    p_valor_previsto: valorPrevisto,
    p_valor_elegivel: valorElegivel,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/comissoes");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/financeiro");
}

export async function confirmarRecebimentosEmLoteAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const ids = formData.getAll("previsao_ids").map(String).filter(Boolean);
  if (!ids.length) throw new Error("Selecione ao menos uma previsão.");
  const db = await createClient();
  const { data, error } = await db
    .from("comissao_previsoes_franquia")
    .select("id,administradora_id,competencia,valor_previsto,valor_liquidado")
    .eq("empresa_id", empresaAtiva.id)
    .in("id", ids);
  if (error || (data?.length ?? 0) !== ids.length)
    throw new Error("Uma ou mais previsões não pertencem à empresa.");
  for (const previsao of data ?? []) {
    const saldo =
      Number(previsao.valor_previsto) - Number(previsao.valor_liquidado);
    if (saldo <= 0) continue;
    await registrarRecebimentoAdministradora({
      empresaId: empresaAtiva.id,
      administradoraId: previsao.administradora_id,
      competencia: previsao.competencia,
      valorTotal: saldo.toFixed(2),
      observacoes: "Confirmação em lote ERP",
      idempotencyKey: `recebimento-lote:${previsao.id}:${saldo.toFixed(2)}`,
      itens: [
        { previsaoFranquiaId: previsao.id, valorLiquidado: saldo.toFixed(2) },
      ],
    });
  }
  revalidatePath("/erp/comissoes");
}

export async function confirmarPagamentosEmLoteAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const ids = formData.getAll("previsao_ids").map(String).filter(Boolean);
  if (!ids.length) throw new Error("Selecione ao menos uma previsão.");
  const db = await createClient();
  const { data, error } = await db
    .from("comissao_previsoes_participantes")
    .select(
      "id,participante_comercial_id,organizacao_parceira_id,competencia,valor_elegivel,valor_pago",
    )
    .eq("empresa_id", empresaAtiva.id)
    .in("id", ids);
  if (error || (data?.length ?? 0) !== ids.length)
    throw new Error("Uma ou mais previsões não pertencem à empresa.");
  const operacaoId = String(formData.get("operacao_id") ?? crypto.randomUUID());
  const contaOrigemId = String(formData.get("conta_origem_id") ?? "");
  const contaDestinoId = String(formData.get("conta_destino_id") ?? "") || null;
  if (!contaOrigemId) throw new Error("Selecione a conta bancária de saída.");
  const grupos = new Map<string, NonNullable<typeof data>>();
  for (const previsao of data ?? []) {
    const chave = `${previsao.participante_comercial_id ?? ""}:${previsao.organizacao_parceira_id ?? ""}:${previsao.competencia}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), previsao]);
  }
  for (const [chave, previsoes] of grupos) {
    const itens = previsoes.map((previsao) => ({
      previsaoParticipanteId: previsao.id,
      valorLiquidado: (Number(previsao.valor_elegivel) - Number(previsao.valor_pago)).toFixed(2),
    })).filter((item) => Number(item.valorLiquidado) > 0);
    if (!itens.length) continue;
    const primeira = previsoes[0];
    const total = itens.reduce((soma, item) => soma + Number(item.valorLiquidado), 0);
    await registrarPagamentoParticipante({
      empresaId: empresaAtiva.id,
      participanteComercialId: primeira.participante_comercial_id,
      organizacaoParceiraId: primeira.organizacao_parceira_id,
      competencia: primeira.competencia,
      valorBruto: total.toFixed(2),
      contaBancariaOrigemId: contaOrigemId,
      contaBancariaDestinoId: contaDestinoId,
      observacoes: `Pagamento agrupado ERP — ${itens.length} comissão(ões)`,
      idempotencyKey: `pagamento-lote:${operacaoId}:${chave}`,
      itens,
    });
  }
  revalidatePath("/erp/comissoes");
  revalidatePath("/erp/minhas-comissoes");
}
