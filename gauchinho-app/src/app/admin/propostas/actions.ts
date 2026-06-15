"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  enrichPropostaProjecaoFromSimulacao,
  generateAndStorePropostaPdf,
  getPropostaPdfDownloadUrl,
} from "@/lib/proposta/generate-pdf";

export async function fetchPropostasList(status?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("propostas")
    .select("id, created_at, nome_cliente, tipo_proposta, valor_credito, status, lead_id, pdf_url")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchProposta(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("propostas").select("*").eq("id", id).single();
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
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();

  let existingPdf: string | null = null;
  if (id) {
    const { data } = await supabase.from("propostas").select("pdf_url").eq("id", id).single();
    existingPdf = data?.pdf_url ?? null;
  }

  const payload = readPropostaPayload(formData, existingPdf);

  if (id) {
    const { error } = await supabase.from("propostas").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/propostas/${id}`);
    redirect(`/admin/propostas/${id}`);
  }

  const { data, error } = await supabase.from("propostas").insert(payload).select("id").single();
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
  redirect(`/admin/propostas/${data.id}`);
}

export async function generatePropostaPdfAction(formData: FormData) {
  const usuario = await requireUsuario();
  const propostaId = String(formData.get("proposta_id") ?? "").trim();
  if (!propostaId) throw new Error("Proposta inválida");

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
  await requireUsuario();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome, whatsapp")
    .ilike("nome", `%${q}%`)
    .limit(10);
  return data ?? [];
}
