import type { GrupoModalidadeLance } from "@/lib/types";

export type ModalidadeLanceInput = {
  id?: string;
  nome: string;
  percentual_lance_embutido: number;
  percentual_recurso_proprio_minimo: number;
  descricao?: string | null;
  ativo: boolean;
  ordem: number;
  tipo_parcela?: "integral" | "reduzida" | null;
  percentual_parcela_reduzida?: number | null;
};

export function parseModalidadesJson(raw: string): ModalidadeLanceInput[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r === "object") as ModalidadeLanceInput[];
  } catch {
    return [];
  }
}

export function deriveGrupoFlagsFromModalidades(rows: ModalidadeLanceInput[]) {
  const active = rows.filter((r) => r.ativo !== false);
  const comLance = active.filter((r) => Number(r.percentual_lance_embutido) > 0);
  const comReduzida = active.filter((r) => r.tipo_parcela === "reduzida");

  const firstLance = comLance[0] ?? active[0];
  const firstReduzida = comReduzida[0];

  return {
    permite_lance_embutido: active.length > 0,
    tem_parcela_reduzida: comReduzida.length > 0,
    percentual_lance_embutido: firstLance ? Number(firstLance.percentual_lance_embutido) || 0 : 0,
    percentual_parcela_reduzida: firstReduzida
      ? Number(firstReduzida.percentual_parcela_reduzida) || 0
      : 0,
    percentual_recurso_proprio_sugerido: firstLance
      ? Number(firstLance.percentual_recurso_proprio_minimo) || 0
      : 0,
  };
}

export function legacyModalidadesFromGrupoRow(g: Record<string, unknown>): ModalidadeLanceInput[] {
  const out: ModalidadeLanceInput[] = [];
  const pctEmb = Number(g.percentual_lance_embutido ?? 0);
  const temReduzida = !!g.tem_parcela_reduzida;
  const pctRed = Number(g.percentual_parcela_reduzida ?? 0);

  if (g.permite_lance_embutido && pctEmb > 0) {
    out.push({
      nome: temReduzida ? `${pctEmb}% embutido + reduzida` : `${pctEmb}% lance embutido`,
      percentual_lance_embutido: pctEmb,
      percentual_recurso_proprio_minimo: Number(g.percentual_recurso_proprio_sugerido ?? 0),
      descricao: null,
      ativo: true,
      ordem: 0,
      tipo_parcela: temReduzida ? "reduzida" : "integral",
      percentual_parcela_reduzida: temReduzida ? pctRed || null : null,
    });
  } else if (temReduzida) {
    out.push({
      nome: "Parcela reduzida",
      percentual_lance_embutido: 0,
      percentual_recurso_proprio_minimo: 0,
      descricao: null,
      ativo: true,
      ordem: 0,
      tipo_parcela: "reduzida",
      percentual_parcela_reduzida: pctRed || null,
    });
  }
  return out;
}

export function parcelaTipoFromModalidade(
  mod: Pick<GrupoModalidadeLance, "tipo_parcela">,
): "integral" | "reduzida" | null {
  if (mod.tipo_parcela === "integral" || mod.tipo_parcela === "reduzida") return mod.tipo_parcela;
  return null;
}

export function labelParcelaModalidade(
  mod: Pick<GrupoModalidadeLance, "tipo_parcela" | "percentual_parcela_reduzida">,
): string | null {
  if (mod.tipo_parcela === "integral") return "Parcela integral";
  if (mod.tipo_parcela === "reduzida") {
    const pct = mod.percentual_parcela_reduzida;
    if (pct != null && pct > 0) return `Parcela reduzida (${pct}%)`;
    return "Parcela reduzida";
  }
  return null;
}
