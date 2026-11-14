import type { EventoRow } from "./types";

/** Eventos que pertencem a um projeto comercial: o lead recebe o nome do projeto. */
export const PROJETOS_POR_EVENTO: Record<string, string> = {
  "heranca-inteligente": "Método Herança Inteligente",
};

export function projetoDoEvento(slug: string | null | undefined): string | null {
  return slug ? (PROJETOS_POR_EVENTO[slug] ?? null) : null;
}

type EventoLocal = Pick<EventoRow, "local" | "endereco" | "cidade" | "estado">;

/** "Presencial · Auditório da UniFECAF · Av. Embaúbas, 2114 · Sinop/MT" */
export function localAtendimentoEvento(evento: EventoLocal): string | null {
  const cidade = [evento.cidade, evento.estado].filter(Boolean).join("/");
  const partes = [evento.local, evento.endereco, cidade].map((p) => p?.trim()).filter(Boolean);
  return partes.length ? `Presencial · ${partes.join(" · ")}` : null;
}

/** "terça-feira, 17/11/2026 às 19:30" no horário de Sinop. */
export function quandoEvento(dataIso: string | null | undefined): string | null {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(/,? (\d{2}:\d{2})$/, " às $1");
}
