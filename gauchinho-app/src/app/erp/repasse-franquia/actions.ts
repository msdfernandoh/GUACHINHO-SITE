"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import {
  normalizarPedidos,
  gerarIdempotencyKeyRecebimento,
  type SolicitacaoRepasseStatus,
} from "@/lib/erp/repasse-solicitacoes-helpers";
import { parseRepasseRaconText } from "@/lib/erp/repasse-racon-parser";

export type ReceiptState = { ok: boolean; message: string; receiptId?: string };
export type SolicitacaoState = { ok: boolean; message: string; solicitacaoId?: string; codigo?: string };
export type ImportacaoRepasseState = { ok: boolean; message: string; importacaoId?: string };
export type AtencaoRepasseState = { ok: boolean; message: string };

async function context() {
  await requireErpRouteAccess("repasse-franquia");
  const { empresaAtiva } = await requireTenantPermission("gerenciar_financeiro");
  const db = await createClient();
  return { db, empresaId: empresaAtiva.id };
}

const MAX_REPASSE_FILE_SIZE = 15 * 1024 * 1024;
const REPASSE_FILE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function importarRelatorioRepasseRaconAction(
  _previous: ImportacaoRepasseState,
  formData: FormData,
): Promise<ImportacaoRepasseState> {
  let storagePath: string | null = null;
  try {
    const { db, empresaId } = await context();
    const file = formData.get("arquivo_pdf") as File | null;
    const competencia = String(formData.get("competencia") ?? "");
    const administradoraId = String(formData.get("administradora_id") ?? "");
    const dataRecebimento = String(formData.get("data_recebimento") ?? "");
    const contaEntrada = String(formData.get("conta_entrada") ?? "Caixa geral").trim();
    const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "").trim() || null;
    if (!file || file.size <= 0) throw new Error("Selecione o PDF de repasse.");
    if (file.type !== "application/pdf") throw new Error("O relatório de repasse deve ser um arquivo PDF.");
    if (file.size > MAX_REPASSE_FILE_SIZE) throw new Error("O PDF deve ter no máximo 15 MB.");
    if (!administradoraId) throw new Error("Selecione a administradora.");
    if (!dataRecebimento) throw new Error("Informe a data da entrada do repasse.");
    if (contaEntrada.length < 2) throw new Error("Informe a conta/caixa de entrada.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    const parsed = parseRepasseRaconText(String(extracted.text), competencia);

    storagePath = `${empresaId}/conciliacoes/${competencia}/${hash}.pdf`;
    const { error: uploadError } = await db.storage.from("repasse-documentos").upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
      throw new Error(`Falha ao guardar o PDF: ${uploadError.message}`);
    }

    const { data, error } = await db.rpc("rpc_importar_repasse_racon", {
      p_empresa_id: empresaId,
      p_administradora_id: administradoraId,
      p_competencia: competencia,
      p_arquivo_nome: file.name.slice(0, 255),
      p_arquivo_path: storagePath,
      p_arquivo_hash: hash,
      p_relatorio: parsed,
      p_data_recebimento: dataRecebimento,
      p_conta_entrada: contaEntrada,
      p_conta_bancaria_id: contaBancariaId,
    });
    if (error) throw new Error(error.message);
    const result = data as { importacao_id?: string; idempotente?: boolean; vinculados_auto?: number; atencao?: number; nao_encontrados?: number };
    let leituraAtualizada: { vinculados_auto?: number; atencao?: number; nao_encontrados?: number } | null = null;
    if (result.idempotente && result.importacao_id) {
      const { data: refreshData, error: refreshError } = await db.rpc("rpc_reprocessar_repasse_racon", {
        p_empresa_id: empresaId,
        p_importacao_id: result.importacao_id,
      });
      if (refreshError) throw new Error(`O PDF foi localizado, mas a leitura não pôde ser atualizada: ${refreshError.message}`);
      leituraAtualizada = refreshData as { vinculados_auto?: number; atencao?: number; nao_encontrados?: number };
    }
    revalidatePath("/erp/repasse-franquia");
    revalidatePath("/erp/comissoes");
    revalidatePath("/erp/minhas-comissoes");
    return {
      ok: true,
      importacaoId: result.importacao_id,
      message: result.idempotente
        ? `Este PDF já estava salvo. A leitura foi atualizada sem duplicar a entrada: ${leituraAtualizada?.vinculados_auto ?? 0} novo(s) vínculo(s), ${leituraAtualizada?.atencao ?? 0} atenção(ões) e ${leituraAtualizada?.nao_encontrados ?? 0} não encontrado(s).`
        : `Repasse importado. ${result.vinculados_auto ?? 0} linhas vinculadas e baixadas automaticamente, ${result.atencao ?? 0} com atenção e ${result.nao_encontrados ?? 0} antigas/não encontradas.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao importar o PDF de repasse." };
  }
}

export async function vincularItemRepasseManualAction(
  _previous: ImportacaoRepasseState,
  formData: FormData,
): Promise<ImportacaoRepasseState> {
  try {
    const { db, empresaId } = await context();
    const itemId = String(formData.get("item_id") ?? "");
    const previsaoId = String(formData.get("previsao_franquia_id") ?? "");
    if (!itemId || !previsaoId) throw new Error("Selecione a linha e a comissão do sistema.");
    const { data: itemAtual, error: itemError } = await db
      .from("erp_repasse_importacao_itens")
      .select("previsao_franquia_id,importacao:erp_repasse_importacoes!inner(recebimento_id)")
      .eq("empresa_id", empresaId)
      .eq("id", itemId)
      .single();
    if (itemError || !itemAtual) throw new Error("Linha do relatório não encontrada no tenant.");
    const importacao = Array.isArray(itemAtual.importacao) ? itemAtual.importacao[0] : itemAtual.importacao;
    if (itemAtual.previsao_franquia_id && itemAtual.previsao_franquia_id !== previsaoId && importacao?.recebimento_id) {
      const { count, error: baixaError } = await db
        .from("financeiro_recebimento_itens")
        .select("id", { count: "exact", head: true })
        .eq("recebimento_id", importacao.recebimento_id)
        .eq("previsao_franquia_id", itemAtual.previsao_franquia_id);
      if (baixaError) throw new Error("Não foi possível conferir a baixa financeira do vínculo.");
      if ((count ?? 0) > 0) throw new Error("Este vínculo já possui baixa financeira. Estorne o recebimento antes de trocar a previsão; o livro financeiro não pode ser reescrito.");
    }
    const { error } = await db.rpc("rpc_vincular_item_repasse_manual", {
      p_empresa_id: empresaId,
      p_item_id: itemId,
      p_previsao_franquia_id: previsaoId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    revalidatePath("/erp/comissoes");
    revalidatePath("/erp/minhas-comissoes");
    return { ok: true, message: "Linha vinculada e recebimento baixado automaticamente." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao vincular a linha." };
  }
}

export async function confirmarConciliacaoRepasseAction(
  _previous: ImportacaoRepasseState,
  formData: FormData,
): Promise<ImportacaoRepasseState> {
  try {
    const { db, empresaId } = await context();
    const importacaoId = String(formData.get("importacao_id") ?? "");
    if (!importacaoId) throw new Error("Importação não informada.");
    const { data, error } = await db.rpc("rpc_confirmar_conciliacao_repasse", {
      p_empresa_id: empresaId,
      p_importacao_id: importacaoId,
    });
    if (error) throw new Error(error.message);
    const result = data as { confirmado?: boolean; motivo?: string; idempotente?: boolean };
    revalidatePath("/erp/repasse-franquia");
    return {
      ok: Boolean(result.confirmado),
      importacaoId,
      message: result.confirmado
        ? result.idempotente ? "Este repasse já estava confirmado." : "Regras conferidas, repasse conciliado e comissões liberadas."
        : result.motivo || "A conciliação voltou para atenção.",
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao confirmar a conciliação." };
  }
}

export async function reprocessarRelatorioRepasseAction(
  _previous: ImportacaoRepasseState,
  formData: FormData,
): Promise<ImportacaoRepasseState> {
  try {
    const { db, empresaId } = await context();
    const importacaoId = String(formData.get("importacao_id") ?? "").trim();
    if (!importacaoId) throw new Error("Relatório não informado.");
    const { data, error } = await db.rpc("rpc_reprocessar_repasse_racon", {
      p_empresa_id: empresaId,
      p_importacao_id: importacaoId,
    });
    if (error) throw new Error(error.message);
    const result = data as { vinculados_auto?: number; atencao?: number; nao_encontrados?: number };
    revalidatePath("/erp/repasse-franquia");
    return {
      ok: true,
      importacaoId,
      message: `Leitura atualizada sem novo upload ou entrada financeira: ${result.vinculados_auto ?? 0} novo(s) vínculo(s), ${result.atencao ?? 0} atenção(ões) e ${result.nao_encontrados ?? 0} não encontrado(s).`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar a leitura." };
  }
}

export async function resolverAtencaoRepasseAction(
  _previous: AtencaoRepasseState,
  formData: FormData,
): Promise<AtencaoRepasseState> {
  try {
    const { db, empresaId } = await context();
    const previsaoId = String(formData.get("previsao_franquia_id") ?? "").trim();
    const decisao = String(formData.get("decisao") ?? "").trim();
    const importacaoId = String(formData.get("importacao_id") ?? "").trim() || null;
    const itemId = String(formData.get("item_importacao_id") ?? "").trim() || null;
    const motivo = String(formData.get("motivo") ?? "").trim() || null;
    const valorAjusteRaw = String(formData.get("valor_ajuste") ?? "").trim().replace(",", ".");
    const valorAjuste = valorAjusteRaw ? Number(valorAjusteRaw) : null;
    const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();
    if (!previsaoId || !decisao) throw new Error("Comissão e decisão são obrigatórias.");
    if (valorAjuste !== null && (!Number.isFinite(valorAjuste) || valorAjuste <= 0)) {
      throw new Error("Informe um valor de ajuste válido.");
    }
    const { data, error } = await db.rpc("rpc_resolver_atencao_repasse", {
      p_empresa_id: empresaId,
      p_previsao_franquia_id: previsaoId,
      p_decisao: decisao,
      p_importacao_id: importacaoId,
      p_item_importacao_id: itemId,
      p_valor_ajuste: valorAjuste,
      p_motivo: motivo,
      p_idempotency_key: idempotencyKey || `${decisao}:${previsaoId}:${itemId ?? "sem-item"}`,
    });
    if (error) throw new Error(error.message);
    const result = data as { decisao?: string; idempotente?: boolean; diferenca?: number };
    const labels: Record<string, string> = {
      AGUARDAR_PROXIMO: "Comissão mantida para conferência no próximo relatório.",
      GERAR_CREDITO: "Valor do relatório baixado e diferença mantida como crédito pendente.",
      AJUSTAR_DIFERENCA: "Sistema ajustado para considerar o valor do relatório nesta conciliação.",
      MANTER_COMO_ESTA: "Divergência encerrada mantendo os valores atuais como estão.",
      CANCELAR_COTA: "Cota cancelada e curva de estorno aplicada.",
    };
    revalidatePath("/erp/repasse-franquia");
    revalidatePath("/erp/comissoes");
    revalidatePath("/erp/minhas-comissoes");
    revalidatePath("/erp/vendas");
    return { ok: true, message: result.idempotente ? "Esta decisão já havia sido registrada." : labels[result.decisao ?? decisao] ?? "Atenção resolvida." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível resolver a atenção." };
  }
}

export async function lancarItemRepasseLegadoAction(
  _previous: ImportacaoRepasseState,
  formData: FormData,
): Promise<ImportacaoRepasseState> {
  try {
    const { db, empresaId } = await context();
    const itemId = String(formData.get("item_id") ?? "");
    const participanteId = String(formData.get("participante_id") ?? "");
    const clienteNome = String(formData.get("cliente_nome") ?? "").trim();
    const grupoId = String(formData.get("grupo_id") ?? "").trim() || null;
    const numeroGrupo = String(formData.get("numero_grupo") ?? "").trim();
    const numeroCota = String(formData.get("numero_cota") ?? "").trim();
    if (!itemId || !participanteId || !clienteNome || !numeroGrupo || !numeroCota) {
      throw new Error("Informe cliente, grupo, cota e consultor.");
    }
    const { error } = await db.rpc("rpc_lancar_item_repasse_legado", {
      p_empresa_id: empresaId,
      p_item_id: itemId,
      p_participante_id: participanteId,
      p_regra_participante_id: null,
      p_sem_regra: true,
      p_cliente_nome: clienteNome,
      p_grupo_id: grupoId,
      p_numero_grupo: numeroGrupo,
      p_numero_cota: numeroCota,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    revalidatePath("/erp/minhas-comissoes");
    return { ok: true, message: "Cliente, cota, comissão e vínculo criados. A linha foi resolvida; CPF/CNPJ e telefone permanecem apenas como aviso no cadastro do cliente." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao lançar a comissão antiga." };
  }
}

function validarArquivoRepasse(file: File, label: string): string {
  if (file.size <= 0 || file.size > MAX_REPASSE_FILE_SIZE) {
    throw new Error(`${label}: o arquivo deve ter no máximo 15 MB.`);
  }
  const extension = REPASSE_FILE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error(`${label}: envie PDF, JPG, PNG ou WEBP.`);
  }
  return extension;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO A: SOLICITAÇÕES DE REPASSE
// ─────────────────────────────────────────────────────────────────────────────

export async function criarSolicitacaoRepasseAction(
  _previous: SolicitacaoState,
  formData: FormData
): Promise<SolicitacaoState> {
  try {
    const { db, empresaId } = await context();

    const administradoraId = String(formData.get("administradora_id") ?? "");
    const mesReferencia = String(formData.get("mes_referencia") ?? "");
    const pedidosRaw = String(formData.get("pedidos_raw") ?? "");
    const valorSolicitadoStr = String(formData.get("valor_solicitado") ?? "").replace(",", ".");
    const valorSolicitado = parseFloat(valorSolicitadoStr);

    if (!administradoraId) throw new Error("Selecione uma administradora.");
    if (!mesReferencia || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(mesReferencia)) {
      throw new Error("Mês de referência inválido (esperado AAAA-MM).");
    }
    if (isNaN(valorSolicitado) || valorSolicitado <= 0) {
      throw new Error("Valor solicitado inválido.");
    }

    const pedidos = normalizarPedidos(pedidosRaw);
    if (pedidos.length === 0) {
      throw new Error("Informe ao menos um número de pedido.");
    }

    const numeroNotaFiscal = String(formData.get("numero_nota_fiscal") ?? "").trim() || null;
    const dataNotaFiscal = String(formData.get("data_nota_fiscal") ?? "").trim() || null;
    const valorNotaFiscalStr = String(formData.get("valor_nota_fiscal") ?? "").replace(",", ".").trim();
    const valorNotaFiscal = valorNotaFiscalStr ? parseFloat(valorNotaFiscalStr) : null;
    const observacao = String(formData.get("observacao") ?? "").trim() || null;
    const statusInicial: SolicitacaoRepasseStatus =
      formData.get("status") === "SOLICITADO" ? "SOLICITADO" : "RASCUNHO";

    // 1. Gerar código único da solicitação (ex: REP-2026-000001)
    const { data: rpcCodigo, error: codigoError } = await db.rpc("rpc_gerar_codigo_solicitacao_repasse", {
      p_empresa_id: empresaId,
    });
    if (codigoError || !rpcCodigo) throw new Error(codigoError?.message || "Não foi possível gerar o código da solicitação.");
    const codigo = String(rpcCodigo);
    const uploadedPaths: string[] = [];

    // 2. Upload da Nota Fiscal (se enviada)
    let arquivoNfUrl: string | null = null;
    let arquivoNfNome: string | null = null;
    const fileNf = formData.get("arquivo_nf") as File | null;
    if (fileNf && fileNf.size > 0) {
      const ext = validarArquivoRepasse(fileNf, "Nota fiscal");
      const storagePath = `${empresaId}/solicitacoes/${codigo}/nf_${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await fileNf.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await db.storage
        .from("repasse-documentos")
        .upload(storagePath, buffer, {
          contentType: fileNf.type,
          upsert: false,
        });
      if (uploadError) throw new Error(`Falha ao enviar a nota fiscal: ${uploadError.message}`);
      uploadedPaths.push(storagePath);
      arquivoNfUrl = storagePath;
      arquivoNfNome = fileNf.name.slice(0, 255);
    }

    // 3. Upload de Pedidos (se enviado)
    let arquivoPedidosUrl: string | null = null;
    let arquivoPedidosNome: string | null = null;
    const filePedidos = formData.get("arquivo_pedidos") as File | null;
    if (filePedidos && filePedidos.size > 0) {
      const ext = validarArquivoRepasse(filePedidos, "Arquivo de pedidos");
      const storagePath = `${empresaId}/solicitacoes/${codigo}/pedidos_${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await filePedidos.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await db.storage
        .from("repasse-documentos")
        .upload(storagePath, buffer, {
          contentType: filePedidos.type,
          upsert: false,
        });
      if (uploadError) {
        if (uploadedPaths.length) await db.storage.from("repasse-documentos").remove(uploadedPaths);
        throw new Error(`Falha ao enviar o arquivo de pedidos: ${uploadError.message}`);
      }
      uploadedPaths.push(storagePath);
      arquivoPedidosUrl = storagePath;
      arquivoPedidosNome = filePedidos.name.slice(0, 255);
    }

    // 4. Solicitação, pedidos e histórico são persistidos na mesma transação SQL.
    const { data: created, error: insertError } = await db.rpc("rpc_criar_solicitacao_repasse", {
      p_empresa_id: empresaId,
      p_codigo_solicitacao: codigo,
      p_administradora_id: administradoraId,
      p_mes_referencia: mesReferencia,
      p_valor_solicitado: valorSolicitado,
      p_pedidos: pedidos,
      p_status: statusInicial,
      p_numero_nota_fiscal: numeroNotaFiscal,
      p_data_nota_fiscal: dataNotaFiscal,
      p_valor_nota_fiscal: valorNotaFiscal,
      p_arquivo_nf_url: arquivoNfUrl,
      p_arquivo_nf_nome: arquivoNfNome,
      p_arquivo_pedidos_url: arquivoPedidosUrl,
      p_arquivo_pedidos_nome: arquivoPedidosNome,
      p_observacao: observacao,
    });
    if (insertError) {
      if (uploadedPaths.length) await db.storage.from("repasse-documentos").remove(uploadedPaths);
      throw new Error(insertError.message);
    }
    const createdResult = created as { solicitacao?: { id?: string } } | null;
    const solicitacaoId = createdResult?.solicitacao?.id;
    if (!solicitacaoId) throw new Error("A transação não retornou a solicitação criada.");

    revalidatePath("/erp/repasse-franquia");

    return {
      ok: true,
      message: `Solicitação ${codigo} cadastrada com sucesso (${statusInicial}).`,
      solicitacaoId,
      codigo,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao criar solicitação de repasse.",
    };
  }
}

export async function alterarStatusSolicitacaoAction(
  _previous: SolicitacaoState,
  formData: FormData
): Promise<SolicitacaoState> {
  try {
    const { db, empresaId } = await context();
    const solicitacaoId = String(formData.get("solicitacao_id") ?? "");
    const novoStatus = String(formData.get("status") ?? "") as SolicitacaoRepasseStatus;
    const motivo = String(formData.get("motivo") ?? "").trim() || null;

    if (!solicitacaoId) throw new Error("ID da solicitação não informado.");
    if (!novoStatus) throw new Error("Novo status não informado.");

    const { data: atual, error: buscaError } = await db
      .from("erp_solicitacoes_repasse")
      .select("id, codigo_solicitacao, status, recebimento_id")
      .eq("id", solicitacaoId)
      .eq("empresa_id", empresaId)
      .single();

    if (buscaError || !atual) throw new Error("Solicitação não encontrada no tenant.");

    const { error: updateError } = await db.rpc("rpc_alterar_status_solicitacao_repasse", {
      p_empresa_id: empresaId,
      p_solicitacao_id: solicitacaoId,
      p_novo_status: novoStatus,
      p_motivo: motivo,
    });
    if (updateError) throw new Error(updateError.message);

    revalidatePath("/erp/repasse-franquia");

    return {
      ok: true,
      message: `Status da solicitação ${atual.codigo_solicitacao} atualizado para ${novoStatus}.`,
      solicitacaoId,
      codigo: atual.codigo_solicitacao,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao alterar status da solicitação.",
    };
  }
}

export async function registrarRecebimentoSolicitacaoAction(
  _previous: ReceiptState,
  formData: FormData
): Promise<ReceiptState> {
  try {
    const { db, empresaId } = await context();

    const solicitacaoId = String(formData.get("solicitacao_id") ?? "");
    const dataRecebimento = String(formData.get("data_recebimento") ?? "");
    const valorRecebido = parseFloat(String(formData.get("valor_recebido") ?? "").replace(",", "."));
    const contaEntrada = String(formData.get("conta_entrada") ?? "Caixa geral").trim();
    const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "").trim() || null;
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
    const idempotencyKey =
      String(formData.get("idempotency_key") ?? "").trim() || gerarIdempotencyKeyRecebimento(solicitacaoId);

    if (!solicitacaoId) throw new Error("Solicitação de repasse não informada.");
    if (!dataRecebimento) throw new Error("Data de recebimento é obrigatória.");
    if (isNaN(valorRecebido) || valorRecebido <= 0) throw new Error("Valor recebido inválido.");

    const { data: rpcRes, error: rpcError } = await db.rpc(
      "rpc_registrar_recebimento_solicitacao_repasse",
      {
        p_empresa_id: empresaId,
        p_solicitacao_id: solicitacaoId,
        p_data_recebimento: dataRecebimento,
        p_valor_recebido: valorRecebido,
        p_conta_entrada: contaEntrada,
        p_conta_bancaria_id: contaBancariaId,
        p_idempotency_key: idempotencyKey,
        p_descricao: descricao,
        p_observacoes: observacoes,
      }
    );

    if (rpcError) throw new Error(rpcError.message);

    revalidatePath("/erp/repasse-franquia");

    const result = rpcRes as { recebimento_id?: string; reused?: boolean };

    return {
      ok: true,
      message: result.reused
        ? "Esta solicitação já possuía recebimento registrado; nenhuma duplicidade gerada."
        : "Recebimento financeiro registrado e solicitação marcada como RECEBIDA com sucesso!",
      receiptId: result.recebimento_id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao registrar recebimento da solicitação.",
    };
  }
}

export async function obterUrlDocumentoRepasseAction(storagePath: string): Promise<string | null> {
  try {
    const { db, empresaId } = await context();
    if (!storagePath) return null;

    // Garantir isolamento multi-tenant: path deve iniciar pelo empresaId
    if (!storagePath.startsWith(empresaId + "/")) {
      throw new Error("Acesso não autorizado a este documento.");
    }

    const [{ data: solicitacao }, { data: pedido }] = await Promise.all([
      db.from("erp_solicitacoes_repasse").select("id").eq("empresa_id", empresaId).or(`arquivo_nf_url.eq.${storagePath},arquivo_pedidos_url.eq.${storagePath}`).limit(1).maybeSingle(),
      db.from("erp_solicitacao_repasse_pedidos").select("id").eq("empresa_id", empresaId).eq("arquivo_url", storagePath).limit(1).maybeSingle(),
    ]);
    if (!solicitacao && !pedido) throw new Error("Documento não está vinculado a um repasse desta empresa.");

    const { data, error } = await db.storage
      .from("repasse-documentos")
      .createSignedUrl(storagePath, 5 * 60);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO B: RECEBIMENTO DIRETO & CONCILIAÇÃO (MOTOR CANÔNICO PRESERVADO)
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarRecebimentoManualAction(
  _previous: ReceiptState,
  formData: FormData
): Promise<ReceiptState> {
  try {
    const { db, empresaId } = await context();
    const { data, error } = await db.rpc("rpc_registrar_recebimento_manual", {
      p_empresa_id: empresaId,
      p_administradora_id: String(formData.get("administradora_id") ?? ""),
      p_competencia: String(formData.get("competencia") ?? ""),
      p_valor_total: Number(String(formData.get("valor_total") ?? "").replace(",", ".")),
      p_data_recebimento: String(formData.get("data_recebimento") ?? ""),
      p_conta_entrada: String(formData.get("conta_entrada") ?? ""),
      p_idempotency_key: String(formData.get("idempotency_key") ?? ""),
      p_conta_bancaria_id: String(formData.get("conta_bancaria_id") ?? "") || null,
      p_numero_nota_fiscal: String(formData.get("numero_nota_fiscal") ?? "") || null,
      p_data_nota_fiscal: String(formData.get("data_nota_fiscal") ?? "") || null,
      p_descricao: String(formData.get("descricao") ?? "") || null,
      p_observacoes: String(formData.get("observacoes") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    const result = data as { recebimento?: { id?: string }; reused?: boolean };
    return {
      ok: true,
      message: result.reused
        ? "Recebimento já registrado; nenhuma entrada de Caixa foi duplicada."
        : "Recebimento real registrado. Agora classifique ou concilie o saldo.",
      receiptId: result.recebimento?.id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao registrar recebimento.",
    };
  }
}

export async function conciliarRecebimentoManualAction(
  _previous: ReceiptState,
  formData: FormData
): Promise<ReceiptState> {
  try {
    const { db, empresaId } = await context();
    let itens: unknown;
    let classificacoes: unknown;
    try {
      itens = JSON.parse(String(formData.get("itens") ?? "[]"));
      classificacoes = JSON.parse(String(formData.get("classificacoes") ?? "[]"));
    } catch {
      throw new Error("Composição inválida.");
    }
    const id = String(formData.get("recebimento_id") ?? "");
    const { data, error } = await db.rpc("rpc_conciliar_recebimento_manual", {
      p_empresa_id: empresaId,
      p_recebimento_id: id,
      p_itens: itens,
      p_classificacoes: classificacoes,
      p_idempotency_key: String(formData.get("idempotency_key") ?? ""),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    const result = data as {
      status?: string;
      saldo?: number;
      reused?: boolean;
    };
    return {
      ok: true,
      message: result.reused
        ? "Conciliação já processada sem duplicidade."
        : `Conciliação salva: ${result.status}. Saldo R$ ${Number(result.saldo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      receiptId: id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao conciliar recebimento.",
    };
  }
}
