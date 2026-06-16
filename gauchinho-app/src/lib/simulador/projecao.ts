import type { EntradaConsorcio, LinhaProjecaoAnual } from "./consorcio";
import { calcularProjecaoConsorcio } from "./consorcio";

export type { LinhaProjecaoAnual };

export {
  calcularCreditoReajustado,
  calcularGanhoPatrimonialEstimado,
  calcularTotalPagoAcumulado,
  calcularParcelaNoAno,
} from "./consorcio";

/** @deprecated use calcularProjecaoConsorcio — mantido para imports existentes */
export function gerarProjecaoAnoAno(entrada: EntradaConsorcio): LinhaProjecaoAnual[] {
  return calcularProjecaoConsorcio(entrada);
}

export function resumoProjecaoAnos(
  linhas: LinhaProjecaoAnual[],
  anos: number[],
): LinhaProjecaoAnual[] {
  return anos
    .map((a) => linhas.find((l) => l.ano === a))
    .filter((l): l is LinhaProjecaoAnual => !!l);
}
