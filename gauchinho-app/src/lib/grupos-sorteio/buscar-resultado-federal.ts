const CAIXA_FEDERAL_API =
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/federal";
const FONTE_CAIXA = "caixa_portaldeloterias_api";
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type BuscaFederalResult = {
  encontrado: boolean;
  primeiroPremio?: string;
  concurso?: string;
  dataSorteio?: string;
  fonte?: string;
  mensagem?: string;
};

type CaixaFederalPayload = {
  numero?: number;
  dataApuracao?: string;
  dezenasSorteadasOrdemSorteio?: string[];
};

export function normalizarDataSorteioIso(data: string): string | null {
  const t = data.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function parseBrDateToIso(dataApuracao: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataApuracao.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoToBr(dataIso: string): string {
  const [y, m, d] = dataIso.split("-");
  return `${d}/${m}/${y}`;
}

/** Extrai 5 dígitos do 1º número sorteado (bilhete federal com 6 dígitos na API). */
export function extrairPrimeiroPremioFederal(dezenas: string[] | undefined): string | null {
  const raw = dezenas?.[0]?.replace(/\D/g, "") ?? "";
  if (raw.length < 5) return null;
  const cinco = raw.slice(-5);
  return /^\d{5}$/.test(cinco) ? cinco : null;
}

async function fetchConcursoFederal(numero: number): Promise<CaixaFederalPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${CAIXA_FEDERAL_API}/${numero}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CaixaFederalPayload;
    if (!json?.numero || !json.dataApuracao) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Maior número de concurso publicado (busca binária + extensão linear). */
async function findMaxConcursoNumber(): Promise<number> {
  let lo = 5500;
  let hi = 7000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const payload = await fetchConcursoFederal(mid);
    if (payload?.numero) lo = mid;
    else hi = mid - 1;
  }
  let n = lo;
  for (let i = 0; i < 30; i++) {
    const next = await fetchConcursoFederal(n + 1);
    if (!next?.numero) break;
    n = next.numero;
  }
  return n;
}

async function findConcursoByDateIso(dataIso: string): Promise<CaixaFederalPayload | null> {
  const max = await findMaxConcursoNumber();
  let lo = Math.max(1, max - 400);
  let hi = max;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const payload = await fetchConcursoFederal(mid);
    if (!payload) {
      hi = mid - 1;
      continue;
    }
    const dataApuracao = payload.dataApuracao;
    if (!dataApuracao) {
      hi = mid - 1;
      continue;
    }
    const iso = parseBrDateToIso(dataApuracao);
    if (!iso) {
      hi = mid - 1;
      continue;
    }
    if (iso === dataIso) return payload;
    if (iso < dataIso) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

/** Tenta endpoint com query de data (comportamento variável na API Caixa). */
async function buscarPorQueryDataCaixa(dataIso: string): Promise<CaixaFederalPayload | null> {
  const dataBr = isoToBr(dataIso);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${CAIXA_FEDERAL_API}?data=${encodeURIComponent(dataBr)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CaixaFederalPayload;
    if (!json?.numero || !json.dataApuracao) return null;
    const iso = parseBrDateToIso(json.dataApuracao);
    if (iso !== dataIso) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function payloadParaResultado(
  payload: CaixaFederalPayload,
  dataIso: string,
  fonte: string,
): BuscaFederalResult {
  const primeiroPremio = extrairPrimeiroPremioFederal(payload.dezenasSorteadasOrdemSorteio);
  if (!primeiroPremio) {
    return {
      encontrado: false,
      mensagem:
        "Não encontramos resultado da Loteria Federal para esta data. Confira a data ou informe o 1º prêmio manualmente.",
    };
  }
  return {
    encontrado: true,
    primeiroPremio,
    concurso: String(payload.numero),
    dataSorteio: parseBrDateToIso(payload.dataApuracao!) ?? dataIso,
    fonte,
  };
}

export async function buscarPrimeiroPremioFederalPorData(
  data: string,
): Promise<BuscaFederalResult> {
  const dataIso = normalizarDataSorteioIso(data);
  if (!dataIso) {
    return {
      encontrado: false,
      mensagem: "Data inválida. Use o formato AAAA-MM-DD ou DD/MM/AAAA.",
    };
  }

  try {
    const porQuery = await buscarPorQueryDataCaixa(dataIso);
    if (porQuery) return payloadParaResultado(porQuery, dataIso, FONTE_CAIXA);

    const payload = await findConcursoByDateIso(dataIso);
    if (!payload) {
      return {
        encontrado: false,
        mensagem:
          "Não encontramos resultado da Loteria Federal para esta data. Confira a data ou informe o 1º prêmio manualmente.",
      };
    }

    return payloadParaResultado(payload, dataIso, FONTE_CAIXA);
  } catch {
    return {
      encontrado: false,
      mensagem:
        "Não foi possível consultar o resultado agora. Informe o 1º prêmio manualmente.",
    };
  }
}
