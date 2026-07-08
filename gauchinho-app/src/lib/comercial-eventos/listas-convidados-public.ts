import { createAdminClient } from "@/lib/supabase/admin";
import { resolveConvidadoPor } from "@/lib/comercial-eventos/listas-convidados-stats";

export type PublicListaConvidadosView = {
  id: string;
  slug: string;
  consultor_nome: string;
  evento_nome: string;
  evento_data: string | null;
};

export async function fetchPublicListaConvidadosBySlug(
  slug: string,
): Promise<PublicListaConvidadosView | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_listas_convidados")
    .select("id, slug, consultor_nome, publica, eventos(nome, data_evento)")
    .eq("slug", normalized)
    .eq("publica", true)
    .maybeSingle();

  if (error) {
    if (/publica|slug/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!data?.slug) return null;

  const evRaw = data.eventos as { nome: string; data_evento: string | null } | { nome: string; data_evento: string | null }[] | null;
  const ev = Array.isArray(evRaw) ? evRaw[0] : evRaw;
  return {
    id: data.id,
    slug: data.slug,
    consultor_nome: data.consultor_nome,
    evento_nome: ev?.nome ?? "Evento",
    evento_data: ev?.data_evento ?? null,
  };
}

export async function inscreverConvidadoListaPublica(
  slug: string,
  guest: { nome: string; empresa?: string; telefone?: string; convidado_por?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lista = await fetchPublicListaConvidadosBySlug(slug);
  if (!lista) return { ok: false, error: "Lista não encontrada ou não está pública." };

  const nome = guest.nome?.trim();
  if (!nome) return { ok: false, error: "Informe o nome." };

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("eventos_listas_convidados_itens")
    .select("ordem")
    .eq("lista_id", lista.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = (last?.ordem ?? -1) + 1;

  const { error } = await admin.from("eventos_listas_convidados_itens").insert({
    lista_id: lista.id,
    nome,
    empresa: guest.empresa?.trim() || null,
    telefone: guest.telefone?.trim() || null,
    convidado_por: resolveConvidadoPor(guest.convidado_por, lista.consultor_nome),
    ordem,
  });

  if (error) return { ok: false, error: error.message };

  await admin
    .from("eventos_listas_convidados")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", lista.id);

  return { ok: true };
}
