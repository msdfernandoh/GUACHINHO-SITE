const CAIXA_FEDERAL_API =
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/federal";
const FONTE_CAIXA = "caixa_portaldeloterias_api";
const FETCH_TIMEOUT_MS = 12_000;

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

function parseBrDateToIso(dataApuracao: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataApuracao.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
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
        "User-Agent": "GauchinhoConsorcios/1.0",
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

async function findLatestConcursoNumber(): Promise<number> {
  let low = 5500;
  let high = 6500;
  let best = 6000;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const payload = await fetchConcursoFederal(mid);
    if (payload?.numero) {
      best = payload.numero;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

async function findConcursoByDateIso(dataIso: string): Promise<CaixaFederalPayload | null> {
  let numero = await findLatestConcursoNumber();
  for (let i = 0; i < 120; i++) {
    const payload = await fetchConcursoFederal(numero);
    if (!payload?.dataApuracao) {
      numero -= 1;
      continue;
    }
    const iso = parseBrDateToIso(payload.dataApuracao);
    if (!iso) {
      numero -= 1;
      continue;
    }
    if (iso === dataIso) return payload;
    if (iso > dataIso) numero -= 1;
    else numero += 1;
  }
  return null;
}

export async function buscarPrimeiroPremioFederalPorData(
  data: string,
): Promise<BuscaFederalResult> {
  const dataIso = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
  if (!dataIso) {
    return {
      encontrado: false,
      mensagem: "Data inválida. Use o formato AAAA-MM-DD.",
    };
  }

  try {
    const payload = await findConcursoByDateIso(dataIso);
    if (!payload) {
      return {
        encontrado: false,
        mensagem:
          "Não encontramos resultado da Loteria Federal para esta data. Confira a data ou informe o 1º prêmio manualmente.",
      };
    }

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
      fonte: FONTE_CAIXA,
    };
  } catch {
    return {
      encontrado: false,
      mensagem:
        "Não foi possível consultar o resultado agora. Informe o 1º prêmio manualmente.",
    };
  }
}
