"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { parseContasPagarCsv } from "@/lib/financeiro/contas-pagar-csv";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { canAccessErpRoute } from "@/lib/erp/erp-acesso";

export type ContasActionResult = {
  ok: boolean;
  message: string;
  importacao?: { importadas: number; duplicadas: number; invalidas: number; erros: string[] };
};

function failure(error: unknown): ContasActionResult {
  return { ok: false, message: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
}

async function requireFinanceWrite() {
  const { usuario, empresaAtiva, vinculos } = await getCurrentTenantContext();
  if (!usuario || !empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) {
    throw new Error("Empresa ou usuário não identificado.");
  }
  const vinculo = vinculos.find((item) => item.empresa_id === empresaAtiva.id);
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
      public: true,
      fileSizeLimit: 20971520,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/xml", "application/xml"],
    });
  } catch {
    // bucket may already exist
  }
}

async function uploadNotaFiscal(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  file: File | null
): Promise<{ url: string; nome: string } | null> {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  await ensureContasBucket(admin);
  const ext = file.name.split(".").pop() || "pdf";
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${empresaId}/${Date.now()}_${cleanName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await admin.storage
    .from("contas-pagar-documentos")
    .upload(filePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) {
    console.error("Erro storage contas-pagar-documentos:", error);
    throw new Error(`Falha no upload da Nota Fiscal: ${error.message}`);
  }

  const { data } = admin.storage
    .from("contas-pagar-documentos")
    .getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    nome: file.name,
  };
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
    const { error } = await admin.from("financeiro_centros_custo").insert({
      empresa_id: empresaId,
      nome,
      codigo: value(form, "codigo") || null,
      departamento: value(form, "departamento") || null,
      descricao: value(form, "descricao") || null,
      descontado_comissao: descontadoComissao,
    });
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
    const { empresaId, admin } = await requireFinanceWrite();
    const pessoal = form.get("pessoal") === "on";
    const socioId = value(form, "socio");
    const valor = Number(value(form, "valor"));
    const vencimento = value(form, "vencimento");
    const descricao = value(form, "descricao");
    if (!descricao || !vencimento || !Number.isFinite(valor) || valor <= 0) {
      throw new Error("Preencha descrição, vencimento e um valor maior que zero.");
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

    const arquivoNf = form.get("arquivo_nf") as File | null;
    const uploadNf = await uploadNotaFiscal(admin, empresaId, arquivoNf);

    const centroId = value(form, "centro") || null;
    let descontadoComissao = form.get("descontado_comissao") === "on";
    if (!descontadoComissao && centroId) {
      const { data: cData } = await admin
        .from("financeiro_centros_custo")
        .select("descontado_comissao")
        .eq("id", centroId)
        .maybeSingle();
      if (cData?.descontado_comissao) descontadoComissao = true;
    }

    const payload: Record<string, any> = {
      empresa_id: empresaId,
      descricao,
      fornecedor: fornecedorTexto || null,
      fornecedor_id: fornecedorId,
      centro_custo_id: centroId,
      conta_bancaria_id: value(form, "banco") || null,
      vencimento,
      competencia: vencimento.slice(0, 7),
      valor,
      status: "aberta",
      pago_em: null,
      pago_pessoalmente: pessoal,
      socio_pagador_usuario_id: pessoal ? socioId : null,
      descontado_comissao: descontadoComissao,
      observacao: value(form, "obs") || null,
      comprovante_url: uploadNf?.url || null,
      nota_fiscal_nome: uploadNf?.nome || null,
      nota_fiscal_uploaded_at: uploadNf ? new Date().toISOString() : null,
    };

    let { error } = await admin.from("financeiro_contas_pagar").insert(payload);
    if (error && /fornecedor_id|descontado_comissao|comprovante_url|nota_fiscal/i.test(error.message)) {
      console.warn("Schema cache warning in insert, stripping optional columns:", error.message);
      delete payload.fornecedor_id;
      delete payload.descontado_comissao;
      delete payload.comprovante_url;
      delete payload.nota_fiscal_nome;
      delete payload.nota_fiscal_uploaded_at;
      const retry = await admin.from("financeiro_contas_pagar").insert(payload);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Conta adicionada com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function baixarConta(id: string): Promise<ContasActionResult> {
  try {
    const { empresaId, session } = await requireFinanceWrite();
    const { error } = await session.rpc("rpc_baixar_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_data: new Date().toISOString().slice(0, 10),
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
    const { error } = await session.rpc("rpc_alterar_conta_pagar", {
      p_empresa_id: empresaId,
      p_conta_id: id,
      p_descricao: value(form, "descricao"),
      p_fornecedor: value(form, "fornecedor"),
      p_vencimento: value(form, "vencimento"),
      p_valor: Number(value(form, "valor")),
      p_centro_custo_id: value(form, "centro") || null,
      p_conta_bancaria_id: value(form, "banco") || null,
      p_observacao: value(form, "obs"),
      p_pago_pessoalmente: pessoal,
      p_socio_pagador_usuario_id: pessoal ? value(form, "socio") || null : null,
    });
    if (error) throw new Error(error.message);

    const removerNf = form.get("remover_nf") === "true";
    const arquivoNf = form.get("arquivo_nf") as File | null;

    const centroId = value(form, "centro") || null;
    let descontadoComissao = form.get("descontado_comissao") === "on";
    if (!descontadoComissao && centroId) {
      const { data: cData } = await admin
        .from("financeiro_centros_custo")
        .select("descontado_comissao")
        .eq("id", centroId)
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
    const { error } = await admin
      .from("financeiro_contas_bancarias")
      .update({
        nome,
        banco: value(form, "banco") || null,
        agencia: value(form, "agencia") || null,
        conta_mascarada: value(form, "conta") || null,
        tipo_conta: value(form, "tipo_conta") || "CORRENTE",
        chave_pix: value(form, "chave_pix") || null,
        observacao: value(form, "observacao") || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
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
    const { error } = await admin
      .from("financeiro_centros_custo")
      .update({
        nome,
        codigo: value(form, "codigo") || null,
        departamento: value(form, "departamento") || null,
        descricao: value(form, "descricao") || null,
        descontado_comissao: descontadoComissao,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
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

    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Nota Fiscal anexada com sucesso." };
  } catch (error) {
    return failure(error);
  }
}

export async function removerNotaFiscalConta(id: string): Promise<ContasActionResult> {
  try {
    const { empresaId, admin } = await requireFinanceWrite();
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
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Nota Fiscal removida da conta." };
  } catch (error) {
    return failure(error);
  }
}
