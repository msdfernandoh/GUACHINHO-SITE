export const AGENDA_TIME_ZONE = "America/Cuiaba";

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
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

/** Converte data/hora civil do escritório para instante UTC, independente do fuso do servidor. */
export function agendaLocalDateTimeToIso(date: string, time: string, timeZone = AGENDA_TIME_ZONE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || !timeMatch) throw new Error("Data ou hora inválida.");
  const wanted = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: Number(timeMatch[3] ?? 0),
  };
  const wallAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, wanted.second);
  const civil = new Date(wallAsUtc);
  if (wanted.year < 1900 || wanted.year > 9999 || civil.toISOString().slice(0, 10) !== date ||
      wanted.hour > 23 || wanted.minute > 59 || wanted.second > 59) throw new Error("Data ou hora inválida.");
  let candidate = wallAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shown = zoneParts(new Date(candidate), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    candidate += wallAsUtc - shownAsUtc;
  }
  const result = new Date(candidate);
  if (Number.isNaN(result.getTime())) throw new Error("Data ou hora inválida.");
  const actual = zoneParts(result, timeZone);
  if (Object.keys(wanted).some((key) => actual[key as keyof typeof actual] !== wanted[key as keyof typeof wanted])) {
    throw new Error("Horário inexistente neste fuso.");
  }
  return result.toISOString();
}

export function agendaDateKey(iso: string | Date): string {
  const p = zoneParts(new Date(iso), AGENDA_TIME_ZONE);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function agendaTimeKey(iso: string): string {
  const p = zoneParts(new Date(iso), AGENDA_TIME_ZONE);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function agendaFormRange(form: FormData, defaultMinutes = 60) {
  const date = String(form.get("data") ?? "");
  const diaInteiro = form.get("dia_inteiro") === "on";
  if (diaInteiro) return { ...agendaAllDayRange(date), duracao: 1440, diaInteiro };
  const separated = form.has("duracao_horas");
  const hours = Number(form.get("duracao_horas") ?? 0);
  const minutes = Number(form.get("duracao_minutos_restantes") ?? 0);
  const duracao = separated ? hours * 60 + minutes : Number(form.get("duracao_minutos") ?? defaultMinutes);
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > 10080 ||
      (separated && (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59))) {
    throw new Error("Informe a duração em horas e minutos (1 minuto a 7 dias; minutos de 0 a 59).");
  }
  const inicio = agendaLocalDateTimeToIso(date, String(form.get("hora") ?? "09:00"));
  return { inicio, fim: new Date(Date.parse(inicio) + duracao * 60000).toISOString(), duracao, diaInteiro };
}

export function agendaAllDayRange(date: string): { inicio: string; fim: string } {
  const inicio = agendaLocalDateTimeToIso(date, "00:00");
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { inicio, fim: agendaLocalDateTimeToIso(next, "00:00") };
}
