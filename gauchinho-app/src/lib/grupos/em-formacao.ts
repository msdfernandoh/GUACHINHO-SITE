function hojeCivilISO(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function grupoEmFormacao(
  dataPrimeiraAssembleia: string | null | undefined,
  agora = new Date(),
): boolean {
  const dataCivil = dataPrimeiraAssembleia?.slice(0, 10);
  return Boolean(dataCivil && /^\d{4}-\d{2}-\d{2}$/.test(dataCivil) && dataCivil > hojeCivilISO(agora));
}
