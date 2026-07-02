import type { IndiceFinanceiroRow } from "./types";

export type ValidacaoIndiceResult =
  | { ok: true; valor_anual?: number; valor_mensal?: number; valor_acumulado_12m?: number }
  | { ok: false; message: string };

function inRange(v: number, min: number, max: number) {
  return v >= min && v <= max;
}

/** Rejeita taxa diária salva como anual (ex.: CDI 0,05). */
export function validarValoresIndiceAutomatico(
  codigo: string,
  fields: {
    valor_anual?: number | null;
    valor_mensal?: number | null;
    valor_acumulado_12m?: number | null;
  },
): ValidacaoIndiceResult {
  const anual = fields.valor_anual ?? undefined;
  const mensal = fields.valor_mensal ?? undefined;
  const acum12 = fields.valor_acumulado_12m ?? undefined;

  if (codigo === "cdi" || codigo === "selic") {
    if (anual != null && !inRange(anual, 1, 30)) {
      return {
        ok: false,
        message:
          anual < 1
            ? "A fonte retornou taxa diária ou mensal incompatível. Verifique o mapeamento antes de salvar como taxa anual."
            : `Taxa anual fora da faixa esperada (${anual}%).`,
      };
    }
    if (mensal != null && !inRange(mensal, 0, 5)) {
      return { ok: false, message: `Taxa mensal fora da faixa esperada (${mensal}%).` };
    }
  }

  if (codigo === "poupanca" && mensal != null && !inRange(mensal, 0, 2)) {
    return { ok: false, message: `Poupança mensal fora da faixa (${mensal}%).` };
  }

  if (codigo === "ipca" && acum12 != null && !inRange(acum12, -5, 20)) {
    return { ok: false, message: `IPCA 12m fora da faixa (${acum12}%).` };
  }

  if (codigo === "igpm" && acum12 != null && !inRange(acum12, -10, 40)) {
    return { ok: false, message: `IGP-M 12m fora da faixa (${acum12}%).` };
  }

  return { ok: true, valor_anual: anual, valor_mensal: mensal, valor_acumulado_12m: acum12 };
}

export function mensagemPreservacaoFallback(row: IndiceFinanceiroRow | null): string {
  if (!row) return "Não foi possível atualizar automaticamente.";
  const parts: string[] = [];
  if (row.valor_anual != null) parts.push(`anual ${row.valor_anual}%`);
  if (row.valor_mensal != null) parts.push(`mensal ${row.valor_mensal}%`);
  if (row.valor_acumulado_12m != null) parts.push(`12m ${row.valor_acumulado_12m}%`);
  return parts.length
    ? `Não foi possível atualizar automaticamente. Mantido o último valor válido (${parts.join(", ")}).`
    : "Não foi possível atualizar automaticamente. Mantido o último valor cadastrado.";
}
