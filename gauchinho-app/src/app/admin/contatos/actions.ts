"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCurrentTenantContext } from "@/lib/tenant/context";

export type ContactInput = { nome: string; telefone: string; email?: string; empresa?: string; profissao?: string; observacoes?: string; tags?: string[] };
const digits = (value: string) => { const raw = value.replace(/\D/g, ""); if (raw.startsWith("55") && (raw.length === 12 || raw.length === 13)) return raw.slice(2); if (raw.startsWith("0") && (raw.length === 13 || raw.length === 14)) return raw.slice(3); return raw; };
const IMPORT_BATCH_SIZE = 500;
const CONTACT_TAG_LIMIT = 20;

function normalizeTags(tags: string[] = []) {
  const seen = new Set<string>();
  return tags.reduce<string[]>((normalized, tag) => {
    const value = tag.replace(/^#/, "").trim().replace(/\s+/g, " ").slice(0, 50);
    const key = value.toLocaleLowerCase("pt-BR");
    if (value && !seen.has(key) && normalized.length < CONTACT_TAG_LIMIT) {
      seen.add(key);
      normalized.push(value);
    }
    return normalized;
  }, []);
}

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
  const { error } = await supabase.from("contatos_usuario").update({ ...input, tags: normalizeTags(input.tags), telefone_normalizado: digits(input.telefone), updated_at: new Date().toISOString() }).eq("id", id).eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/contatos"); return { ok: true };
}

export async function updateContactClassificationAction(
  id: string,
  field: "empresa" | "profissao",
  value: string,
) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contatos_usuario")
    .update({ [field]: value.trim().slice(0, 160) || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/contatos");
  return { ok: true };
}

export async function updateContactTagsAction(id: string, tags: string[]) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contatos_usuario")
    .update({ tags: normalizeTags(tags), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/contatos");
  return { ok: true, tags: normalizeTags(tags) };
}

export async function discardContactAction(id: string) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contatos_usuario")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/contatos");
  return { ok: true };
}

export async function sendContactToLeadAction(id: string) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const { data: contact, error } = await supabase.from("contatos_usuario").select("*").eq("id", id).eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).single();
  if (error || !contact) return { ok: false, error: "Contato não encontrado." };
  const admin = createAdminClient();
  const { data, error: rpcError } = await admin.rpc("rpc_upsert_lead_por_telefone", { p_payload: { empresa_id: empresaAtiva.id, nome: contact.nome, whatsapp: contact.telefone, email: contact.email, origem: "contatos", origem_detalhe: "Meus contatos", observacoes: [contact.empresa, contact.profissao, ...(contact.tags?.length ? [`Tags: ${contact.tags.join(", ")}`] : []), contact.observacoes].filter(Boolean).join(" — "), srd_responsavel_id: usuario.id, srd_responsavel_nome: usuario.nome, participante_comercial_id: null } });
  if (rpcError || !data?.ok) return { ok: false, error: rpcError?.message ?? data?.error ?? "Não foi possível criar o lead." };
  return { ok: true, leadId: data.lead_id, action: data.action };
}

export type ContactListFilters = {
  page?: number;
  empresa?: string;
  profissao?: string;
  tag?: string;
};

export async function listMyContacts(filters: ContactListFilters = {}) {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const pageSize = 100;
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  let query = supabase
    .from("contatos_usuario")
    .select("*", { count: "exact" })
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id);
  if (filters.empresa) query = query.eq("empresa", filters.empresa);
  if (filters.profissao) query = query.eq("profissao", filters.profissao);
  if (filters.tag) query = query.contains("tags", [filters.tag]);

  const { data, error, count } = await query
    .order("nome")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { contacts: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listMyContactFilterOptions() {
  const { usuario, empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  const rows: Array<{ empresa: string | null; profissao: string | null; tags: string[] | null }> = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("contatos_usuario")
      .select("empresa,profissao,tags")
      .eq("empresa_id", empresaAtiva.id)
      .eq("usuario_id", usuario.id)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const unique = (values: Array<string | null | undefined>) => [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort((first, second) => first.localeCompare(second, "pt-BR"));
  return {
    empresas: unique(rows.map((row) => row.empresa)),
    profissoes: unique(rows.map((row) => row.profissao)),
    tags: unique(rows.flatMap((row) => row.tags ?? [])),
  };
}
