"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import {
  normalizarPedidos,
  gerarIdempotencyKeyRecebimento,
  type SolicitacaoRepasseStatus,
} from "@/lib/erp/repasse-solicitacoes-helpers";

export type ReceiptState = { ok: boolean; message: string; receiptId?: string };
export type SolicitacaoState = { ok: boolean; message: string; solicitacaoId?: string; codigo?: string };

async function context() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");
  const db = await createClient();
  const { data } = await db.rpc("can_write_tenant_internal", {
    p_empresa_id: empresaAtiva.id,
  });
  if (!data) throw new Error("Sem permissão financeira no tenant.");
  return { db, empresaId: empresaAtiva.id };
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
    let codigo = "";
    const { data: rpcCodigo } = await db.rpc("rpc_gerar_codigo_solicitacao_repasse", {
      p_empresa_id: empresaId,
    });
    if (rpcCodigo) {
      codigo = String(rpcCodigo);
    } else {
      const ano = new Date().getFullYear();
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      codigo = `REP-${ano}-${String(randomSeq).padStart(6, "0")}`;
    }

    // 2. Upload da Nota Fiscal (se enviada)
    let arquivoNfUrl: string | null = null;
    let arquivoNfNome: string | null = null;
    const fileNf = formData.get("arquivo_nf") as File | null;
    if (fileNf && fileNf.size > 0) {
      const ext = fileNf.name.split(".").pop() || "pdf";
      const storagePath = `${empresaId}/solicitacoes/${codigo}/nf_${Date.now()}.${ext}`;
      const arrayBuffer = await fileNf.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await db.storage
        .from("repasse-documentos")
        .upload(storagePath, buffer, {
          contentType: fileNf.type,
          upsert: true,
        });

      if (!uploadError) {
        arquivoNfUrl = storagePath;
        arquivoNfNome = fileNf.name;
      }
    }

    // 3. Upload de Pedidos (se enviado)
    let arquivoPedidosUrl: string | null = null;
    let arquivoPedidosNome: string | null = null;
    const filePedidos = formData.get("arquivo_pedidos") as File | null;
    if (filePedidos && filePedidos.size > 0) {
      const ext = filePedidos.name.split(".").pop() || "pdf";
      const storagePath = `${empresaId}/solicitacoes/${codigo}/pedidos_${Date.now()}.${ext}`;
      const arrayBuffer = await filePedidos.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await db.storage
        .from("repasse-documentos")
        .upload(storagePath, buffer, {
          contentType: filePedidos.type,
          upsert: true,
        });

      if (!uploadError) {
        arquivoPedidosUrl = storagePath;
        arquivoPedidosNome = filePedidos.name;
      }
    }

    // 4. Inserir a Solicitação
    const { data: insertedSolic, error: insertError } = await db
      .from("erp_solicitacoes_repasse")
      .insert({
        empresa_id: empresaId,
        codigo_solicitacao: codigo,
        administradora_id: administradoraId,
        mes_referencia: mesReferencia,
        data_solicitacao: new Date().toISOString().slice(0, 10),
        valor_solicitado: valorSolicitado,
        numero_nota_fiscal: numeroNotaFiscal,
        data_nota_fiscal: dataNotaFiscal,
        valor_nota_fiscal: valorNotaFiscal,
        arquivo_nf_url: arquivoNfUrl,
        arquivo_nf_nome: arquivoNfNome,
        arquivo_pedidos_url: arquivoPedidosUrl,
        arquivo_pedidos_nome: arquivoPedidosNome,
        observacao: observacao,
        status: statusInicial,
      })
      .select("id, codigo_solicitacao")
      .single();

    if (insertError || !insertedSolic) {
      throw new Error(insertError?.message || "Erro ao salvar solicitação de repasse.");
    }

    const solicitacaoId = insertedSolic.id;

    // 5. Inserir os Pedidos individualizados
    const pedidosRows = pedidos.map((p) => ({
      empresa_id: empresaId,
      solicitacao_id: solicitacaoId,
      numero_pedido: p,
      arquivo_url: arquivoPedidosUrl,
      arquivo_nome: arquivoPedidosNome,
    }));

    await db.from("erp_solicitacao_repasse_pedidos").insert(pedidosRows);

    // 6. Gravar histórico inicial
    await db.from("erp_solicitacao_repasse_historico").insert({
      empresa_id: empresaId,
      solicitacao_id: solicitacaoId,
      acao: statusInicial === "SOLICITADO" ? "CRIACAO_E_ENVIO" : "CRIACAO_RASCUNHO",
      estado_novo: {
        codigo,
        status: statusInicial,
        valor_solicitado: valorSolicitado,
        pedidos_count: pedidos.length,
        numero_nota_fiscal: numeroNotaFiscal,
      },
      motivo: "Solicitação de repasse criada pelo usuário.",
    });

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

    if (atual.status === "RECEBIDO" && novoStatus !== "RECEBIDO") {
      throw new Error("Não é permitido alterar o status de uma solicitação com recebimento já liquidado.");
    }

    const { error: updateError } = await db
      .from("erp_solicitacoes_repasse")
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", solicitacaoId)
      .eq("empresa_id", empresaId);

    if (updateError) throw new Error(updateError.message);

    await db.from("erp_solicitacao_repasse_historico").insert({
      empresa_id: empresaId,
      solicitacao_id: solicitacaoId,
      acao: "ALTERACAO_STATUS",
      estado_anterior: { status: atual.status },
      estado_novo: { status: novoStatus },
      motivo: motivo || `Status alterado de ${atual.status} para ${novoStatus}.`,
    });

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

    // Tentar executar via RPC segura
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

    if (rpcError) {
      // Fallback transacional caso a migration ainda não esteja compilada no banco
      const { data: solic } = await db
        .from("erp_solicitacoes_repasse")
        .select("*")
        .eq("id", solicitacaoId)
        .eq("empresa_id", empresaId)
        .single();

      if (!solic) throw new Error(rpcError.message);

      if (solic.recebimento_id) {
        return {
          ok: true,
          message: "Esta solicitação já possui recebimento financeiro registrado.",
          receiptId: solic.recebimento_id,
        };
      }

      // Executa registro no motor canônico
      const { data: recData, error: recError } = await db.rpc("rpc_registrar_recebimento_manual", {
        p_empresa_id: empresaId,
        p_administradora_id: solic.administradora_id,
        p_competencia: solic.mes_referencia,
        p_valor_total: valorRecebido,
        p_data_recebimento: dataRecebimento,
        p_conta_entrada: contaEntrada,
        p_idempotency_key: idempotencyKey,
        p_conta_bancaria_id: contaBancariaId,
        p_numero_nota_fiscal: solic.numero_nota_fiscal,
        p_data_nota_fiscal: solic.data_nota_fiscal,
        p_descricao: descricao || `Recebimento via Solicitação ${solic.codigo_solicitacao}`,
        p_observacoes: observacoes,
      });

      if (recError) throw new Error(recError.message);

      const result = recData as { recebimento?: { id?: string } };
      const recebimentoId = result.recebimento?.id;

      if (recebimentoId) {
        await db
          .from("erp_solicitacoes_repasse")
          .update({
            recebimento_id: recebimentoId,
            status: "RECEBIDO",
            updated_at: new Date().toISOString(),
          })
          .eq("id", solicitacaoId)
          .eq("empresa_id", empresaId);

        await db.from("erp_solicitacao_repasse_historico").insert({
          empresa_id: empresaId,
          solicitacao_id: solicitacaoId,
          acao: "REGISTRO_RECEBIMENTO",
          estado_novo: { status: "RECEBIDO", recebimento_id: recebimentoId, valor_recebido: valorRecebido },
          motivo: "Recebimento financeiro registrado no Caixa.",
        });
      }

      revalidatePath("/erp/repasse-franquia");

      return {
        ok: true,
        message: "Recebimento financeiro registrado e solicitação marcada como RECEBIDA com sucesso!",
        receiptId: recebimentoId,
      };
    }

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

    const { data, error } = await db.storage
      .from("repasse-documentos")
      .createSignedUrl(storagePath, 60 * 60); // 1 hora de expiração

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
