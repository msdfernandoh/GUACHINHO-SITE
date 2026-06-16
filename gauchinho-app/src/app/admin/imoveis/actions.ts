"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import {
  canManageImobiliarias,
  canViewAllImoveis,
  isImobiliaria,
  isMaster,
} from "@/lib/auth/permissions";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { parseBrazilianNumber } from "@/lib/utils/format";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import { IMOVEL_STATUS, type ImovelPublic, type ImovelRow } from "@/lib/imoveis/types";
import { registrarEvento } from "@/lib/eventos/registrar";

function numForm(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseBrazilianNumber(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function assertImovelAccess(
  usuario: Awaited<ReturnType<typeof requireUsuario>>,
  imobiliariaId: string,
) {
  if (canManageImobiliarias(usuario.perfil)) return;
  if (isImobiliaria(usuario.perfil) && usuario.imobiliaria_id === imobiliariaId) return;
  throw new Error("Sem permissão para este imóvel");
}

function imovelFromForm(formData: FormData, imobiliariaId: string) {
  const status = String(formData.get("status") ?? "ativo").trim();
  if (!IMOVEL_STATUS.some((s) => s.value === status)) throw new Error("Status inválido");

  return {
    imobiliaria_id: imobiliariaId,
    titulo: String(formData.get("titulo") ?? "").trim(),
    tipo_imovel: String(formData.get("tipo_imovel") ?? "casa").trim(),
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    bairro: String(formData.get("bairro") ?? "").trim() || null,
    valor: numForm(formData, "valor"),
    exibir_valor_publico: boolForm(formData, "exibir_valor_publico"),
    foto_principal_url: String(formData.get("foto_principal_url") ?? "").trim() || null,
    descricao_curta: String(formData.get("descricao_curta") ?? "").trim() || null,
    descricao_completa: String(formData.get("descricao_completa") ?? "").trim() || null,
    link_externo: String(formData.get("link_externo") ?? "").trim() || null,
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    usar_whatsapp_imobiliaria: boolForm(formData, "usar_whatsapp_imobiliaria"),
    status,
    destaque: boolForm(formData, "destaque"),
    ativo: boolForm(formData, "ativo"),
  };
}

export async function fetchImoveisList(filters: {
  imobiliaria_id?: string;
  status?: string;
  tipo?: string;
  ativo?: string;
  q?: string;
}) {
  const u = await requireUsuario();
  const supabase = await createClient();

  let q = supabase
    .from("imoveis")
    .select("*, imobiliarias(id, nome, slug)")
    .order("created_at", { ascending: false });

  if (isImobiliaria(u.perfil)) {
    if (!u.imobiliaria_id) return [];
    q = q.eq("imobiliaria_id", u.imobiliaria_id);
  } else if (filters.imobiliaria_id) {
    q = q.eq("imobiliaria_id", filters.imobiliaria_id);
  }

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.tipo) q = q.eq("tipo_imovel", filters.tipo);
  if (filters.ativo === "sim") q = q.eq("ativo", true);
  if (filters.ativo === "nao") q = q.eq("ativo", false);
  if (filters.q) q = q.ilike("titulo", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchImovel(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("imoveis")
    .select("*, imobiliarias(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type PublicImoveisFilters = {
  tipo?: string;
  cidade?: string;
  bairro?: string;
  imobiliaria_id?: string;
  status?: string;
  destaque?: boolean;
  valorMin?: number;
  valorMax?: number;
  valorPublico?: "sim" | "nao";
  q?: string;
};

export async function fetchPublicImoveis(
  filters: PublicImoveisFilters = {},
): Promise<ImovelPublic[]> {
  const admin = createAdminClient();
  let q = admin
    .from("imoveis")
    .select("*, imobiliarias!inner(id, nome, slug, whatsapp, logo_url, ativo)")
    .eq("ativo", true)
    .eq("imobiliarias.ativo", true)
    .in("status", ["ativo", "reservado"]);

  if (filters.tipo) q = q.eq("tipo_imovel", filters.tipo);
  if (filters.cidade) q = q.ilike("cidade", `%${filters.cidade}%`);
  if (filters.bairro) q = q.ilike("bairro", `%${filters.bairro}%`);
  if (filters.imobiliaria_id) q = q.eq("imobiliaria_id", filters.imobiliaria_id);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.destaque) q = q.eq("destaque", true);
  if (filters.valorPublico === "sim") q = q.eq("exibir_valor_publico", true);
  if (filters.valorPublico === "nao") q = q.eq("exibir_valor_publico", false);
  if (filters.valorMin != null) q = q.gte("valor", filters.valorMin);
  if (filters.valorMax != null) q = q.lte("valor", filters.valorMax);
  if (filters.q) {
    q = q.or(`titulo.ilike.%${filters.q}%,cidade.ilike.%${filters.q}%`);
  }

  const { data, error } = await q.order("destaque", { ascending: false }).order("created_at", {
    ascending: false,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const imob = row.imobiliarias as {
      id: string;
      nome: string;
      slug: string;
      whatsapp: string | null;
    };
    return {
      ...(row as ImovelRow),
      imobiliaria_nome: imob.nome,
      imobiliaria_slug: imob.slug,
      imobiliaria_whatsapp: imob.whatsapp,
    };
  });
}

export async function fetchPublicImovelBySlug(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imoveis")
    .select("*, imobiliarias!inner(*)")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const imob = data.imobiliarias as { nome: string; slug: string; whatsapp: string | null; ativo: boolean };
  if (!imob.ativo) return null;
  return {
    ...(data as ImovelRow),
    imobiliaria_nome: imob.nome,
    imobiliaria_slug: imob.slug,
    imobiliaria_whatsapp: imob.whatsapp,
  } as ImovelPublic;
}

export async function createImovelAction(formData: FormData) {
  const u = await requireUsuario();
  let imobiliariaId = String(formData.get("imobiliaria_id") ?? "").trim();
  if (isImobiliaria(u.perfil)) {
    if (!u.imobiliaria_id) throw new Error("Imobiliária não vinculada");
    imobiliariaId = u.imobiliaria_id;
  } else if (!canViewAllImoveis(u.perfil) || !imobiliariaId) {
    throw new Error("Imobiliária obrigatória");
  }

  const payload = imovelFromForm(formData, imobiliariaId);
  if (!payload.titulo) throw new Error("Título obrigatório");

  const slug = uniqueSlug(payload.titulo);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("imoveis")
    .insert({ ...payload, slug })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await uploadImovelFoto(data.id, formData);
  revalidatePath("/admin/imoveis");
  redirect(`/admin/imoveis/${data.id}`);
}

export async function updateImovelAction(id: string, formData: FormData) {
  const u = await requireUsuario();
  const existing = await fetchImovel(id);
  assertImovelAccess(u, existing.imobiliaria_id);

  const payload = imovelFromForm(formData, existing.imobiliaria_id);
  const client = isMaster(u.perfil) ? createAdminClient() : await createClient();
  const { error } = await client.from("imoveis").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  await uploadImovelFoto(id, formData);
  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${id}`);
  redirect(`/admin/imoveis/${id}`);
}

async function uploadImovelFoto(id: string, formData: FormData) {
  const foto = formData.get("foto_file");
  if (!(foto instanceof File) || foto.size === 0) return;
  const url = await uploadImagemPublica("imoveis", id, foto);
  const admin = createAdminClient();
  await admin.from("imoveis").update({ foto_principal_url: url }).eq("id", id);
}

export async function registrarImovelVisualizado(imovelId: string, pagina: string) {
  await registrarEvento({
    tipo_evento: "imovel_visualizado",
    origem: "oportunidade_imobiliaria",
    pagina,
    entidade_tipo: "imovel",
    entidade_id: imovelId,
  });
}
