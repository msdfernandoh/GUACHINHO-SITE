import { eventoLocalDateTimeToIso } from "@/lib/eventos-sorteio/timezone";

/** Períodos do calendário local; semana começa na segunda-feira. */
export function periodosLeadsDashboard(agora = new Date()) {
  const dataLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
  const diaCalendario = new Date(`${dataLocal}T12:00:00Z`);
  const segunda = new Date(diaCalendario);
  segunda.setUTCDate(segunda.getUTCDate() - ((segunda.getUTCDay() + 6) % 7));
  const inicio = (data: string) => eventoLocalDateTimeToIso(`${data}T00:00`)!;
  return {
    dia: inicio(dataLocal),
    semana: inicio(segunda.toISOString().slice(0, 10)),
    mes: inicio(`${dataLocal.slice(0, 7)}-01`),
    ate: agora.toISOString(),
  };
}
