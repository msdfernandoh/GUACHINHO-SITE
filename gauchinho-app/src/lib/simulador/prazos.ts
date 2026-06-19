import type { FinanciamentoConfig, SimuladorTipoBemConfig } from "@/lib/config/defaults";

/** Mesma base do simulador completo (`simulador-app`). */
export const PRAZOS_FINANCIAMENTO_BASE = [60, 84, 120, 180, 220, 240, 300, 360] as const;

export function parsePrazosLista(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function listPrazosFinanciamento(fin: FinanciamentoConfig): number[] {
  const custom = fin.prazosDisponiveis?.filter((p) => p > 0) ?? [];
  if (custom.length) {
    const list = [...new Set(custom)];
    if (fin.prazoPadrao > 0 && !list.includes(fin.prazoPadrao)) list.push(fin.prazoPadrao);
    return list.sort((a, b) => a - b);
  }
  const max = fin.prazoMaximo > 0 ? fin.prazoMaximo : 360;
  const list: number[] = [...PRAZOS_FINANCIAMENTO_BASE.filter((p) => p <= max)];
  if (fin.prazoPadrao > 0 && !list.includes(fin.prazoPadrao)) list.push(fin.prazoPadrao);
  return [...new Set(list)].sort((a, b) => a - b);
}

export function listPrazosConsorcio(cfg: SimuladorTipoBemConfig): number[] {
  const list = cfg.prazosDisponiveis?.length ? [...cfg.prazosDisponiveis] : [cfg.prazoPadrao];
  const max = cfg.quantidadePrazosExibidos ?? list.length;
  const sliced = list.slice(0, max).filter((n) => n > 0);
  if (cfg.prazoPadrao > 0 && !sliced.includes(cfg.prazoPadrao)) {
    sliced.push(cfg.prazoPadrao);
  }
  return [...new Set(sliced)].sort((a, b) => a - b);
}

/** Escolhe o prazo configurado mais próximo (preferência: não ultrapassar). */
export function snapPrazoToLista(prazo: number, opcoes: number[], fallback: number): number {
  if (!opcoes.length) return Math.max(1, fallback);
  if (opcoes.includes(prazo)) return prazo;
  let best = opcoes[0];
  let bestDist = Math.abs(prazo - best);
  for (const p of opcoes) {
    const d = Math.abs(prazo - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}
