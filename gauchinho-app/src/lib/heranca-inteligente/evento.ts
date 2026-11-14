import "server-only";

import { countVagasUsadasEvento, fetchPublicEventoBySlug } from "@/lib/comercial-eventos/public";
import { vagasRestantes } from "@/lib/comercial-eventos/vagas";
import { HERANCA_EVENTO_SLUG } from "./lead";

export type HerancaEvento = {
  slug: string;
  nome: string;
  dataIso: string | null;
  local: string | null;
  endereco: string | null;
  cidade: string | null;
  /** null = sem limite ou vagas ocultas. */
  vagasRestantes: number | null;
};

/** Evento do Método Herança Inteligente (ativo e publicado), com vagas restantes. */
export async function carregarEventoHeranca(): Promise<HerancaEvento | null> {
  const evento = await fetchPublicEventoBySlug(HERANCA_EVENTO_SLUG).catch(() => null);
  if (!evento) return null;
  const usadas = evento.limite_participantes ? await countVagasUsadasEvento(evento.id).catch(() => 0) : 0;
  return {
    slug: evento.slug,
    nome: evento.nome,
    dataIso: evento.data_evento,
    local: evento.local,
    endereco: evento.endereco,
    cidade: [evento.cidade, evento.estado].filter(Boolean).join("/") || null,
    vagasRestantes: evento.mostrar_vagas ? vagasRestantes(evento.limite_participantes, usadas) : null,
  };
}

/** "quinta-feira, 27 de novembro, às 19h" no horário de Sinop. */
export function rotuloDataEvento(dataIso: string | null): string | null {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", weekday: "long", day: "numeric", month: "long" }).format(d);
  const [h, m] = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .split(":");
  return `${dia}, às ${Number(h)}h${m && m !== "00" ? m : ""}`;
}

/** Evento pronto para os componentes cliente. */
export async function carregarEventoHerancaView() {
  const e = await carregarEventoHeranca();
  return e ? { ...e, dataLabel: rotuloDataEvento(e.dataIso) } : null;
}
