import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULTS_SORTEIO,
  type EventoSorteioRow,
  type HomeSorteioDestaque,
  type PublicSorteioView,
  type SorteioParticipanteRow,
} from "./types";

function mapPublicView(
  sorteio: {
    id: string;
    titulo: string | null;
    descricao: string | null;
    texto_agradecimento: string | null;
    status: string;
  },
  evento: { id: string; nome: string; slug: string; data_evento: string | null },
): PublicSorteioView {
  return {
    sorteioId: sorteio.id,
    eventoId: evento.id,
    eventoNome: evento.nome,
    eventoSlug: evento.slug,
    eventoData: evento.data_evento,
    titulo: sorteio.titulo?.trim() || DEFAULTS_SORTEIO.titulo,
    descricao: sorteio.descricao?.trim() || DEFAULTS_SORTEIO.descricao,
    textoAgradecimento:
      sorteio.texto_agradecimento?.trim() || DEFAULTS_SORTEIO.texto_agradecimento,
    status: sorteio.status === "encerrado" ? "encerrado" : "aberto",
  };
}

export async function fetchPublicSorteioByEventoSlug(slug: string): Promise<PublicSorteioView | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, nome, slug, data_evento")
    .eq("slug", normalized)
    .eq("ativo", true)
    .eq("publicado", true)
    .maybeSingle();
  if (evErr) {
    if (/eventos_sorteios|schema cache|does not exist|Could not find/i.test(evErr.message)) {
      return null;
    }
    throw new Error(evErr.message);
  }
  if (!evento) return null;

  const { data: sorteio, error } = await admin
    .from("eventos_sorteios")
    .select("id, titulo, descricao, texto_agradecimento, status, ativo")
    .eq("evento_id", evento.id)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    if (/eventos_sorteios/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!sorteio?.id) return null;

  return mapPublicView(sorteio, evento);
}

export async function fetchHomeSorteioDestaque(): Promise<HomeSorteioDestaque | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteios")
    .select("titulo, mostrar_home, ativo, status, eventos(nome, slug, ativo, publicado, evento_destaque, data_evento)")
    .eq("ativo", true)
    .eq("mostrar_home", true)
    .eq("status", "aberto")
    .order("updated_at", { ascending: false });

  if (error) {
    if (/eventos_sorteios/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }

  type Ev = {
    nome: string;
    slug: string;
    ativo: boolean;
    publicado: boolean;
    evento_destaque: boolean;
    data_evento: string | null;
  };

  const rows = (data ?? []) as Array<{
    titulo: string | null;
    eventos: Ev | Ev[] | null;
  }>;

  const eligible = rows
    .map((row) => {
      const evRaw = row.eventos;
      const ev = Array.isArray(evRaw) ? evRaw[0] : evRaw;
      if (!ev?.slug || !ev.ativo || !ev.publicado) return null;
      return {
        eventoNome: ev.nome,
        eventoSlug: ev.slug,
        titulo: row.titulo?.trim() || DEFAULTS_SORTEIO.titulo,
        destaque: ev.evento_destaque,
        data: ev.data_evento,
      };
    })
    .filter(Boolean) as Array<{
    eventoNome: string;
    eventoSlug: string;
    titulo: string;
    destaque: boolean;
    data: string | null;
  }>;

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    const da = a.data ? Date.parse(a.data) : 0;
    const db = b.data ? Date.parse(b.data) : 0;
    return db - da;
  });

  const top = eligible[0]!;
  return {
    eventoNome: top.eventoNome,
    eventoSlug: top.eventoSlug,
    titulo: top.titulo,
  };
}

export async function fetchSorteioAdminByEventoId(eventoId: string): Promise<EventoSorteioRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("eventos_sorteios").select("*").eq("evento_id", eventoId).maybeSingle();
  if (error) {
    if (/eventos_sorteios/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  return (data as EventoSorteioRow | null) ?? null;
}

export async function fetchParticipantesSorteioAdmin(sorteioId: string): Promise<SorteioParticipanteRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SorteioParticipanteRow[];
}
