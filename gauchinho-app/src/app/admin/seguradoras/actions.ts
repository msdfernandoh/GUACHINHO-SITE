"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { slugify } from "@/lib/utils/slug";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import type { SeguradoraRow } from "@/lib/seguradoras/types";

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function seguradoraFromForm(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome obrigatório");
  return {
    nome,
    slug: slugify(String(formData.get("slug") ?? nome)),
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    estado: String(formData.get("estado") ?? "").trim() || null,
    endereco: String(formData.get("endereco") ?? "").trim() || null,
    numero: String(formData.get("numero") ?? "").trim() || null,
    bairro: String(formData.get("bairro") ?? "").trim() || null,
    complemento: String(formData.get("complemento") ?? "").trim() || null,
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    site_url: String(formData.get("site_url") ?? "").trim() || null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    ativo: boolForm(formData, "ativo"),
    publicado: boolForm(formData, "publicado"),
    ordem: parseInt(String(formData.get("ordem") ?? "0"), 10) || 0,
    logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    imagem_url: String(formData.get("imagem_url") ?? "").trim() || null,
  };
}

async function uploadSeguradoraFiles(
  id: string,
  formData: FormData,
  admin: ReturnType<typeof createAdminClient>,
) {
  const logo = formData.get("logo_file");
  const imagem = formData.get("imagem_file");
  const patch: Record<string, string> = {};
  if (logo instanceof File && logo.size > 0) {
    patch.logo_url = await uploadImagemPublica("seguradoras", `${id}/logo`, logo);
  }
  if (imagem instanceof File && imagem.size > 0) {
    patch.imagem_url = await uploadImagemPublica("seguradoras", `${id}/banner`, imagem);
  }
  if (Object.keys(patch).length) {
    await admin.from("seguradoras").update(patch).eq("id", id);
  }
}

export async function fetchSeguradorasList(filters?: { q?: string; ativo?: string }) {
  const supabase = await createClient();
  let q = supabase.from("seguradoras").select("*").order("ordem").order("nome");
  if (filters?.ativo === "sim") q = q.eq("ativo", true);
  if (filters?.ativo === "nao") q = q.eq("ativo", false);
  if (filters?.q) q = q.or(`nome.ilike.%${filters.q}%,slug.ilike.%${filters.q}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SeguradoraRow[];
}

export async function fetchSeguradora(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("seguradoras").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as SeguradoraRow;
}

export async function fetchPublicSeguradoras() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seguradoras")
    .select("*")
    .eq("ativo", true)
    .eq("publicado", true)
    .order("ordem")
    .order("nome");
  if (error) {
    if (/seguradoras/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return [] as SeguradoraRow[];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as SeguradoraRow[];
}

export async function createSeguradoraAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const payload = seguradoraFromForm(formData);
  const admin = createAdminClient();
  const { data, error } = await admin.from("seguradoras").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await uploadSeguradoraFiles(data.id, formData, admin);
  revalidatePath("/admin/seguradoras");
  revalidatePath("/seguradoras");
  redirect(`/admin/seguradoras/${data.id}`);
}

export async function updateSeguradoraAction(id: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const payload = seguradoraFromForm(formData);
  const admin = createAdminClient();
  const { error } = await admin.from("seguradoras").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  await uploadSeguradoraFiles(id, formData, admin);
  revalidatePath("/admin/seguradoras");
  revalidatePath(`/admin/seguradoras/${id}`);
  revalidatePath("/seguradoras");
  redirect(`/admin/seguradoras/${id}`);
}

export async function toggleSeguradoraAtivoAction(id: string, ativo: boolean) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const admin = createAdminClient();
  await admin.from("seguradoras").update({ ativo }).eq("id", id);
  revalidatePath("/admin/seguradoras");
  revalidatePath("/seguradoras");
}
