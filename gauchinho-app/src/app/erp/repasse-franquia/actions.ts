"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import {
  normalizarPedidos,
  gerarIdempotencyKeyRecebimento,
  type SolicitacaoRepasseStatus,
} from "@/lib/erp/repasse-solicitacoes-helpers";

export type ReceiptState = { ok: boolean; message: string; receiptId?: string };
export type SolicitacaoState = { ok: boolean; message: string; solicitacaoId?: string; codigo?: string };

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
