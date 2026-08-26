"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { converterContratacaoEmVenda } from "@/lib/vendas/vendas-service";

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

  const payload = {
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

  await supabase.from("clientes_historico").insert({
    empresa_id: empresaAtiva.id,
    cliente_id: result.data.id,
    tipo_evento: id ? "cliente_atualizado" : "cliente_criado",
    descricao: id ? "Dados cadastrais atualizados no ERP." : "Cliente criado manualmente no ERP.",
  });

  revalidatePath("/erp/clientes");
  revalidatePath(`/erp/clientes/${result.data.id}`);
  redirect(`/erp/clientes/${result.data.id}`);
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
    const { venda, cotaDefinitiva } = await converterContratacaoEmVenda(
      empresaAtiva.id,
      contratacaoId,
      `conversao-cliente:${contratacaoId}`
    );

    const supabase = await createClient();
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
