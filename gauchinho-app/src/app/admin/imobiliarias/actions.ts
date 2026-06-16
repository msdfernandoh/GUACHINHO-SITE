"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import {
  canManageImobiliarias,
  isImobiliaria,
  isMaster,
} from "@/lib/auth/permissions";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { parseBrazilianNumber } from "@/lib/utils/format";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import type { ImobiliariaRow } from "@/lib/imoveis/types";

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function imobiliariaFromForm(formData: FormData, masterFields: boolean) {
  const base = {
    nome: String(formData.get("nome") ?? "").trim(),
    responsavel: String(formData.get("responsavel") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    endereco: String(formData.get("endereco") ?? "").trim() || null,
    numero: String(formData.get("numero") ?? "").trim() || null,
    bairro: String(formData.get("bairro") ?? "").trim() || null,
    complemento: String(formData.get("complemento") ?? "").trim() || null,
    estado: String(formData.get("estado") ?? "").trim() || null,
    site: String(formData.get("site") ?? "").trim() || null,
    instagram: String(formData.get("instagram") ?? "").trim() || null,
    descricao_curta: String(formData.get("descricao_curta") ?? "").trim() || null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    banner_url: String(formData.get("banner_url") ?? "").trim() || null,
  };
  if (!base.nome) throw new Error("Nome obrigatório");

  if (masterFields) {
    return {
      ...base,
      slug: slugify(String(formData.get("slug") ?? base.nome)),
      ativo: boolForm(formData, "ativo"),
      exibir_home: boolForm(formData, "exibir_home"),
      ordem: parseInt(String(formData.get("ordem") ?? "0"), 10) || 0,
    };
  }
  return base;
}

export async function fetchImobiliariasList(filters?: {
  ativo?: string;
  q?: string;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("imobiliarias")
    .select("*, imoveis(count)")
    .order("ordem")
    .order("nome");

  if (filters?.ativo === "sim") q = q.eq("ativo", true);
  if (filters?.ativo === "nao") q = q.eq("ativo", false);
  if (filters?.q) q = q.or(`nome.ilike.%${filters.q}%,slug.ilike.%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchImobiliaria(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("imobiliarias").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as ImobiliariaRow;
}

export async function fetchImobiliariaBySlug(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imobiliarias")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ImobiliariaRow | null;
}

export async function createImobiliariaAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const payload = imobiliariaFromForm(formData, true) as ReturnType<typeof imobiliariaFromForm> & {
    slug: string;
    ativo: boolean;
    exibir_home: boolean;
    ordem: number;
  };
  const admin = createAdminClient();
  const slug = payload.slug || slugify(payload.nome);

  const { data, error } = await admin
    .from("imobiliarias")
    .insert({ ...payload, slug })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const logo = formData.get("logo_file");
  const banner = formData.get("banner_file");
  if (logo instanceof File && logo.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${data.id}/logo`, logo);
    await admin.from("imobiliarias").update({ logo_url: url }).eq("id", data.id);
  }
  if (banner instanceof File && banner.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${data.id}/banner`, banner);
    await admin.from("imobiliarias").update({ banner_url: url }).eq("id", data.id);
  }

  revalidatePath("/admin/imobiliarias");
  redirect(`/admin/imobiliarias/${data.id}`);
}

export async function updateImobiliariaMasterAction(id: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const payload = imobiliariaFromForm(formData, true) as {
    nome: string;
    slug: string;
    responsavel: string | null;
    email: string | null;
    whatsapp: string | null;
    telefone: string | null;
    cidade: string | null;
    endereco: string | null;
    site: string | null;
    instagram: string | null;
    descricao: string | null;
    logo_url: string | null;
    banner_url: string | null;
    ativo: boolean;
    exibir_home: boolean;
    ordem: number;
  };
  const admin = createAdminClient();
  const { error } = await admin.from("imobiliarias").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  await uploadImobiliariaFiles(id, formData);
  revalidatePath("/admin/imobiliarias");
  revalidatePath(`/admin/imobiliarias/${id}`);
  redirect(`/admin/imobiliarias/${id}`);
}

export async function updateMinhaImobiliariaAction(formData: FormData) {
  const u = await requireUsuario();
  if (!isImobiliaria(u.perfil) || !u.imobiliaria_id) {
    throw new Error("Apenas imobiliária vinculada");
  }
  const payload = imobiliariaFromForm(formData, false);
  const supabase = await createClient();
  const { error } = await supabase
    .from("imobiliarias")
    .update(payload)
    .eq("id", u.imobiliaria_id);
  if (error) throw new Error(error.message);

  await uploadImobiliariaFiles(u.imobiliaria_id, formData);
  revalidatePath("/admin/minha-imobiliaria");
  redirect("/admin/minha-imobiliaria");
}

async function uploadImobiliariaFiles(id: string, formData: FormData) {
  const admin = createAdminClient();
  const logo = formData.get("logo_file");
  const banner = formData.get("banner_file");
  if (logo instanceof File && logo.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${id}/logo`, logo);
    await admin.from("imobiliarias").update({ logo_url: url }).eq("id", id);
  }
  if (banner instanceof File && banner.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${id}/banner`, banner);
    await admin.from("imobiliarias").update({ banner_url: url }).eq("id", id);
  }
}

export async function toggleImobiliariaAtivoAction(id: string, ativo: boolean) {
  const u = await requireUsuario();
  if (!isMaster(u.perfil)) throw new Error("Sem permissão");
  const admin = createAdminClient();
  await admin.from("imobiliarias").update({ ativo }).eq("id", id);
  revalidatePath("/admin/imobiliarias");
}

export async function createImobiliariaUsuarioAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const imobiliariaId = String(formData.get("imobiliaria_id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!imobiliariaId || !nome || !email || password.length < 8) {
    throw new Error("Dados incompletos");
  }

  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw new Error(authError.message);

  const { error } = await admin.from("usuarios").insert({
    auth_user_id: authUser.user.id,
    nome,
    email,
    perfil: "imobiliaria",
    imobiliaria_id: imobiliariaId,
    ativo: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/imobiliarias/${imobiliariaId}`);
  redirect(`/admin/imobiliarias/${imobiliariaId}`);
}

export async function fetchPublicImobiliariasParceiras() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imobiliarias")
    .select(
      "id, nome, slug, logo_url, banner_url, cidade, estado, endereco, numero, bairro, complemento, telefone, whatsapp, site, descricao_curta, descricao",
    )
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}
