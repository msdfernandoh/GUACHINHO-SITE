"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { converterContratacaoEmVenda } from "@/lib/vendas/vendas-service";
import { obterQuantidadeCotasContratacao } from "@/lib/contratacoes-online/quantidade-cotas";

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const digits = (value: string) => value.replace(/\D/g, "");

export async function saveClienteAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  const supabase = await createClient();
  const id = text(formData.get("id"));
  const tipo = text(formData.get("tipo_pessoa"));
  const nome = text(formData.get("nome"));
  const documento = digits(text(formData.get("cpf_cnpj")));
  if (!nome || !["PF", "PJ"].includes(tipo)) throw new Error("Informe tipo de pessoa e nome.");
  if (documento && ![11, 14].includes(documento.length)) throw new Error("CPF ou CNPJ inválido.");

  const controleAutomacaoPresente = text(formData.get("controle_automacao_presente")) === "1";
  const naoExecutarLance =
    formData.get("nao_executar_lance_automatico") === "on" ||
    formData.get("nao_executar_lance_automatico") === "true";
  const naoExecutarBoleto =
    formData.get("nao_executar_boleto_automatico") === "on" ||
    formData.get("nao_executar_boleto_automatico") === "true";

  const payload: Record<string, unknown> = {
    empresa_id: empresaAtiva.id,
    tipo_pessoa: tipo,
    nome,
    nome_fantasia: text(formData.get("nome_fantasia")) || null,
    cpf_cnpj: documento || null,
    documento_normalizado: documento || null,
    representante_nome: text(formData.get("representante_nome")) || null,
    telefone: text(formData.get("telefone")) || null,
    telefone_secundario: text(formData.get("telefone_secundario")) || null,
    email: text(formData.get("email")) || null,
    data_nascimento: text(formData.get("data_nascimento")) || null,
    rg: text(formData.get("rg")) || null,
    orgao_emissor: text(formData.get("orgao_emissor")) || null,
    estado_civil: text(formData.get("estado_civil")) || null,
    profissao: text(formData.get("profissao")) || null,
    cep: text(formData.get("cep")) || null,
    endereco: text(formData.get("endereco")) || null,
    numero: text(formData.get("numero")) || null,
    complemento: text(formData.get("complemento")) || null,
    bairro: text(formData.get("bairro")) || null,
    cidade: text(formData.get("cidade")) || null,
    uf: text(formData.get("uf")).toUpperCase() || null,
    participante_comercial_id: text(formData.get("participante_comercial_id")) || null,
    observacoes: text(formData.get("observacoes")) || null,
    status: text(formData.get("status")) || "ativo",
    origem: text(formData.get("origem")) || "manual",
  };

  if (controleAutomacaoPresente || !id) {
    payload.nao_executar_lance_automatico = naoExecutarLance;
    payload.nao_executar_boleto_automatico = naoExecutarBoleto;
  }

  if (documento) {
    const { data: duplicate } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaAtiva.id)
      .eq("documento_normalizado", documento)
      .neq("id", id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (duplicate) throw new Error("Já existe um cliente com este CPF/CNPJ.");
  }

  const result = id
    ? await supabase.from("clientes").update(payload).eq("id", id).eq("empresa_id", empresaAtiva.id).select("id").single()
    : await supabase.from("clientes").insert(payload).select("id").single();

  if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível salvar o cliente.");

  if (id) {
    await supabase
      .from("vendas")
      .update({
        cliente_nome: nome,
        cliente_cpf_cnpj: documento || null,
        cliente_telefone: text(formData.get("telefone")) || null,
        cliente_email: text(formData.get("email")) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id);
  }

  await supabase.from("clientes_historico").insert({
    empresa_id: empresaAtiva.id,
    cliente_id: result.data.id,
    tipo_evento: id ? "cliente_atualizado" : "cliente_criado",
    descricao: id ? "Dados cadastrais atualizados no ERP." : "Cliente criado manualmente no ERP.",
  });

  revalidatePath("/erp/clientes");
  revalidatePath(`/erp/clientes/${result.data.id}`);
  revalidatePath("/erp/vendas");
  revalidatePath("/erp/lances");
  revalidatePath("/erp/robos");
  revalidatePath("/erp/repasse-franquia");
  revalidatePath("/erp/comissoes");
  redirect(`/erp/clientes/${result.data.id}`);
}

export async function salvarAutomacaoClienteAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");

  const id = text(formData.get("id"));
  if (!id) throw new Error("Cliente não informado.");

  const acaoRapida = text(formData.get("acao_rapida"));
  let naoExecutarLance =
    formData.get("nao_executar_lance_automatico") === "on" ||
    formData.get("nao_executar_lance_automatico") === "true";
  let naoExecutarBoleto =
    formData.get("nao_executar_boleto_automatico") === "on" ||
    formData.get("nao_executar_boleto_automatico") === "true";

  if (acaoRapida === "bloquear_ambos") {
    naoExecutarLance = true;
    naoExecutarBoleto = true;
  } else if (acaoRapida === "liberar_ambos") {
    naoExecutarLance = false;
    naoExecutarBoleto = false;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({
      nao_executar_lance_automatico: naoExecutarLance,
      nao_executar_boleto_automatico: naoExecutarBoleto,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id);

  if (error) throw new Error(error.message);

  const partesDescricao: string[] = [];
  partesDescricao.push(
    naoExecutarLance
      ? "Lances automáticos: NÃO EXECUTAR"
      : "Lances automáticos: EXECUÇÃO AUTOMÁTICA LIBERADA"
  );
  partesDescricao.push(
    naoExecutarBoleto
      ? "Baixa de boletos: NÃO EXECUTAR"
      : "Baixa de boletos: EXECUÇÃO AUTOMÁTICA LIBERADA"
  );

  await supabase.from("clientes_historico").insert({
    empresa_id: empresaAtiva.id,
    cliente_id: id,
    tipo_evento: "automacao_robo_atualizada",
    descricao: `Configuração de robôs atualizada no cliente (${partesDescricao.join(" | ")}).`,
  });

  revalidatePath("/erp/clientes");
  revalidatePath(`/erp/clientes/${id}`);
  revalidatePath("/erp/lances");
  revalidatePath("/erp/robos");
  revalidatePath("/erp/vendas");
}

export async function inativarClienteAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  const id = text(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ status: "inativo" }).eq("id", id).eq("empresa_id", empresaAtiva.id);
  if (error) throw new Error(error.message);
  await supabase.from("clientes_historico").insert({
    empresa_id: empresaAtiva.id,
    cliente_id: id,
    tipo_evento: "cliente_inativado",
    descricao: "Cliente inativado; histórico comercial preservado.",
  });
  revalidatePath("/erp/clientes");
  revalidatePath(`/erp/clientes/${id}`);
}

export async function gerarCotaRealClienteAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");

  const contratacaoId = text(formData.get("contratacao_id"));
  const clienteId = text(formData.get("cliente_id"));

  if (!contratacaoId) throw new Error("Contratação não informada.");
  if (!clienteId) throw new Error("Cliente não informado.");

  try {
    const supabase = await createClient();
    const { data: contratacao, error: contratacaoError } = await supabase
      .from("contratacoes_online")
      .select("quantidade_cotas,dados_simulacao")
      .eq("empresa_id", empresaAtiva.id)
      .eq("id", contratacaoId)
      .maybeSingle();
    if (contratacaoError || !contratacao) throw new Error(contratacaoError?.message || "Contratação não encontrada.");
    const quantidadeCotas = obterQuantidadeCotasContratacao(
      contratacao.dados_simulacao as Record<string, unknown> | null,
      contratacao.quantidade_cotas,
    );
    const { venda, cotaDefinitiva } = await converterContratacaoEmVenda(
      empresaAtiva.id,
      contratacaoId,
      `conversao-cliente:${contratacaoId}`,
      quantidadeCotas,
    );

    await supabase.from("clientes_historico").insert({
      empresa_id: empresaAtiva.id,
      cliente_id: clienteId,
      tipo_evento: "cota_vinculada",
      descricao: `Cota real efetivada: Grupo ${cotaDefinitiva.numero_grupo} (Venda #${venda.id.slice(0, 8)}).`,
      contratacao_id: contratacaoId,
      venda_id: venda.id,
    });

    revalidatePath("/erp/clientes");
    revalidatePath(`/erp/clientes/${clienteId}`);
    revalidatePath("/erp/vendas");
    revalidatePath("/erp/contratacoes");

    redirect(`/erp/clientes/${clienteId}?sucesso_cota=1&cota=${cotaDefinitiva.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Não foi possível gerar cota real.";
    redirect(`/erp/clientes/${clienteId}?erro_cota=${encodeURIComponent(message)}`);
  }
}

export async function obterUrlDocumentoContratacaoAction(storagePath: string): Promise<string | null> {
  try {
    const { empresaAtiva } = await requireErpRouteAccess("clientes");
    if (!empresaAtiva || !storagePath) return null;

    const admin = createAdminClient();
    const contratacaoId = storagePath.split("/", 1)[0];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contratacaoId)) {
      return null;
    }
    const { data: contratacao } = await admin
      .from("contratacoes_online")
      .select("id")
      .eq("id", contratacaoId)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();
    if (!contratacao) return null;

    const { data, error } = await admin.storage
      .from("contratacoes-documentos")
      .createSignedUrl(storagePath, 60 * 60);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
export async function iniciarNovaCotaClienteAction(formData: FormData) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("clientes");
  const { requireTenantPermission } = await import("@/lib/tenant/context");
  await requireTenantPermission("formalizar_vendas");
  const clienteId = text(formData.get("cliente_id"));
  const requestId = text(formData.get("request_id"));
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!uuid.test(clienteId) || !uuid.test(requestId)) throw new Error("Cliente inválido.");

  const db = await createClient();
  const { data: cliente, error } = await db.from("clientes")
    .select("id,nome,tipo_pessoa,cpf_cnpj,representante_nome,telefone,email,cep,endereco,numero,bairro,cidade,uf,complemento,participante_comercial_id")
    .eq("empresa_id", empresaAtiva.id).eq("id", clienteId).single();
  if (error || !cliente) throw new Error("Cliente não encontrado nesta empresa.");

  const { createHash } = await import("node:crypto");
  const token = createHash("sha256").update(`nova-cota:${empresaAtiva.id}:${clienteId}:${usuario.id}:${requestId}`).digest("hex");
  const protocolo = `GC-ERP-${token.slice(0, 24)}`;
  const admin = createAdminClient();
  const pessoaJuridica = cliente.tipo_pessoa === "PJ";
  const { data, error: createError } = await admin.from("contratacoes_online").insert({
    empresa_id: empresaAtiva.id,
    cliente_id: cliente.id,
    protocolo,
    public_token: token,
    origem: "grupos",
    status: "link_gerado",
    contrato_assinado: false,
    gerado_por_usuario_id: usuario.id,
    gerado_por_nome: usuario.nome,
    nome: cliente.nome,
    tipo_pessoa: pessoaJuridica ? "cnpj" : "cpf",
    cpf: pessoaJuridica ? null : cliente.cpf_cnpj,
    cnpj: pessoaJuridica ? cliente.cpf_cnpj : null,
    razao_social: pessoaJuridica ? cliente.nome : null,
    responsavel_nome: cliente.representante_nome,
    telefone: cliente.telefone,
    email: cliente.email,
    cep: cliente.cep,
    endereco: cliente.endereco,
    numero: cliente.numero,
    complemento: cliente.complemento,
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    uf: cliente.uf,
    participante_comercial_id: cliente.participante_comercial_id,
    forma_pagamento: "boleto",
    dados_simulacao: { origem_operacional: "NOVA_COTA_CLIENTE" },
  }).select("id").single();

  if (createError?.code === "23505") {
    const { data: existente } = await admin.from("contratacoes_online").select("id")
      .eq("empresa_id", empresaAtiva.id).eq("cliente_id", clienteId).eq("public_token", token).maybeSingle();
    if (existente) redirect(`/erp/contratacoes/${existente.id}`);
  }
  if (createError || !data) throw new Error("Não foi possível iniciar a nova cota.");
  revalidatePath(`/erp/clientes/${clienteId}`);
  revalidatePath("/erp/contratacoes");
  redirect(`/erp/contratacoes/${data.id}`);
}
