import { createAdminClient } from "@/lib/supabase/admin";
import type { EventoPostRow, EventoRow } from "./types";

export async function fetchPublicEventosList(): Promise<EventoRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos")
    .select("*")
    .eq("ativo", true)
    .eq("publicado", true)
    .eq("somente_por_link", false)
    .order("data_evento", { ascending: true, nullsFirst: false });
  if (error) {
    if (/eventos/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as EventoRow[];
}

export async function fetchPublicEventoBySlug(slug: string): Promise<EventoRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .eq("publicado", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventoRow | null) ?? null;
}

export async function fetchPublicEventoDestaque(): Promise<EventoRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos")
    .select("*")
    .eq("ativo", true)
    .eq("publicado", true)
    .eq("evento_destaque", true)
    .order("data_evento", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/eventos/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  return (data as EventoRow | null) ?? null;
}

export async function fetchPublicEventoPosts(eventoId: string): Promise<EventoPostRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_posts")
    .select("*")
    .eq("evento_id", eventoId)
    .eq("publicado", true)
    .order("ordem")
    .order("created_at", { ascending: false });
  if (error) {
    if (/eventos_posts/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as EventoPostRow[];
}

export async function countVagasUsadasEvento(eventoId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_participantes")
    .select("quantidade_vagas, status")
    .eq("evento_id", eventoId)
    .in("status", ["confirmado", "presente"]);
  if (error) throw new Error(error.message);
  const { somarVagasUsadas } = await import("./vagas");
  return somarVagasUsadas((data ?? []) as { quantidade_vagas: number; status: "confirmado" | "presente" }[]);
}
