"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { registrarEvento } from "@/lib/eventos/registrar";

export async function fetchPropostasList(status?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("propostas")
    .select("id, created_at, nome_cliente, tipo_proposta, valor_credito, status, lead_id")
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

export async function savePropostaAction(formData: FormData) {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "").trim();
  const validadeDias = Number(formData.get("validade_dias") ?? 7);
  const validade = new Date();
  validade.setDate(validade.getDate() + validadeDias);

  const payload = {
    lead_id: String(formData.get("lead_id") ?? "").trim() || null,
    nome_cliente: String(formData.get("nome_cliente") ?? "").trim(),
    whatsapp_cliente: String(formData.get("whatsapp_cliente") ?? "").trim() || null,
    email_cliente: String(formData.get("email_cliente") ?? "").trim() || null,
    tipo_proposta: String(formData.get("tipo_proposta") ?? "").trim() || null,
    tipo_bem: String(formData.get("tipo_bem") ?? "").trim() || null,
    valor_credito: Number(formData.get("valor_credito") ?? 0) || null,
    prazo: Number(formData.get("prazo") ?? 0) || null,
    valor_parcela: Number(formData.get("valor_parcela") ?? 0) || null,
    consultor_nome: String(formData.get("consultor_nome") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Gerada").trim(),
    validade_dias: validadeDias,
    validade_data: validade.toISOString().slice(0, 10),
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    pdf_url: null as string | null,
  };

  const supabase = await createClient();
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

export async function searchLeadsForProposta(q: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome, whatsapp")
    .ilike("nome", `%${q}%`)
    .limit(10);
  return data ?? [];
}
