export type RegraIntegralizacaoParcela = "CONTEMPLACAO" | "ASSEMBLEIA";

function parseDataCivil(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function calcularAssembleiaMetade(prazoTotal: number): number {
  return Math.max(1, Math.ceil(prazoTotal / 2));
}

/**
 * A primeira assembleia é a de número 1. Se X é a última reduzida, a integral
 * começa na X+1, portanto a data civil avança X meses desde a primeira.
 */
export function calcularDataPrimeiraParcelaIntegral(
  dataPrimeiraAssembleia: string | null | undefined,
  assembleiaLimite: number | null | undefined,
): string | null {
  if (!dataPrimeiraAssembleia || !assembleiaLimite || assembleiaLimite < 1) return null;
  const date = parseDataCivil(dataPrimeiraAssembleia);
  if (!date) return null;
  const diaOriginal = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + assembleiaLimite);
  const ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
  date.setDate(Math.min(diaOriginal, ultimoDia));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatarDataCivilBR(value: string | null | undefined): string | null {
  const date = value ? parseDataCivil(value) : null;
  return date ? date.toLocaleDateString("pt-BR") : null;
}

export function descricaoIntegralizacaoParcela(grupo: {
  regra_integralizacao_parcela_reduzida?: string | null;
  assembleia_limite_parcela_reduzida?: number | null;
  data_primeira_assembleia?: string | null;
}): string | null {
  if (grupo.regra_integralizacao_parcela_reduzida === "CONTEMPLACAO") {
    return "A parcela reduzida permanece até a contemplação; depois passa à integral.";
  }
  if (grupo.regra_integralizacao_parcela_reduzida !== "ASSEMBLEIA") return null;
  const limite = Number(grupo.assembleia_limite_parcela_reduzida ?? 0);
  if (limite < 1) return null;
  const data = formatarDataCivilBR(
    calcularDataPrimeiraParcelaIntegral(grupo.data_primeira_assembleia, limite),
  );
  return `Parcela reduzida até a assembleia ${limite}. A integral começa na assembleia ${limite + 1}${data ? `, prevista para ${data}` : ""}; se houver contemplação antes, a mudança é antecipada.`;
}
