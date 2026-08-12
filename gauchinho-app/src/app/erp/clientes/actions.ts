"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const digits = (value: string) => value.replace(/\D/g, "");

export async function saveClienteAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  const supabase = await createClient();
  const id = text(formData.get("id"));
  const tipo = text(formData.get("tipo_pessoa"));
  const nome = text(formData.get("nome"));
  const documento = digits(text(formData.get("cpf_cnpj")));
  if (!nome || !["PF", "PJ"].includes(tipo)) throw new Error("Informe tipo de pessoa e nome.");
  if (documento && ![11, 14].includes(documento.length)) throw new Error("CPF ou CNPJ inválido.");
  const payload = {
    empresa_id: empresaAtiva.id, tipo_pessoa: tipo, nome, nome_fantasia: text(formData.get("nome_fantasia")) || null,
    cpf_cnpj: documento || null, documento_normalizado: documento || null, representante_nome: text(formData.get("representante_nome")) || null,
    telefone: text(formData.get("telefone")) || null, email: text(formData.get("email")) || null, cep: text(formData.get("cep")) || null,
    endereco: text(formData.get("endereco")) || null, numero: text(formData.get("numero")) || null, complemento: text(formData.get("complemento")) || null,
    bairro: text(formData.get("bairro")) || null, cidade: text(formData.get("cidade")) || null, uf: text(formData.get("uf")).toUpperCase() || null,
    participante_comercial_id: text(formData.get("participante_comercial_id")) || null, observacoes: text(formData.get("observacoes")) || null,
    status: text(formData.get("status")) || "ativo", origem: "manual",
  };
  if (documento) {
    const { data: duplicate } = await supabase.from("clientes").select("id").eq("empresa_id", empresaAtiva.id).eq("documento_normalizado", documento).neq("id", id || "00000000-0000-0000-0000-000000000000").maybeSingle();
    if (duplicate) throw new Error("Já existe um cliente neste CNPJ/CPF.");
  }
  const result = id ? await supabase.from("clientes").update(payload).eq("id", id).eq("empresa_id", empresaAtiva.id).select("id").single() : await supabase.from("clientes").insert(payload).select("id").single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível salvar o cliente.");
  await supabase.from("clientes_historico").insert({ empresa_id: empresaAtiva.id, cliente_id: result.data.id, tipo_evento: id ? "cliente_atualizado" : "cliente_criado", descricao: id ? "Dados cadastrais atualizados no ERP." : "Cliente criado manualmente no ERP." });
  revalidatePath("/erp/clientes"); revalidatePath(`/erp/clientes/${result.data.id}`);
  redirect(`/erp/clientes/${result.data.id}`);
}

export async function inativarClienteAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext(); if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  const id = text(formData.get("id")); const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ status: "inativo" }).eq("id", id).eq("empresa_id", empresaAtiva.id);
  if (error) throw new Error(error.message);
  await supabase.from("clientes_historico").insert({ empresa_id: empresaAtiva.id, cliente_id: id, tipo_evento: "cliente_inativado", descricao: "Cliente inativado; histórico comercial preservado." });
  revalidatePath("/erp/clientes"); revalidatePath(`/erp/clientes/${id}`);
}
