/** Banco Central — SGS (séries temporais). */

export type BcbPonto = { data: string; valor: string };

export async function fetchBcbUltimo(serie: number): Promise<{ valor: number; data: string } | null> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const rows = (await res.json()) as BcbPonto[];
    const row = rows[0];
    if (!row) return null;
    const valor = Number(String(row.valor).replace(",", "."));
    if (!Number.isFinite(valor)) return null;
    return { valor, data: row.data };
  } catch {
    return null;
  }
}

/** IPCA acumulado 12 meses (%). */
export const BCB_SERIE_IPCA_12M = 433;
/** Selic meta % a.a. */
export const BCB_SERIE_SELIC_AA = 432;
/** CDI acumulado 12 meses (%). */
export const BCB_SERIE_CDI_12M = 4390;

export async function fetchIpcaAcumulado12m() {
  return fetchBcbUltimo(BCB_SERIE_IPCA_12M);
}

export async function fetchSelicAnual() {
  return fetchBcbUltimo(BCB_SERIE_SELIC_AA);
}

export async function fetchCdiAcumulado12m() {
  return fetchBcbUltimo(BCB_SERIE_CDI_12M);
}
