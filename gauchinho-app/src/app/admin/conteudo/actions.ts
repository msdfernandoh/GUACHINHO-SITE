"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { parseBrazilianNumber } from "@/lib/utils/format";
import { uploadImagemPublica, type StorageBucketPublico } from "@/lib/storage/imagens";

async function assertConteudo() {
  const u = await requireUsuario();
  if (!canManageConteudo(u.perfil)) throw new Error("Sem permissão");
  return u;
}

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function intOrdem(formData: FormData): number {
  const n = parseInt(String(formData.get("ordem") ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

async function ensureUniqueSlug(table: string, slug: string, excludeId?: string): Promise<string> {
  const supabase = await createClient();
  let candidate = slugify(slug) || "item";
  for (let i = 0; i < 20; i++) {
    let q = supabase.from(table).select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = uniqueSlug(slug, crypto.randomUUID());
  }
  return candidate;
}

export async function uploadConteudoMediaAction(formData: FormData) {
  await assertConteudo();
  const bucket = str(formData, "bucket") as StorageBucketPublico;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Arquivo inválido");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const url = await uploadImagemPublica(bucket, path, file);
  return url;
}

const REVALidate = [
  "/",
  "/casos-de-sucesso",
  "/dicas-do-tche",
  "/perguntas-frequentes",
  "/parceiros",
];

function revalidateConteudo() {
  for (const p of REVALidate) revalidatePath(p);
}

// --- Casos ---
export async function fetchAdminCasos() {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("casos_sucesso")
    .select("*")
    .order("ordem")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminCaso(id: string) {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase.from("casos_sucesso").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCasoSucessoAction(formData: FormData) {
  await assertConteudo();
  const id = str(formData, "id");
  const titulo = str(formData, "titulo");
  if (!titulo) throw new Error("Título obrigatório");
  const slugRaw = str(formData, "slug") || titulo;
  const slug = id
    ? await ensureUniqueSlug("casos_sucesso", slugRaw, id)
    : await ensureUniqueSlug("casos_sucesso", slugRaw);

  const creditoRaw = str(formData, "valor_credito");
  let valor_credito: number | null = null;
  if (creditoRaw) {
    const n = parseBrazilianNumber(creditoRaw);
    if (Number.isFinite(n)) valor_credito = n;
  }

  const row = {
    titulo,
    slug,
    categoria: str(formData, "categoria") || null,
    nome_cliente: str(formData, "nome_cliente") || null,
    cidade: str(formData, "cidade") || null,
    estado: str(formData, "estado") || null,
    tipo_objetivo: str(formData, "tipo_objetivo") || null,
    valor_credito,
    descricao_curta: str(formData, "descricao_curta") || null,
    conteudo: str(formData, "conteudo") || null,
    imagem_url: str(formData, "imagem_url") || null,
    video_url: str(formData, "video_url") || null,
    destaque: boolForm(formData, "destaque"),
    publicado: boolForm(formData, "publicado"),
    ordem: intOrdem(formData),
    seo_title: str(formData, "seo_title") || null,
    seo_description: str(formData, "seo_description") || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("casos_sucesso").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateConteudo();
    redirect(`/admin/conteudo/casos/${id}`);
  }
  const { data, error } = await supabase.from("casos_sucesso").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect(`/admin/conteudo/casos/${data.id}`);
}

export async function deleteCasoSucessoAction(id: string) {
  const u = await assertConteudo();
  if (!canDeleteRecords(u.perfil)) throw new Error("Sem permissão para excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("casos_sucesso").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect("/admin/conteudo/casos");
}

// --- Dicas ---
export async function fetchAdminDicas() {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dicas_tche")
    .select("*")
    .order("ordem")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminDica(id: string) {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase.from("dicas_tche").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDicaTcheAction(formData: FormData) {
  await assertConteudo();
  const id = str(formData, "id");
  const titulo = str(formData, "titulo");
  if (!titulo) throw new Error("Título obrigatório");
  const slugRaw = str(formData, "slug") || titulo;
  const slug = id
    ? await ensureUniqueSlug("dicas_tche", slugRaw, id)
    : await ensureUniqueSlug("dicas_tche", slugRaw);

  const row = {
    titulo,
    slug,
    categoria: str(formData, "categoria") || null,
    descricao_curta: str(formData, "descricao_curta") || null,
    conteudo: str(formData, "conteudo") || null,
    imagem_url: str(formData, "imagem_url") || null,
    video_url: str(formData, "video_url") || null,
    destaque: boolForm(formData, "destaque"),
    publicado: boolForm(formData, "publicado"),
    ordem: intOrdem(formData),
    seo_title: str(formData, "seo_title") || null,
    seo_description: str(formData, "seo_description") || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("dicas_tche").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateConteudo();
    redirect(`/admin/conteudo/dicas/${id}`);
  }
  const { data, error } = await supabase.from("dicas_tche").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect(`/admin/conteudo/dicas/${data.id}`);
}

export async function deleteDicaTcheAction(id: string) {
  const u = await assertConteudo();
  if (!canDeleteRecords(u.perfil)) throw new Error("Sem permissão para excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("dicas_tche").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect("/admin/conteudo/dicas");
}

// --- Depoimentos ---
export async function fetchAdminDepoimentos() {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("depoimentos")
    .select("*")
    .order("ordem")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminDepoimento(id: string) {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase.from("depoimentos").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDepoimentoAction(formData: FormData) {
  await assertConteudo();
  const id = str(formData, "id");
  const nome = str(formData, "nome");
  const texto = str(formData, "texto");
  if (!nome || !texto) throw new Error("Nome e texto obrigatórios");

  const notaRaw = str(formData, "nota");
  let nota: number | null = null;
  if (notaRaw) {
    const n = parseInt(notaRaw, 10);
    if (n >= 1 && n <= 5) nota = n;
  }

  const row = {
    nome,
    texto,
    cidade: str(formData, "cidade") || null,
    estado: str(formData, "estado") || null,
    foto_url: str(formData, "foto_url") || null,
    video_url: str(formData, "video_url") || null,
    nota,
    tipo_interesse: str(formData, "tipo_interesse") || null,
    destaque: boolForm(formData, "destaque"),
    publicado: boolForm(formData, "publicado"),
    ordem: intOrdem(formData),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("depoimentos").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateConteudo();
    redirect(`/admin/conteudo/depoimentos/${id}`);
  }
  const { data, error } = await supabase.from("depoimentos").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect(`/admin/conteudo/depoimentos/${data.id}`);
}

export async function deleteDepoimentoAction(id: string) {
  const u = await assertConteudo();
  if (!canDeleteRecords(u.perfil)) throw new Error("Sem permissão para excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("depoimentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect("/admin/conteudo/depoimentos");
}

// --- FAQ ---
export async function fetchAdminFaq() {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perguntas_frequentes")
    .select("*")
    .order("ordem")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminFaqItem(id: string) {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase.from("perguntas_frequentes").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveFaqAction(formData: FormData) {
  await assertConteudo();
  const id = str(formData, "id");
  const pergunta = str(formData, "pergunta");
  const resposta = str(formData, "resposta");
  if (!pergunta || !resposta) throw new Error("Pergunta e resposta obrigatórias");

  const row = {
    pergunta,
    resposta,
    categoria: str(formData, "categoria") || null,
    publicado: boolForm(formData, "publicado"),
    ordem: intOrdem(formData),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("perguntas_frequentes").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateConteudo();
    redirect(`/admin/conteudo/faq/${id}`);
  }
  const { data, error } = await supabase.from("perguntas_frequentes").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect(`/admin/conteudo/faq/${data.id}`);
}

export async function deleteFaqAction(id: string) {
  const u = await assertConteudo();
  if (!canDeleteRecords(u.perfil)) throw new Error("Sem permissão para excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("perguntas_frequentes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect("/admin/conteudo/faq");
}

// --- Parceiros ---
export async function fetchAdminParceiros() {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parceiros")
    .select("*")
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminParceiro(id: string) {
  await assertConteudo();
  const supabase = await createClient();
  const { data, error } = await supabase.from("parceiros").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveParceiroAction(formData: FormData) {
  await assertConteudo();
  const id = str(formData, "id");
  const nome = str(formData, "nome");
  if (!nome) throw new Error("Nome obrigatório");

  const row = {
    nome,
    tipo: str(formData, "tipo") || null,
    descricao: str(formData, "descricao") || null,
    logo_url: str(formData, "logo_url") || null,
    site_url: str(formData, "site_url") || null,
    whatsapp: str(formData, "whatsapp") || null,
    cidade: str(formData, "cidade") || null,
    estado: str(formData, "estado") || null,
    destaque: boolForm(formData, "destaque"),
    publicado: boolForm(formData, "publicado"),
    ordem: intOrdem(formData),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("parceiros").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateConteudo();
    redirect(`/admin/conteudo/parceiros/${id}`);
  }
  const { data, error } = await supabase.from("parceiros").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect(`/admin/conteudo/parceiros/${data.id}`);
}

export async function deleteParceiroAction(id: string) {
  const u = await assertConteudo();
  if (!canDeleteRecords(u.perfil)) throw new Error("Sem permissão para excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateConteudo();
  redirect("/admin/conteudo/parceiros");
}

/** Popula FAQ institucional (dev/staging ou quando explicitamente permitido). Não cria depoimentos fictícios. */
export async function popularFaqInstitucionalAction(): Promise<{ inserted: number; skipped: number }> {
  await assertConteudo();
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAQ_SEED !== "1") {
    throw new Error("Seed de FAQ bloqueado em produção");
  }
  const { FAQ_INSTITUCIONAL_SEED } = await import("@/lib/conteudo/faq-seed");
  const supabase = await createClient();
  let inserted = 0;
  let skipped = 0;
  for (const row of FAQ_INSTITUCIONAL_SEED) {
    const { data: existing } = await supabase
      .from("perguntas_frequentes")
      .select("id")
      .eq("pergunta", row.pergunta)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("perguntas_frequentes").insert({
      pergunta: row.pergunta,
      resposta: row.resposta,
      categoria: row.categoria,
      ordem: row.ordem,
      publicado: true,
    });
    if (error) throw new Error(error.message);
    inserted += 1;
  }
  revalidateConteudo();
  return { inserted, skipped };
}
