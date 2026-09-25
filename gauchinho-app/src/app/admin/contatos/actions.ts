"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCurrentTenantContext } from "@/lib/tenant/context";

export type ContactInput = { nome: string; telefone: string; email?: string; empresa?: string; profissao?: string; observacoes?: string };
const digits = (value: string) => { const raw = value.replace(/\D/g, ""); if (raw.startsWith("55") && (raw.length === 12 || raw.length === 13)) return raw.slice(2); if (raw.startsWith("0") && (raw.length === 13 || raw.length === 14)) return raw.slice(3); return raw; };
const IMPORT_BATCH_SIZE = 500;

function contactScore(contact: ContactInput) {
  return [contact.nome, contact.email, contact.empresa, contact.profissao, contact.observacoes]
    .filter((value) => Boolean(value?.trim()))
    .length;
}

export async function saveContactsAction(items: ContactInput[]) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const contactsByPhone = new Map<string, ContactInput>();
  let validItemsCount = 0;

  for (const item of items) {
    const telefoneNormalizado = digits(item.telefone);
    if (telefoneNormalizado.length < 10) continue;
    validItemsCount += 1;

    const normalized = {
      ...item,
      nome: item.nome.trim() || "Contato sem nome",
      telefone: item.telefone.trim(),
    };
    const existing = contactsByPhone.get(telefoneNormalizado);
    if (!existing || contactScore(normalized) > contactScore(existing)) {
      contactsByPhone.set(telefoneNormalizado, normalized);
    }
  }

  const rows = Array.from(contactsByPhone, ([telefone_normalizado, item]) => ({
    ...item,
    telefone_normalizado,
    usuario_id: usuario.id,
    empresa_id: empresaAtiva.id,
  }));
  if (!rows.length) return { ok: false, error: "Nenhum telefone válido encontrado." };
  const supabase = await createClient();

  for (let start = 0; start < rows.length; start += IMPORT_BATCH_SIZE) {
    const { error } = await supabase
      .from("contatos_usuario")
      .upsert(rows.slice(start, start + IMPORT_BATCH_SIZE), {
        onConflict: "empresa_id,usuario_id,telefone_normalizado",
      });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/contatos");
  return { ok: true, count: rows.length, duplicatesIgnored: validItemsCount - rows.length };
}

export async function updateContactAction(id: string, input: ContactInput) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { error } = await supabase.from("contatos_usuario").update({ ...input, telefone_normalizado: digits(input.telefone), updated_at: new Date().toISOString() }).eq("id", id).eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/contatos"); return { ok: true };
}

export async function sendContactToLeadAction(id: string) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { data: contact, error } = await supabase.from("contatos_usuario").select("*").eq("id", id).eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).single();
  if (error || !contact) return { ok: false, error: "Contato não encontrado." };
  const admin = createAdminClient();
  const { data, error: rpcError } = await admin.rpc("rpc_upsert_lead_por_telefone", { p_payload: { empresa_id: empresaAtiva.id, nome: contact.nome, whatsapp: contact.telefone, email: contact.email, origem: "contatos", origem_detalhe: "Meus contatos", observacoes: [contact.empresa, contact.profissao, contact.observacoes].filter(Boolean).join(" — "), srd_responsavel_id: usuario.id, srd_responsavel_nome: usuario.nome, participante_comercial_id: null } });
  if (rpcError || !data?.ok) return { ok: false, error: rpcError?.message ?? data?.error ?? "Não foi possível criar o lead." };
  return { ok: true, leadId: data.lead_id, action: data.action };
}

export async function listMyContacts() {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("contatos_usuario").select("*").eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).order("nome");
  if (error) throw new Error(error.message); return data ?? [];
}
