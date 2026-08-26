"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { parseContasPagarCsv } from "@/lib/financeiro/contas-pagar-csv";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { canAccessErpRoute } from "@/lib/erp/erp-acesso";

export type ContasActionResult = {
  ok: boolean;
  message: string;
  importacao?: { importadas: number; duplicadas: number; invalidas: number; erros: string[] };
};

export type DocumentoFinanceiroResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

function failure(error: unknown): ContasActionResult {
  return { ok: false, message: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
}

async function requireFinanceWrite() {
  const { empresaAtiva, vinculos, vinculoAtivo } = await requireTenantPermission("gerenciar_financeiro");
  const vinculo = vinculoAtivo ?? vinculos.find((item) => item.empresa_id === empresaAtiva.id);
  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  if (!canAccessErpRoute(config, vinculo?.erp_modulos_visiveis, "contas-pagar")) {
    throw new Error("Este usuário não possui acesso ao menu Contas a pagar e caixa.");
  }
  const session = await createClient();
  const { data: canWrite, error } = await session.rpc("can_write_tenant_internal", {
    p_empresa_id: empresaAtiva.id,
  });
  if (error || !canWrite) throw new Error("Você não tem permissão para alterar o financeiro desta empresa.");
  return { empresaId: empresaAtiva.id, session, admin: createAdminClient() };
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}


async function ensureContasBucket(admin: ReturnType<typeof createAdminClient>) {
  try {
    await admin.storage.createBucket("contas-pagar-documentos", {
      public: false,
      fileSizeLimit: 20971520,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/xml", "application/xml"],
    });
  } catch {
    // bucket may already exist
  }
  const { error } = await admin.storage.updateBucket("contas-pagar-documentos", {
    public: false,
    fileSizeLimit: 20971520,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/xml", "application/xml"],
  });
  if (error) throw new Error(`Não foi possível proteger o armazenamento financeiro: ${error.message}`);
}

const CONTAS_BUCKET = "contas-pagar-documentos";
const CONTAS_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/xml",
  "application/xml",
]);

function storagePathFromReference(reference: string | null | undefined): string | null {
  const raw = String(reference ?? "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "");
  try {
    const pathname = decodeURIComponent(new URL(raw).pathname);
    const markers = [
      `/storage/v1/object/public/${CONTAS_BUCKET}/`,
      `/storage/v1/object/sign/${CONTAS_BUCKET}/`,
      `/storage/v1/object/${CONTAS_BUCKET}/`,
    ];
    for (const marker of markers) {
      const index = pathname.indexOf(marker);
      if (index >= 0) return pathname.slice(index + marker.length).replace(/^\/+/, "");
    }
  } catch {
    return null;
  }
  return null;
}

function assertStoragePathEmpresa(path: string, empresaId: string) {
  if (!path.startsWith(`${empresaId}/`)) {
    throw new Error("O documento financeiro não pertence à empresa ativa.");
  }
}

async function removeStoredDocument(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  reference: string | null | undefined,
) {
  const path = storagePathFromReference(reference);
  if (!path) return;
  assertStoragePathEmpresa(path, empresaId);
  const { error } = await admin.storage.from(CONTAS_BUCKET).remove([path]);
  if (error) console.warn("Não foi possível remover o arquivo financeiro órfão:", error.message);
}

async function uploadNotaFiscal(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  file: File | null
): Promise<{ url: string; nome: string } | null> {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (file.size > 20 * 1024 * 1024) throw new Error("O documento deve ter no máximo 20 MB.");
  if (!CONTAS_ALLOWED_MIME.has(file.type)) {
    throw new Error("Formato inválido. Envie PDF, JPG, PNG, WEBP ou XML.");
  }
  await ensureContasBucket(admin);
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${empresaId}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}_${cleanName || `documento.${ext}`}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await admin.storage
    .from(CONTAS_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Erro storage contas-pagar-documentos:", error);
    throw new Error(`Falha no upload da Nota Fiscal: ${error.message}`);
  }

  return {
    url: filePath,
    nome: file.name,
  };
}

async function assertTenantReference(
  admin: ReturnType<typeof createAdminClient>,
  table: "financeiro_centros_custo" | "financeiro_contas_bancarias" | "financeiro_fornecedores",
  empresaId: string,
  id: string | null,
  label: string,
) {
  if (!id) return;
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) throw new Error(`${label} não pertence à empresa ativa.`);
}

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function criarBanco(form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do banco para exibição.");
    const { error } = await admin.from("financeiro_contas_bancarias").insert({
      empresa_id: empresaId,
      nome,
      banco: value(form, "banco") || null,
      agencia: value(form, "agencia") || null,
      conta_mascarada: value(form, "conta") || null,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("Já existe um banco com esse nome.");
      throw new Error(error.message);
    }
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Banco salvo com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function criarCentro(form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do centro de custo.");
    const descontadoComissao = form.get("descontado_comissao") === "on";
    const payload: Record<string, any> = {
      empresa_id: empresaId,
      nome,
      codigo: value(form, "codigo") || null,
      departamento: value(form, "departamento") || null,
      descricao: value(form, "descricao") || null,
      descontado_comissao: descontadoComissao,
    };
    let { error } = await admin.from("financeiro_centros_custo").insert(payload);
    if (error && /departamento|descricao|descontado_comissao/i.test(error.message)) {
      console.warn("Schema cache fallback for centros_custo:", error.message);
      delete payload.departamento;
      delete payload.descricao;
      delete payload.descontado_comissao;
      const retry = await admin.from("financeiro_centros_custo").insert(payload);
      error = retry.error;
    }
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("Já existe um centro de custo com esse nome.");
      throw new Error(error.message);
    }
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Centro de custo salvo com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

async function assertSocio(admin: ReturnType<typeof createAdminClient>, empresaId: string, socioId: string) {
  const { data, error } = await admin
    .from("empresa_usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", socioId)
    .eq("ativo", true)
    .eq("socio_pagador", true)
    .maybeSingle();
  if (error || !data) throw new Error("O usuário selecionado não está habilitado como sócio pagador.");
}

export async function criarConta(form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin, session } = await requireFinanceWrite();
    const pessoal = form.get("pessoal") === "on";
    const socioId = value(form, "socio");
    const valor = Number(value(form, "valor"));
    const vencimento = value(form, "vencimento");
    const descricao = value(form, "descricao");
    const recorrente = form.get("recorrente") === "on";
    const repeticoes = recorrente ? Number(value(form, "repeticoes") || "6") : 1;
    const idempotencyKey = value(form, "idempotency_key") || randomUUID();
    if (!descricao || !vencimento || !Number.isFinite(valor) || valor <= 0) {
      throw new Error("Preencha descrição, vencimento e um valor maior que zero.");
    }
    if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 120) {
      throw new Error("A quantidade de meses deve estar entre 1 e 120.");
    }
    if (pessoal && !socioId) throw new Error("Selecione quem pagou pessoalmente.");
    if (pessoal) await assertSocio(admin, empresaId, socioId);
    const fornecedorTexto = value(form, "fornecedor");
    let fornecedorId: string | null = null;
    if (fornecedorTexto) {
      try {
        const { data: fornData } = await admin.rpc("rpc_obter_ou_criar_fornecedor", {
          p_empresa_id: empresaId,
          p_nome: fornecedorTexto,
        });
        if (fornData) fornecedorId = fornData;
      } catch (e) {
        console.error("Erro ao obter/criar fornecedor:", e);
      }
    }

    const centroId = value(form, "centro") || null;
    const bancoId = value(form, "banco") || null;
    await Promise.all([
      assertTenantReference(admin, "financeiro_centros_custo", empresaId, centroId, "Centro de custo"),
      assertTenantReference(admin, "financeiro_contas_bancarias", empresaId, bancoId, "Conta bancária"),
      assertTenantReference(admin, "financeiro_fornecedores", empresaId, fornecedorId, "Fornecedor"),
    ]);

    const arquivoNf = form.get("arquivo_nf") as File | null;
    const uploadNf = await uploadNotaFiscal(admin, empresaId, arquivoNf);

    let descontadoComissao = form.get("descontado_comissao") === "on";
    if (!descontadoComissao && centroId) {
      const { data: cData } = await admin
        .from("financeiro_centros_custo")
        .select("descontado_comissao")
        .eq("id", centroId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cData?.descontado_comissao) descontadoComissao = true;
    }

    const payload: Record<string, any> = {
      empresa_id: empresaId,
      descricao,
      fornecedor: fornecedorTexto || null,
      fornecedor_id: fornecedorId,
      centro_custo_id: centroId,
      conta_bancaria_id: bancoId,
      vencimento,
      competencia: vencimento.slice(0, 7),
      valor,
      status: "aberta",
      pago_em: null,
      pago_pessoalmente: pessoal,
      socio_pagador_usuario_id: pessoal ? socioId : null,
      descontado_comissao: descontadoComissao,
      observacao: value(form, "obs") || null,
    };

    const rpcResult = await session.rpc("rpc_criar_contas_pagar_recorrentes", {
      p_empresa_id: empresaId,
      p_descricao: descricao,
      p_fornecedor: fornecedorTexto || null,
      p_fornecedor_id: fornecedorId,
      p_centro_custo_id: centroId,
      p_conta_bancaria_id: bancoId,
      p_primeiro_vencimento: vencimento,
      p_valor: valor,
      p_repeticoes: repeticoes,
      p_observacao: value(form, "obs") || null,
      p_pago_pessoalmente: pessoal,
      p_socio_pagador_usuario_id: pessoal ? socioId : null,
      p_descontado_comissao: descontadoComissao,
      p_idempotency_key: idempotencyKey,
    });

    let contasIds: string[] = [];
    if (rpcResult.error) {
      const migrationPendente = /rpc_criar_contas_pagar_recorrentes|schema cache|could not find/i.test(
        rpcResult.error.message,
      );
      if (!migrationPendente || repeticoes > 1) {
        if (uploadNf) await removeStoredDocument(admin, empresaId, uploadNf.url);
        throw new Error(
          migrationPendente
            ? "A migration 129 precisa ser aplicada antes de criar contas recorrentes."
            : rpcResult.error.message,
        );
      }
      const fallback = await admin
        .from("financeiro_contas_pagar")
        .insert({
          ...payload,
          comprovante_url: uploadNf?.url || null,
          nota_fiscal_nome: uploadNf?.nome || null,
          nota_fiscal_uploaded_at: uploadNf ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (fallback.error) {
        if (uploadNf) await removeStoredDocument(admin, empresaId, uploadNf.url);
        throw new Error(fallback.error.message);
      }
      contasIds = [fallback.data.id];
    } else {
      const data = rpcResult.data as { contas_ids?: unknown } | null;
      contasIds = Array.isArray(data?.contas_ids)
        ? data.contas_ids.filter((id): id is string => typeof id === "string")
        : [];
    }

    if (uploadNf && contasIds[0]) {
      const { error: documentError } = await admin
        .from("financeiro_contas_pagar")
        .update({
          comprovante_url: uploadNf.url,
          nota_fiscal_nome: uploadNf.nome,
          nota_fiscal_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", contasIds[0])
        .eq("empresa_id", empresaId);
      if (documentError) {
        await removeStoredDocument(admin, empresaId, uploadNf.url);
        throw new Error(`Contas criadas, mas o documento não pôde ser vinculado: ${documentError.message}`);
      }
    }
    revalidatePath("/erp/contas-pagar");
    return {
      ok: true,
      message:
        repeticoes > 1
          ? `${repeticoes} contas mensais criadas com sucesso. O comprovante, quando enviado, ficou apenas na primeira competência.`
          : "Conta adicionada com sucesso.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function baixarConta(id: string, dataPagamento?: string | null): Promise<ContasActionResult> {
  try {
    const { empresaId, session } = await requireFinanceWrite();
    const dataEfetiva =
      dataPagamento && /^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)
        ? dataPagamento
        : new Date().toISOString().slice(0, 10);

    const { error } = await session.rpc("rpc_baixar_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_data: dataEfetiva,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Conta marcada como paga." };
  } catch (error) {
    return failure(error);
  }
}

export async function alterarConta(id: string, form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, session, admin } = await requireFinanceWrite();
    const pessoal = form.get("pessoal") === "on";
    const socioId = pessoal ? value(form, "socio") || null : null;
    const centroId = value(form, "centro") || null;
    const bancoId = value(form, "banco") || null;
    if (pessoal && !socioId) throw new Error("Selecione quem pagou pessoalmente.");
    if (socioId) await assertSocio(admin, empresaId, socioId);
    await Promise.all([
      assertTenantReference(admin, "financeiro_centros_custo", empresaId, centroId, "Centro de custo"),
      assertTenantReference(admin, "financeiro_contas_bancarias", empresaId, bancoId, "Conta bancária"),
    ]);
    const { error } = await session.rpc("rpc_alterar_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_descricao: value(form, "descricao"),
      p_fornecedor: value(form, "fornecedor"),
      p_vencimento: value(form, "vencimento"),
      p_valor: Number(value(form, "valor")),
      p_centro_custo_id: centroId,
      p_conta_bancaria_id: bancoId,
      p_observacao: value(form, "obs"),
      p_pago_pessoalmente: pessoal,
      p_socio_pagador_usuario_id: socioId,
    });
    if (error) throw new Error(error.message);

    const removerNf = form.get("remover_nf") === "true";
    const arquivoNf = form.get("arquivo_nf") as File | null;

    let descontadoComissao = form.get("descontado_comissao") === "on";
    if (!descontadoComissao && centroId) {
      const { data: cData } = await admin
        .from("financeiro_centros_custo")
        .select("descontado_comissao")
        .eq("id", centroId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cData?.descontado_comissao) descontadoComissao = true;
    }

    const updates: Record<string, any> = {
      descontado_comissao: descontadoComissao,
      updated_at: new Date().toISOString(),
    };

    if (removerNf) {
      updates.comprovante_url = null;
      updates.nota_fiscal_nome = null;
      updates.nota_fiscal_uploaded_at = null;
    } else if (arquivoNf && arquivoNf instanceof File && arquivoNf.size > 0) {
      const uploadNf = await uploadNotaFiscal(admin, empresaId, arquivoNf);
      if (uploadNf) {
        updates.comprovante_url = uploadNf.url;
        updates.nota_fiscal_nome = uploadNf.nome;
        updates.nota_fiscal_uploaded_at = new Date().toISOString();
      }
    }

    let { error: updateError } = await admin
      .from("financeiro_contas_pagar")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (updateError && /fornecedor_id|descontado_comissao|comprovante_url|nota_fiscal/i.test(updateError.message)) {
      delete updates.descontado_comissao;
      delete updates.comprovante_url;
      delete updates.nota_fiscal_nome;
      delete updates.nota_fiscal_uploaded_at;
      await admin
        .from("financeiro_contas_pagar")
        .update(updates)
        .eq("id", id)
        .eq("empresa_id", empresaId);
    }

    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Despesa alterada com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function estornarConta(id: string, motivo: string): Promise<ContasActionResult> {
  try {
    const { empresaId, session } = await requireFinanceWrite();
    const { error } = await session.rpc("rpc_estornar_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_motivo: motivo,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Pagamento estornado e despesa reaberta." };
  } catch (error) {
    return failure(error);
  }
}

export async function excluirConta(id: string, motivo: string): Promise<ContasActionResult> {
  try {
    const { empresaId, session } = await requireFinanceWrite();
    const { error } = await session.rpc("rpc_excluir_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_motivo: motivo,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Despesa excluída com histórico preservado." };
  } catch (error) {
    return failure(error);
  }
}

export async function atualizarSocioPagadorContas(
  contaIds: string[],
  socioId: string | null,
): Promise<ContasActionResult> {
  try {
    const ids = [...new Set(contaIds.map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) throw new Error("Selecione pelo menos uma conta.");
    if (ids.length > 500) throw new Error("Selecione no máximo 500 contas por vez.");
    const { empresaId, admin } = await requireFinanceWrite();
    if (socioId) await assertSocio(admin, empresaId, socioId);
    const { data, error } = await admin
      .from("financeiro_contas_pagar")
      .update({
        pago_pessoalmente: Boolean(socioId),
        socio_pagador_usuario_id: socioId,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId)
      .in("id", ids)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== ids.length) throw new Error("Uma ou mais contas não pertencem à empresa ativa.");
    revalidatePath("/erp/contas-pagar");
    return {
      ok: true,
      message: socioId
        ? `Sócio pagador aplicado a ${(data ?? []).length} conta(s).`
        : `Pagamento pessoal removido de ${(data ?? []).length} conta(s).`,
    };
  } catch (error) {
    return failure(error);
  }
}

async function ensureCatalog(
  admin: ReturnType<typeof createAdminClient>,
  table: "financeiro_centros_custo" | "financeiro_contas_bancarias",
  empresaId: string,
  names: Array<string | null>,
) {
  const useful = [...new Set(names.filter((name): name is string => {
    if (!name) return false;
    return !["nao informado", "a_definir", "a preencher"].includes(normalizeName(name));
  }))];
  if (useful.length) {
    const { error } = await admin.from(table).upsert(
      useful.map((nome) => ({ empresa_id: empresaId, nome })),
      { onConflict: "empresa_id,nome", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }
  const { data, error } = await admin.from(table).select("id,nome").eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [normalizeName(row.nome), row.id]));
}

export async function importarContasCsv(form: FormData): Promise<ContasActionResult> {
  try {
    const file = form.get("arquivo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo CSV.");
    if (file.size > 5 * 1024 * 1024) throw new Error("O CSV deve ter no máximo 5 MB.");
    const parsed = parseContasPagarCsv(await file.text());
    if (!parsed.contas.length && parsed.erros.length) {
      throw new Error(parsed.erros.slice(0, 3).map((item) => `Linha ${item.linha}: ${item.mensagem}`).join(" · "));
    }
    if (parsed.contas.length > 2_000) throw new Error("O CSV deve conter no máximo 2.000 contas.");
    const contasPorChave = new Map(parsed.contas.map((conta) => [conta.importacaoChave, conta]));
    const contasImportacao = [...contasPorChave.values()];
    const duplicadasNoArquivo = parsed.contas.length - contasImportacao.length;
    const { empresaId, admin } = await requireFinanceWrite();
    const centroIds = await ensureCatalog(
      admin,
      "financeiro_centros_custo",
      empresaId,
      contasImportacao.map((conta) => conta.centroCusto),
    );
    const bancoIds = await ensureCatalog(
      admin,
      "financeiro_contas_bancarias",
      empresaId,
      contasImportacao.map((conta) => conta.bancoPagamento),
    );
    const keys = contasImportacao.map((conta) => conta.importacaoChave);
    const { data: existing, error: existingError } = await admin
      .from("financeiro_contas_pagar")
      .select("importacao_chave")
      .eq("empresa_id", empresaId)
      .eq("importacao_origem", "CSV_CONTAS_PAGAR_V1")
      .in("importacao_chave", keys);
    if (existingError) throw new Error(existingError.message);
    const existingKeys = new Set((existing ?? []).map((row) => row.importacao_chave));
    const novas = contasImportacao.filter((conta) => !existingKeys.has(conta.importacaoChave));
    const rows = novas.map((conta) => ({
      empresa_id: empresaId,
      importacao_origem: "CSV_CONTAS_PAGAR_V1",
      importacao_chave: conta.importacaoChave,
      fornecedor: conta.fornecedor,
      descricao: conta.descricao,
      centro_custo_id: conta.centroCusto ? centroIds.get(normalizeName(conta.centroCusto)) ?? null : null,
      conta_bancaria_id: conta.bancoPagamento ? bancoIds.get(normalizeName(conta.bancoPagamento)) ?? null : null,
      vencimento: conta.vencimento,
      competencia: conta.vencimento.slice(0, 7),
      valor: conta.valor,
      status: conta.status,
      pago_em: conta.dataPagamento,
      pago_pessoalmente: false,
      socio_pagador_usuario_id: null,
      observacao: conta.observacao,
      data_lancamento: conta.dataLancamento,
      forma_pagamento: conta.formaPagamento,
      comprovante_nome: conta.comprovanteNome,
      comprovante_url: conta.comprovanteUrl,
      responsavel_importado: conta.responsavelImportado,
      lancado_por_importado: conta.lancadoPorImportado,
      necessita_revisao: conta.necessitaRevisao,
    }));
    if (rows.length) {
      const { error } = await admin.from("financeiro_contas_pagar").insert(rows);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/erp/contas-pagar");
    const errors = parsed.erros.slice(0, 10).map((item) => `Linha ${item.linha}: ${item.mensagem}`);
    const duplicadas = existingKeys.size + duplicadasNoArquivo;
    return {
      ok: true,
      message: `${rows.length} conta(s) importada(s); ${duplicadas} duplicada(s); ${parsed.erros.length} inválida(s).`,
      importacao: {
        importadas: rows.length,
        duplicadas,
        invalidas: parsed.erros.length,
        erros: errors,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function alterarBanco(id: string, form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do banco para exibição.");
    const updates: Record<string, any> = {
      nome,
      banco: value(form, "banco") || null,
      agencia: value(form, "agencia") || null,
      conta_mascarada: value(form, "conta") || null,
      tipo_conta: value(form, "tipo_conta") || "CORRENTE",
      chave_pix: value(form, "chave_pix") || null,
      observacao: value(form, "observacao") || null,
      updated_at: new Date().toISOString(),
    };
    let { error } = await admin
      .from("financeiro_contas_bancarias")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error && /tipo_conta|chave_pix|observacao/i.test(error.message)) {
      console.warn("Schema cache fallback for contas_bancarias update:", error.message);
      delete updates.tipo_conta;
      delete updates.chave_pix;
      delete updates.observacao;
      const retry = await admin
        .from("financeiro_contas_bancarias")
        .update(updates)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Banco atualizado com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function alternarStatusBanco(id: string, ativo: boolean): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { error } = await admin
      .from("financeiro_contas_bancarias")
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: ativo ? "Banco ativado." : "Banco inativado." };
  } catch (error) {
    return failure(error);
  }
}

export async function alterarCentro(id: string, form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do centro de custo.");
    const descontadoComissao = form.get("descontado_comissao") === "on";
    const updates: Record<string, any> = {
      nome,
      codigo: value(form, "codigo") || null,
      departamento: value(form, "departamento") || null,
      descricao: value(form, "descricao") || null,
      descontado_comissao: descontadoComissao,
    };
    let { error } = await admin
      .from("financeiro_centros_custo")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error && /departamento|descricao|descontado_comissao/i.test(error.message)) {
      console.warn("Schema cache fallback for centros_custo update:", error.message);
      delete updates.departamento;
      delete updates.descricao;
      delete updates.descontado_comissao;
      const retry = await admin
        .from("financeiro_centros_custo")
        .update(updates)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Centro de custo atualizado." };
  } catch (error) {
    return failure(error);
  }
}

export async function alternarStatusCentro(id: string, ativo: boolean): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { error } = await admin
      .from("financeiro_centros_custo")
      .update({ ativo })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: ativo ? "Centro de custo ativado." : "Centro de custo inativado." };
  } catch (error) {
    return failure(error);
  }
}

export async function criarFornecedor(form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do fornecedor.");
    const { error } = await admin.from("financeiro_fornecedores").insert({
      empresa_id: empresaId,
      nome,
      razao_social: value(form, "razao_social") || null,
      cnpj_cpf: value(form, "cnpj_cpf") || null,
      email: value(form, "email") || null,
      telefone: value(form, "telefone") || null,
      chave_pix: value(form, "chave_pix") || null,
      tipo_chave_pix: value(form, "tipo_chave_pix") || null,
      banco: value(form, "banco") || null,
      agencia: value(form, "agencia") || null,
      conta: value(form, "conta") || null,
      observacao: value(form, "observacao") || null,
      ativo: true,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("Já existe um fornecedor com esse nome.");
      throw new Error(error.message);
    }
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Fornecedor cadastrado com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function alterarFornecedor(id: string, form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nome = value(form, "nome");
    if (!nome) throw new Error("Informe o nome do fornecedor.");
    const { error } = await admin
      .from("financeiro_fornecedores")
      .update({
        nome,
        razao_social: value(form, "razao_social") || null,
        cnpj_cpf: value(form, "cnpj_cpf") || null,
        email: value(form, "email") || null,
        telefone: value(form, "telefone") || null,
        chave_pix: value(form, "chave_pix") || null,
        tipo_chave_pix: value(form, "tipo_chave_pix") || null,
        banco: value(form, "banco") || null,
        agencia: value(form, "agencia") || null,
        conta: value(form, "conta") || null,
        observacao: value(form, "observacao") || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Fornecedor atualizado com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function alternarStatusFornecedor(id: string, ativo: boolean): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { error } = await admin
      .from("financeiro_fornecedores")
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: ativo ? "Fornecedor ativado." : "Fornecedor inativado." };
  } catch (error) {
    return failure(error);
  }
}

export async function anexarNotaFiscalConta(id: string, form: FormData): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { data: contaAtual, error: contaError } = await admin
      .from("financeiro_contas_pagar")
      .select("id,comprovante_url")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (contaError || !contaAtual) throw new Error("Conta não encontrada na empresa ativa.");
    const arquivoNf = form.get("arquivo_nf") as File | null;
    if (!arquivoNf || arquivoNf.size === 0) {
      throw new Error("Selecione um arquivo de Nota Fiscal ou comprovante.");
    }
    const uploadNf = await uploadNotaFiscal(admin, empresaId, arquivoNf);
    if (!uploadNf) throw new Error("Não foi possível processar o arquivo.");

    const { error } = await admin
      .from("financeiro_contas_pagar")
      .update({
        comprovante_url: uploadNf.url,
        nota_fiscal_nome: uploadNf.nome,
        nota_fiscal_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      await removeStoredDocument(admin, empresaId, uploadNf.url);
      throw new Error(error.message);
    }
    if (contaAtual.comprovante_url) {
      await removeStoredDocument(admin, empresaId, contaAtual.comprovante_url);
    }
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Nota Fiscal anexada com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function removerNotaFiscalConta(id: string): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { data: contaAtual, error: contaError } = await admin
      .from("financeiro_contas_pagar")
      .select("id,comprovante_url")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (contaError || !contaAtual) throw new Error("Conta não encontrada na empresa ativa.");
    const { error } = await admin
      .from("financeiro_contas_pagar")
      .update({
        comprovante_url: null,
        nota_fiscal_nome: null,
        nota_fiscal_uploaded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw new Error(error.message);
    await removeStoredDocument(admin, empresaId, contaAtual.comprovante_url);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Nota Fiscal removida da conta." };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicarContaMeses(
  id: string,
  quantidadeMeses: number,
  idempotencyKey?: string,
): Promise<ContasActionResult> {
  try {
    if (!Number.isInteger(quantidadeMeses) || quantidadeMeses < 1 || quantidadeMeses > 120) {
      throw new Error("A quantidade deve estar entre 1 e 120 meses.");
    }
    const { empresaId, session } = await requireFinanceWrite();
    const { data, error } = await session.rpc("rpc_duplicar_conta_pagar_meses", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_quantidade_meses: quantidadeMeses,
      p_idempotency_key: idempotencyKey || randomUUID(),
    });
    if (error) {
      if (/rpc_duplicar_conta_pagar_meses|schema cache|could not find/i.test(error.message)) {
        throw new Error("A migration 129 precisa ser aplicada antes de duplicar contas.");
      }
      throw new Error(error.message);
    }
    const reused = Boolean((data as { reused?: boolean } | null)?.reused);
    revalidatePath("/erp/contas-pagar");
    return {
      ok: true,
      message: reused
        ? "Esta duplicação já havia sido processada; nenhuma conta foi repetida."
        : `${quantidadeMeses} conta(s) futura(s) criada(s), sem copiar o comprovante.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function obterUrlNotaFiscalConta(id: string): Promise<DocumentoFinanceiroResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const { data: conta, error } = await admin
      .from("financeiro_contas_pagar")
      .select("id,comprovante_url")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error || !conta?.comprovante_url) {
      throw new Error("Documento não encontrado na empresa ativa.");
    }
    const path = storagePathFromReference(conta.comprovante_url);
    if (!path) throw new Error("O caminho do documento legado é inválido.");
    assertStoragePathEmpresa(path, empresaId);
    const { data, error: signedError } = await admin.storage
      .from(CONTAS_BUCKET)
      .createSignedUrl(path, 60);
    if (signedError || !data?.signedUrl) throw new Error("Não foi possível autorizar a abertura do documento.");
    return { ok: true, url: data.signedUrl };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível abrir o documento." };
  }
}

export async function unificarFornecedores({
  fornecedorPrincipalNome,
  fornecedorPrincipalId,
  fornecedoresAntigosNomes,
  fornecedoresAntigosIds,
}: {
  fornecedorPrincipalNome: string;
  fornecedorPrincipalId?: string | null;
  fornecedoresAntigosNomes: string[];
  fornecedoresAntigosIds?: string[];
}): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
    const nomePrincipal = (fornecedorPrincipalNome || "").trim();
    if (!nomePrincipal) {
      throw new Error("Informe o nome do fornecedor principal.");
    }

    // 1. Garante que o fornecedor principal existe em financeiro_fornecedores se a tabela existir
    let targetFornecedorId = fornecedorPrincipalId;
    if (!targetFornecedorId || targetFornecedorId.startsWith("temp-")) {
      try {
        const { data: fornExistente } = await admin
          .from("financeiro_fornecedores")
          .select("id")
          .eq("empresa_id", empresaId)
          .ilike("nome", nomePrincipal)
          .maybeSingle();

        if (fornExistente) {
          targetFornecedorId = fornExistente.id;
        } else {
          const { data: fornNovo } = await admin
            .from("financeiro_fornecedores")
            .insert({
              empresa_id: empresaId,
              nome: nomePrincipal,
            })
            .select("id")
            .maybeSingle();
          if (fornNovo) targetFornecedorId = fornNovo.id;
        }
      } catch (e) {
        console.warn("Tabela financeiro_fornecedores pode nao existir ainda:", e);
      }
    }

    // 2. Coleta todos os nomes e IDs antigos a serem substituídos
    const nomesSubstituir = (fornecedoresAntigosNomes || [])
      .map((n) => (n || "").trim())
      .filter((n) => n.length > 0 && n.toLowerCase() !== nomePrincipal.toLowerCase());

    const idsSubstituir = (fornecedoresAntigosIds || []).filter(
      (id) => id && !id.startsWith("temp-") && id !== targetFornecedorId
    );

    let totalAfetadas = 0;

    // 3. Atualiza financeiro_contas_pagar
    for (const nomeAntigo of nomesSubstituir) {
      const updates: Record<string, any> = {
        fornecedor: nomePrincipal,
        updated_at: new Date().toISOString(),
      };
      if (targetFornecedorId && !targetFornecedorId.startsWith("temp-")) {
        updates.fornecedor_id = targetFornecedorId;
      }
      const { data: resContas } = await admin
        .from("financeiro_contas_pagar")
        .update(updates)
        .eq("empresa_id", empresaId)
        .ilike("fornecedor", nomeAntigo)
        .select("id");
      totalAfetadas += (resContas || []).length;
    }

    for (const idAntigo of idsSubstituir) {
      const updates: Record<string, any> = {
        fornecedor: nomePrincipal,
        updated_at: new Date().toISOString(),
      };
      if (targetFornecedorId && !targetFornecedorId.startsWith("temp-")) {
        updates.fornecedor_id = targetFornecedorId;
      }
      const { data: resContas } = await admin
        .from("financeiro_contas_pagar")
        .update(updates)
        .eq("empresa_id", empresaId)
        .eq("fornecedor_id", idAntigo)
        .select("id");
      totalAfetadas += (resContas || []).length;

      try {
        await admin
          .from("financeiro_fornecedores")
          .delete()
          .eq("id", idAntigo)
          .eq("empresa_id", empresaId);
      } catch (e) {
        console.warn("Erro ao remover fornecedor duplicado antigo:", e);
      }
    }

    revalidatePath("/erp/contas-pagar");
    return {
      ok: true,
      message: `Fornecedores unificados com sucesso para "${nomePrincipal}" (${totalAfetadas} conta(s) atualizada(s)).`,
    };
  } catch (error) {
    return failure(error);
  }
}
