import { createAdminClient } from "@/lib/supabase/admin";
import type { CasoSucesso, Depoimento, DicaTche, ParceiroInstitucional, PerguntaFrequente } from "./types";

function admin() {
  return createAdminClient();
}

export async function fetchPublicCasosSucesso(opts?: {
  categoria?: string;
  destaque?: boolean;
  limit?: number;
}): Promise<CasoSucesso[]> {
  try {
    let q = admin().from("casos_sucesso").select("*").eq("publicado", true);
    if (opts?.categoria) q = q.eq("categoria", opts.categoria);
    if (opts?.destaque) q = q.eq("destaque", true);
    const { data, error } = await q.order("ordem").order("created_at", { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as CasoSucesso[];
    return opts?.limit ? list.slice(0, opts.limit) : list;
  } catch {
    return [];
  }
}

export async function fetchPublicCasoBySlug(slug: string): Promise<CasoSucesso | null> {
  try {
    const { data, error } = await admin()
      .from("casos_sucesso")
      .select("*")
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle();
    if (error) throw error;
    return (data as CasoSucesso) ?? null;
  } catch {
    return null;
  }
}

export async function fetchPublicDicas(opts?: {
  categoria?: string;
  destaque?: boolean;
  limit?: number;
}): Promise<DicaTche[]> {
  try {
    let q = admin().from("dicas_tche").select("*").eq("publicado", true);
    if (opts?.categoria) q = q.eq("categoria", opts.categoria);
    if (opts?.destaque) q = q.eq("destaque", true);
    const { data, error } = await q.order("ordem").order("created_at", { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as DicaTche[];
    return opts?.limit ? list.slice(0, opts.limit) : list;
  } catch {
    return [];
  }
}

export async function fetchPublicDicaBySlug(slug: string): Promise<DicaTche | null> {
  try {
    const { data, error } = await admin()
      .from("dicas_tche")
      .select("*")
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle();
    if (error) throw error;
    return (data as DicaTche) ?? null;
  } catch {
    return null;
  }
}

export async function fetchPublicFaq(): Promise<PerguntaFrequente[]> {
  try {
    const { data, error } = await admin()
      .from("perguntas_frequentes")
      .select("*")
      .eq("publicado", true)
      .order("ordem")
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as PerguntaFrequente[];
  } catch {
    return [];
  }
}

export async function fetchPublicDepoimentos(limit?: number): Promise<Depoimento[]> {
  try {
    const { data, error } = await admin()
      .from("depoimentos")
      .select("*")
      .eq("publicado", true)
      .order("ordem")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as Depoimento[];
    return limit ? list.slice(0, limit) : list;
  } catch {
    return [];
  }
}

export async function fetchPublicParceiros(opts?: {
  destaque?: boolean;
  limit?: number;
}): Promise<ParceiroInstitucional[]> {
  try {
    let q = admin().from("parceiros").select("*").eq("publicado", true);
    if (opts?.destaque) q = q.eq("destaque", true);
    const { data, error } = await q.order("ordem").order("nome");
    if (error) throw error;
    const list = (data ?? []) as ParceiroInstitucional[];
    return opts?.limit ? list.slice(0, opts.limit) : list;
  } catch {
    return [];
  }
}

export function seoFromCaso(c: CasoSucesso) {
  return {
    title: c.seo_title?.trim() || c.titulo,
    description: c.seo_description?.trim() || c.descricao_curta?.trim() || "",
  };
}

export function seoFromDica(d: DicaTche) {
  return {
    title: d.seo_title?.trim() || d.titulo,
    description: d.seo_description?.trim() || d.descricao_curta?.trim() || "",
  };
}
