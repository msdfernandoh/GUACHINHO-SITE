"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canManageImobiliarias,
  isImobiliaria,
  isMaster,
} from "@/lib/auth/permissions";
import { slugify } from "@/lib/utils/slug";
import { parseBrazilianNumber } from "@/lib/utils/format";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import type { ImobiliariaRow } from "@/lib/imoveis/types";
import { requireTenantPermission } from "@/lib/tenant/context";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";

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
  const { empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
  const admin = createAdminClient();
  let q = admin
    .from("imobiliarias")
    .select("*, imoveis(count)")
    .order("ordem")
    .order("nome");

  if (empresaAtiva?.id) {
    q = q.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`);
  }

  if (filters?.ativo === "sim") q = q.eq("ativo", true);
  if (filters?.ativo === "nao") q = q.eq("ativo", false);
  if (filters?.q) q = q.or(`nome.ilike.%${filters.q}%,slug.ilike.%${filters.q}%`);

  const { data, error } = await q;
  if (error) {
    let fallbackQ = admin
      .from("imobiliarias")
      .select("*")
      .order("ordem")
      .order("nome");

    if (filters?.ativo === "sim") fallbackQ = fallbackQ.eq("ativo", true);
    if (filters?.ativo === "nao") fallbackQ = fallbackQ.eq("ativo", false);
    if (filters?.q) fallbackQ = fallbackQ.or(`nome.ilike.%${filters.q}%,slug.ilike.%${filters.q}%`);

    const { data: fallbackData, error: fallbackError } = await fallbackQ;
    if (fallbackError) {
      console.error("[fetchImobiliariasList] Erro no fallback:", fallbackError);
      return [];
    }
    return (fallbackData ?? []).map((row: any) => ({ ...row, imoveis: [{ count: 0 }] }));
  }
  return data ?? [];
}

export async function fetchImobiliaria(id: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
  const admin = createAdminClient();
  let q = admin
    .from("imobiliarias")
    .select("*")
    .eq("id", id);

  if (empresaAtiva?.id) {
    q = q.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`);
  }

  const { data, error } = await q.maybeSingle();
  if (error) {
    const { data: fallbackData, error: fallbackError } = await admin
      .from("imobiliarias")
      .select("*")
      .eq("id", id)
      .single();
    if (fallbackError) throw new Error(fallbackError.message);
    return fallbackData as ImobiliariaRow;
  }
  if (!data) throw new Error("Imobiliária não encontrada");
  return data as ImobiliariaRow;
}

export async function fetchImobiliariaBySlug(slug: string) {
  const tenant = await getResolvedTenant();
  if (!tenant?.allowsLegacyOperationalData) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imobiliarias")
    .select("*")
    .eq("empresa_id", tenant.empresaId)
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ImobiliariaRow | null;
}

export async function createImobiliariaAction(formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
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
    .insert({ ...payload, slug, empresa_id: empresaAtiva.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const logo = formData.get("logo_file");
  const banner = formData.get("banner_file");
  if (logo instanceof File && logo.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${data.id}/logo`, logo);
    await admin.from("imobiliarias").update({ logo_url: url }).eq("empresa_id", empresaAtiva.id).eq("id", data.id);
  }
  if (banner instanceof File && banner.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${data.id}/banner`, banner);
    await admin.from("imobiliarias").update({ banner_url: url }).eq("empresa_id", empresaAtiva.id).eq("id", data.id);
  }

  revalidatePath("/admin/imobiliarias");
  redirect(`/admin/imobiliarias/${data.id}`);
}

export async function updateImobiliariaMasterAction(id: string, formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
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
  const { error } = await admin
    .from("imobiliarias")
    .update(payload)
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", id);
  if (error) throw new Error(error.message);

  await uploadImobiliariaFiles(empresaAtiva.id, id, formData);
  revalidatePath("/admin/imobiliarias");
  revalidatePath(`/admin/imobiliarias/${id}`);
  redirect(`/admin/imobiliarias/${id}`);
}

export async function updateMinhaImobiliariaAction(formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
  if (!isImobiliaria(u.perfil) || !u.imobiliaria_id) {
    throw new Error("Apenas imobiliária vinculada");
  }
  const payload = imobiliariaFromForm(formData, false);
  const supabase = await createClient();
  const { error } = await supabase
    .from("imobiliarias")
    .update(payload)
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", u.imobiliaria_id);
  if (error) throw new Error(error.message);

  await uploadImobiliariaFiles(empresaAtiva.id, u.imobiliaria_id, formData);
  revalidatePath("/admin/minha-imobiliaria");
  redirect("/admin/minha-imobiliaria");
}

async function uploadImobiliariaFiles(empresaId: string, id: string, formData: FormData) {
  const admin = createAdminClient();
  const logo = formData.get("logo_file");
  const banner = formData.get("banner_file");
  if (logo instanceof File && logo.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${id}/logo`, logo);
    await admin.from("imobiliarias").update({ logo_url: url }).eq("empresa_id", empresaId).eq("id", id);
  }
  if (banner instanceof File && banner.size > 0) {
    const url = await uploadImagemPublica("imobiliarias", `${id}/banner`, banner);
    await admin.from("imobiliarias").update({ banner_url: url }).eq("empresa_id", empresaId).eq("id", id);
  }
}

export async function toggleImobiliariaAtivoAction(id: string, ativo: boolean) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
  if (!isMaster(u.perfil)) throw new Error("Sem permissão");
  const admin = createAdminClient();
  await admin.from("imobiliarias").update({ ativo }).eq("empresa_id", empresaAtiva.id).eq("id", id);
  revalidatePath("/admin/imobiliarias");
}

export async function createImobiliariaUsuarioAction(formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("gerenciar_imoveis");
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");

  const imobiliariaId = String(formData.get("imobiliaria_id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!imobiliariaId || !nome || !email || password.length < 8) {
    throw new Error("Dados incompletos");
  }

  const admin = createAdminClient();
  const { data: imobiliaria, error: imobiliariaError } = await admin
    .from("imobiliarias")
    .select("id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", imobiliariaId)
    .maybeSingle();
  if (imobiliariaError) throw new Error(imobiliariaError.message);
  if (!imobiliaria) throw new Error("Imobiliária não pertence à empresa deste domínio");

  const { data: papel, error: papelError } = await admin
    .from("papeis")
    .select("id,empresa_id")
    .eq("codigo", "parceiro_imobiliaria")
    .eq("escopo", "COMPANY")
    .or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`);
  if (papelError) throw new Error(papelError.message);
  const papelId = (papel ?? [])
    .sort((a, b) => Number(Boolean(b.empresa_id)) - Number(Boolean(a.empresa_id)))[0]?.id;
  if (!papelId) throw new Error("Papel de parceiro imobiliário não configurado");

  const { data: identidadeExistente, error: identidadeError } = await admin
    .from("usuarios")
    .select("id,auth_user_id,ativo")
    .ilike("email", email)
    .maybeSingle();
  if (identidadeError) throw new Error(identidadeError.message);
  if (identidadeExistente && !identidadeExistente.ativo) {
    throw new Error("Esta identidade está inativa na plataforma");
  }

  let usuarioId = identidadeExistente?.id ?? null;
  let authUserId = identidadeExistente?.auth_user_id ?? null;
  let criouIdentidade = false;
  try {
    if (!usuarioId) {
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw new Error(authError.message);
      authUserId = authUser.user.id;

      const { data: identidade, error: usuarioError } = await admin
        .from("usuarios")
        .insert({
          auth_user_id: authUserId,
          nome,
          email,
          perfil: "imobiliaria",
          imobiliaria_id: imobiliariaId,
          ativo: true,
        })
        .select("id")
        .single();
      if (usuarioError || !identidade) {
        await admin.auth.admin.deleteUser(authUserId);
        throw new Error(usuarioError?.message ?? "Falha ao criar identidade do usuário");
      }
      usuarioId = identidade.id;
      criouIdentidade = true;
    }

    const { data: vinculoExistente, error: vinculoError } = await admin
      .from("empresa_usuarios")
      .select("id,ativo")
      .eq("empresa_id", empresaAtiva.id)
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (vinculoError) throw new Error(vinculoError.message);
    if (vinculoExistente?.ativo) throw new Error("Usuário já está vinculado a esta empresa");

    const vinculoPayload = {
      empresa_id: empresaAtiva.id,
      usuario_id: usuarioId,
      papel_id: papelId,
      imobiliaria_id: imobiliariaId,
      ativo: true,
      convidado_por: u.id,
      origem: "ADMIN_IMOBILIARIAS",
    };
    const vinculoQuery = vinculoExistente
      ? admin.from("empresa_usuarios").update(vinculoPayload).eq("id", vinculoExistente.id)
      : admin.from("empresa_usuarios").insert(vinculoPayload);
    const { error: salvarVinculoError } = await vinculoQuery;
    if (salvarVinculoError) throw new Error(salvarVinculoError.message);
  } catch (error) {
    if (criouIdentidade && usuarioId && authUserId) {
      await admin.from("usuarios").delete().eq("id", usuarioId);
      await admin.auth.admin.deleteUser(authUserId);
    }
    throw error;
  }

  revalidatePath(`/admin/imobiliarias/${imobiliariaId}`);
  redirect(`/admin/imobiliarias/${imobiliariaId}`);
}

export async function fetchPublicImobiliariasParceiras() {
  const tenant = await getResolvedTenant();
  if (!tenant?.allowsLegacyOperationalData) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imobiliarias")
    .select("*")
    .eq("empresa_id", tenant.empresaId)
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}
