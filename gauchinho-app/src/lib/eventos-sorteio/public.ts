import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULTS_SORTEIO,
  type EventoSorteioRow,
  type HomeSorteioDestaque,
  type PublicSorteioView,
} from "./types";
import { parseNpsConfig, resolverPerguntasNpsPublicas, type NpsPerguntaPublica } from "./nps";

function mapPublicView(
  sorteio: {
    id: string;
    titulo: string | null;
    descricao: string | null;
    texto_agradecimento: string | null;
    status: string;
    nps_config?: unknown;
  },
  evento: {
    id: string;
    nome: string;
    slug: string;
    data_evento: string | null;
    checkin_interativo_ativo?: boolean | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    logo_personalizado_url?: string | null;
    prefixo_codigo_sorteio?: string | null;
  },
  npsPerguntas?: NpsPerguntaPublica[],
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
    npsPerguntas:
      npsPerguntas ?? resolverPerguntasNpsPublicas(parseNpsConfig(sorteio.nps_config)),
    checkinInterativoAtivo: Boolean(evento.checkin_interativo_ativo),
    corPrimaria: evento.cor_primaria ?? null,
    corSecundaria: evento.cor_secundaria ?? null,
    logoPersonalizadoUrl: evento.logo_personalizado_url ?? null,
    prefixoCodigoSorteio: evento.prefixo_codigo_sorteio ?? null,
  };
}

export async function fetchPublicSorteioByEventoSlug(
  slug: string,
  options?: { requirePublicado?: boolean; allowFallback?: boolean },
): Promise<PublicSorteioView | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, nome, slug, data_evento")
    .ilike("slug", normalized)
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

  return fetchPublicSorteioByEventoId(evento.id as string, {
    requirePublicado: options?.requirePublicado !== false,
    allowFallback: options?.allowFallback,
  });
}

/**
 * Carrega o formulário público do sorteio (com NPS e check-in) pelo id do evento.
 * Usado pelo QR único para não depender de slug/publicado quando o vínculo já existe.
 */
export async function fetchPublicSorteioByEventoId(
  eventoId: string,
  options?: { requirePublicado?: boolean; allowFallback?: boolean },
): Promise<PublicSorteioView | null> {
  const requirePublicado = options?.requirePublicado !== false;
  if (!eventoId?.trim()) return null;

  const admin = createAdminClient();
  let evQuery = admin
    .from("eventos")
    .select("id, nome, slug, data_evento, ativo, publicado, checkin_interativo_ativo, cor_primaria, cor_secundaria, logo_personalizado_url, prefixo_codigo_sorteio")
    .eq("id", eventoId)
    .eq("ativo", true);
  if (requirePublicado) {
    evQuery = evQuery.eq("publicado", true);
  }
  let { data: evento, error: evErr } = await evQuery.maybeSingle();
  if (evErr && /checkin_interativo_ativo|cor_primaria|prefixo_codigo_sorteio|Could not find/i.test(evErr.message)) {
    // Fallback para schema sem as colunas novas
    let retryQuery = admin
      .from("eventos")
      .select("id, nome, slug, data_evento, ativo, publicado")
      .eq("id", eventoId)
      .eq("ativo", true);
    if (requirePublicado) retryQuery = retryQuery.eq("publicado", true);
    const retry = await retryQuery.maybeSingle();
    evento = retry.data
      ? {
          ...retry.data,
          checkin_interativo_ativo: false,
          cor_primaria: null,
          cor_secundaria: null,
          logo_personalizado_url: null,
          prefixo_codigo_sorteio: "",
        }
      : null;
    evErr = retry.error;
  }
  if (evErr) {
    if (/eventos_sorteios|schema cache|does not exist|Could not find/i.test(evErr.message)) {
      return null;
    }
    throw new Error(evErr.message);
  }
  if (!evento) return null;

  const { data: sorteio, error } = await admin
    .from("eventos_sorteios")
    .select("id, titulo, descricao, texto_agradecimento, status, ativo, nps_config")
    .eq("evento_id", evento.id)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    if (/eventos_sorteios/.test(error.message) && /schema cache|does not exist|Could not find/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  type EvType = {
    id: string;
    nome: string;
    slug: string;
    data_evento: string | null;
    checkin_interativo_ativo?: boolean | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    logo_personalizado_url?: string | null;
    prefixo_codigo_sorteio?: string | null;
  };

  if (!sorteio?.id) {
    if (evento.checkin_interativo_ativo || options?.allowFallback) {
      return mapPublicView(
        {
          id: evento.id,
          titulo: DEFAULTS_SORTEIO.titulo,
          descricao: DEFAULTS_SORTEIO.descricao,
          texto_agradecimento: DEFAULTS_SORTEIO.texto_agradecimento,
          status: "aberto",
          nps_config: {},
        },
        evento as EvType,
      );
    }
    return null;
  }

  return mapPublicView(sorteio, evento as EvType);
}

export async function fetchHomeSorteioDestaque(): Promise<HomeSorteioDestaque | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("eventos_sorteios")
      .select("titulo, mostrar_home, ativo, status, eventos(nome, slug, ativo, publicado, evento_destaque, data_evento)")
      .eq("ativo", true)
      .eq("mostrar_home", true)
      .eq("status", "aberto")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[fetchHomeSorteioDestaque]", error.message);
      return null;
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
  } catch (err) {
    console.error("[fetchHomeSorteioDestaque]", err);
    return null;
  }
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

export { fetchParticipantesSorteioAdmin } from "./sync-inscritos";
