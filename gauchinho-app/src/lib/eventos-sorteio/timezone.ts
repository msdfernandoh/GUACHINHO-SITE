/**
 * Módulo de Fuso Horário Oficial para Eventos
 *
 * Garante que a entrada e exibição de data/hora dos eventos ocorra estritamente
 * no fuso horário da operação local (America/Cuiaba — UTC-4), eliminando qualquer
 * deslocamento decorrente de servidores em UTC (Vercel) ou navegadores em outros fusos.
 */

export const EVENTO_TIME_ZONE = "America/Cuiaba";

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/**
 * Converte data/hora local de formulário ("YYYY-MM-DDTHH:mm") no fuso de Cuiabá
 * para instante UTC ISO ("YYYY-MM-DDTHH:mm:ss.sssZ"), independente do fuso do servidor.
 */
export function eventoLocalDateTimeToIso(
  raw: string | null | undefined,
  timeZone = EVENTO_TIME_ZONE,
): string | null {
  if (!raw || !raw.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) throw new Error("Data ou hora do evento inválida.");

  const wanted = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };

  const wallAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, wanted.second);
  let candidate = wallAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shown = zoneParts(new Date(candidate), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    candidate += wallAsUtc - shownAsUtc;
  }

  const result = new Date(candidate);
  if (Number.isNaN(result.getTime())) throw new Error("Data ou hora inválida.");

  const actual = zoneParts(result, timeZone);
  if (
    actual.year !== wanted.year ||
    actual.month !== wanted.month ||
    actual.day !== wanted.day ||
    actual.hour !== wanted.hour ||
    actual.minute !== wanted.minute
  ) {
    throw new Error("Horário inexistente ou ambíguo neste fuso horário.");
  }

  return result.toISOString();
}

/**
 * Converte um instante UTC ISO do banco para a string "YYYY-MM-DDTHH:mm" no fuso de Cuiabá,
 * perfeita para alimentar o valor default do `<input type="datetime-local">` sem desvios.
 */
export function eventoIsoToDatetimeLocal(
  iso: string | null | undefined,
  timeZone = EVENTO_TIME_ZONE,
): string {
  if (!iso || !iso.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = zoneParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Formata um instante UTC para exibição legível em português no fuso de Cuiabá.
 * Exemplo: "16/09/2026 às 18:30"
 */
export function formatarDataHoraEvento(
  iso: string | null | undefined,
  timeZone = EVENTO_TIME_ZONE,
): string {
  if (!iso || !iso.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = zoneParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)}/${p.year} às ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Formata apenas o horário (HH:mm) no fuso de Cuiabá.
 * Exemplo: "18:30"
 */
export function formatarHoraEvento(
  iso: string | null | undefined,
  timeZone = EVENTO_TIME_ZONE,
): string {
  if (!iso || !iso.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = zoneParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Formata apenas a data (DD/MM/AAAA) no fuso de Cuiabá.
 * Exemplo: "16/09/2026"
 */
export function formatarDataEvento(
  iso: string | null | undefined,
  timeZone = EVENTO_TIME_ZONE,
): string {
  if (!iso || !iso.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = zoneParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}
