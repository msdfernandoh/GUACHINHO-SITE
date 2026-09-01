"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  enrichPropostaProjecaoFromSimulacao,
  generateAndStorePropostaPdf,
  getPropostaPdfDownloadUrl,
} from "@/lib/proposta/generate-pdf";
import { assertPropostaMinimum } from "@/lib/proposta/minimum";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function selectedIds(formData: FormData) {
  return [...new Set(formData.getAll("ids").map(String).filter((id) => UUID.test(id)))].slice(0, 200);
}

export async function fetchPropostasList(status?: string) {
  const { empresaAtiva, vinculoAtivo } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  let q = supabase
    .from("propostas")
    .select("id, created_at, nome_cliente, tipo_proposta, valor_credito, status, lead_id, pdf_url")
    .eq("empresa_id", empresaAtiva.id)
    .is("excluido_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    rows: data ?? [],
    podeExcluirEmLote: vinculoAtivo.papel?.codigo === "admin_empresa" || await isPlatformSuperadmin(),
  };
}

export async function excluirPropostasEmLoteAction(formData: FormData): Promise<
  { ok: true; quantidade: number } | { ok: false; error: string }
> {
  try {
    const { empresaAtiva, vinculoAtivo } = await requireTenantPermission("gerenciar_propostas");
    if (vinculoAtivo.papel?.codigo !== "admin_empresa" && !(await isPlatformSuperadmin())) {
      throw new Error("Apenas o usuário Master pode excluir propostas em lote.");
    }
    const ids = selectedIds(formData);
    if (!ids.length) throw new Error("Selecione ao menos uma proposta.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rpc_master_excluir_pre_cota_em_lote", {
      p_empresa_id: empresaAtiva.id,
      p_tipo: "PROPOSTA",
      p_ids: ids,
      p_motivo: "Exclusão em lote na tela de propostas do ERP",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/propostas");
    revalidatePath("/erp/propostas");
    return { ok: true, quantidade: Number((data as { quantidade?: number } | null)?.quantidade ?? ids.length) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível excluir as propostas." };
  }
}

export async function fetchProposta(id: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data, error } = await supabase.from("propostas").select("*").eq("id", id).eq("empresa_id", empresaAtiva.id).is("excluido_at", null).single();
  if (error) throw new Error(error.message);
  return data;
}

function readPropostaPayload(formData: FormData, existingPdfUrl?: string | null) {
  const validadeDiasRaw = formData.get("validade_dias");
  const validadeDias =
    validadeDiasRaw != null && String(validadeDiasRaw).trim() !== ""
      ? Number(validadeDiasRaw)
      : null;
  const validadeManual = String(formData.get("validade_data") ?? "").trim();
  const validade = validadeManual
    ? new Date(validadeManual)
    : validadeDias
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + validadeDias);
          return d;
        })()
      : null;

  return {
    lead_id: String(formData.get("lead_id") ?? "").trim() || null,
    cliente_id: String(formData.get("cliente_id") ?? "").trim() || null,
    nome_cliente: String(formData.get("nome_cliente") ?? "").trim(),
    whatsapp_cliente: String(formData.get("whatsapp_cliente") ?? "").trim() || null,
    email_cliente: String(formData.get("email_cliente") ?? "").trim() || null,
    cidade_cliente: String(formData.get("cidade_cliente") ?? "").trim() || null,
    tipo_proposta: String(formData.get("tipo_proposta") ?? "").trim() || null,
    tipo_bem: String(formData.get("tipo_bem") ?? "").trim() || null,
    parceiro_nome: String(formData.get("parceiro_nome") ?? "").trim() || null,
    valor_credito: Number(formData.get("valor_credito") ?? 0) || null,
    prazo: Number(formData.get("prazo") ?? 0) || null,
    entrada: Number(formData.get("entrada") ?? 0) || null,
    valor_parcela: Number(formData.get("valor_parcela") ?? 0) || null,
    consultor_nome: String(formData.get("consultor_nome") ?? "").trim() || null,
    consultor_telefone: String(formData.get("consultor_telefone") ?? "").trim() || null,
    consultor_email: String(formData.get("consultor_email") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Gerada").trim(),
    validade_dias: validadeDias,
    validade_data: validade ? validade.toISOString().slice(0, 10) : null,
    validade_origem: validadeManual ? "manual" : validadeDias ? "padrao" : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    pdf_url: existingPdfUrl ?? null,
  };
}

export async function savePropostaAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const id = String(formData.get("id") ?? "").trim();
  const origemInterface = formData.get("origem_interface") === "erp" ? "erp" : "admin";
  const supabase = await createClient();

  let existingPdf: string | null = null;
  if (id) {
    const { data } = await supabase.from("propostas").select("pdf_url").eq("id", id).eq("empresa_id", empresaAtiva.id).single();
    existingPdf = data?.pdf_url ?? null;
  }

  const payload = readPropostaPayload(formData, existingPdf);
  assertPropostaMinimum({ nome: payload.nome_cliente, telefone: payload.whatsapp_cliente });

  if (payload.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", payload.lead_id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();
    if (!lead) throw new Error("O lead informado não pertence à empresa ativa.");
  }
  if (payload.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", payload.cliente_id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();
    if (!cliente) throw new Error("O cliente informado não pertence à empresa ativa.");
  }

  if (id) {
    const { error } = await supabase.from("propostas").update(payload).eq("id", id).eq("empresa_id", empresaAtiva.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/propostas/${id}`);
    redirect(`/admin/propostas/${id}`);
  }

  const { data, error } = await supabase.from("propostas").insert({ ...payload, empresa_id: empresaAtiva.id }).select("id").single();
  if (error) throw new Error(error.message);

  await registrarEvento({
    tipo_evento: "proposta_gerada",
    origem: "admin",
    lead_id: payload.lead_id ?? undefined,
    usuario_id: usuario.id,
    entidade_tipo: "proposta",
    entidade_id: data.id,
  });

  revalidatePath("/admin/propostas");
  revalidatePath("/erp/propostas");
  redirect(origemInterface === "erp" ? "/erp/propostas" : `/admin/propostas/${data.id}`);
}

export async function generatePropostaPdfAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const propostaId = String(formData.get("proposta_id") ?? "").trim();
  if (!propostaId) throw new Error("Proposta inválida");
  const supabase = await createClient();
  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).eq("empresa_id", empresaAtiva.id).maybeSingle();
  if (!proposta) throw new Error("Proposta não encontrada nesta empresa.");

  await enrichPropostaProjecaoFromSimulacao(propostaId);
  const { signedUrl } = await generateAndStorePropostaPdf(propostaId, {
    consultor_nome: String(formData.get("consultor_nome") ?? "").trim() || undefined,
    consultor_telefone: String(formData.get("consultor_telefone") ?? "").trim() || undefined,
    consultor_email: String(formData.get("consultor_email") ?? "").trim() || undefined,
    parceiro_nome: String(formData.get("parceiro_nome") ?? "").trim() || undefined,
    validade_dias: Number(formData.get("validade_dias") ?? 0) || undefined,
    validade_data: String(formData.get("validade_data") ?? "").trim() || undefined,
    origem: "admin",
    pagina: `/admin/propostas/${propostaId}`,
    usuario_id: usuario.id,
  });

  revalidatePath(`/admin/propostas/${propostaId}`);
  revalidatePath("/admin/propostas");
  return { ok: true as const, signedUrl };
}

export async function getPropostaDownloadUrlAction(propostaId: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).eq("empresa_id", empresaAtiva.id).maybeSingle();
  if (!proposta) throw new Error("Proposta não encontrada nesta empresa.");
  const url = await getPropostaPdfDownloadUrl(propostaId);
  await registrarEvento({
    tipo_evento: "proposta_pdf_baixada",
    origem: "admin",
    entidade_tipo: "proposta",
    entidade_id: propostaId,
  });
  return url;
}

export async function searchLeadsForProposta(q: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome, whatsapp")
    .eq("empresa_id", empresaAtiva.id)
    .ilike("nome", `%${q}%`)
    .limit(10);
  return data ?? [];
}
