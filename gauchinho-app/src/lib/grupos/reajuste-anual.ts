import type { GrupoConsorcio } from "@/lib/types";

export function descricaoReajusteAnual(grupo: Pick<GrupoConsorcio, "tipo_reajuste_anual" | "reajuste_anual_percentual" | "reajuste_anual_indice">): string | null {
  if (grupo.tipo_reajuste_anual === "FIXO" && Number(grupo.reajuste_anual_percentual) > 0) {
    return `Reajuste anual: ${Number(grupo.reajuste_anual_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% fixo`;
  }
  if (grupo.tipo_reajuste_anual === "VARIAVEL" && grupo.reajuste_anual_indice?.trim()) {
    return `Reajuste anual: ${grupo.reajuste_anual_indice.trim()}`;
  }
  return null;
}
