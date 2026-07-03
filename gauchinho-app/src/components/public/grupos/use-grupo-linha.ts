"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularLinhaSimulacaoGrupo,
  listarModalidadesLanceAtivas,
  resolveModalidadeLanceAtiva,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { parcelaTipoFromModalidade } from "@/lib/grupos/modalidades-admin";
import { parseBRLMoney } from "@/lib/formatters/money";

/** Valor em R$ a partir do texto do campo (máscara BRL ou número simples). */
export function parseRecursoProprioValorInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (/R\$|[,.]/.test(trimmed)) {
    const fromMask = parseBRLMoney(trimmed);
    return fromMask != null ? Math.max(0, fromMask) : 0;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function parseRecursoProprioPercentualInput(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function minimoRecursoValor(saldoDevedor: number, pct: number) {
  return Math.round(saldoDevedor * (pct / 100) * 100) / 100;
}

type Base = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  config: ConfigLinhaSimulacaoGrupo;
};

export function useGrupoLinhaCalculo({ grupo, cotas, modalidades, config }: Base) {
  const cota = cotas.find((c) => c.id === config.cotaId) ?? null;
  const resultado = calcularLinhaSimulacaoGrupo({
    grupo,
    cota,
    config,
    modalidades,
  });
  const mods = listarModalidadesLanceAtivas(grupo, modalidades);
  const modAtiva = resolveModalidadeLanceAtiva(config, mods);
  return { cota, resultado, mods, modAtiva };
}

export function createGrupoLinhaHandlers(
  config: ConfigLinhaSimulacaoGrupo,
  onChange: (next: ConfigLinhaSimulacaoGrupo) => void,
  mods: GrupoModalidadeLance[],
  pctMinRecurso: number,
) {
  function patch(partial: Partial<ConfigLinhaSimulacaoGrupo>) {
    onChange({ ...config, ...partial });
  }

  function onCotaChange(cotaId: string) {
    patch({
      cotaId,
      quantidadeCotas: config.quantidadeCotas > 0 ? config.quantidadeCotas : 1,
    });
  }

  function onQtyChange(raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    patch({ quantidadeCotas: n });
  }

  function selectModalidadeLance(mod: GrupoModalidadeLance) {
    const minPct = Number(mod.percentual_recurso_proprio_minimo) || 0;
    const pctEmb = Number(mod.percentual_lance_embutido) || 0;
    const parcelaFixa = parcelaTipoFromModalidade(mod);
    const next: ConfigLinhaSimulacaoGrupo = {
      ...config,
      modalidadeLanceId: mod.id,
      usaLanceEmbutido: pctEmb > 0,
    };
    if (parcelaFixa) {
      next.modalidadeParcela = parcelaFixa;
    }
    if (minPct > 0 && pctEmb > 0) {
      next.usaRecursoProprio = true;
      next.recursoProprioModo = "percentual";
      next.recursoProprioInput = Math.max(config.recursoProprioInput, minPct);
    } else {
      next.usaRecursoProprio = false;
    }
    onChange(next);
  }

  function clearLanceEmbutido() {
    onChange({
      ...config,
      usaLanceEmbutido: false,
      modalidadeLanceId: null,
      usaRecursoProprio: false,
    });
  }

  function onRecursoInputChange(raw: string) {
    let v =
      config.recursoProprioModo === "valor"
        ? parseRecursoProprioValorInput(raw)
        : parseRecursoProprioPercentualInput(raw);
    if (config.recursoProprioModo === "percentual" && pctMinRecurso > 0) {
      v = Math.max(v, pctMinRecurso);
    }
    patch({ recursoProprioInput: v });
  }

  function clearSelection() {
    patch({ quantidadeCotas: 0 });
  }

  return {
    patch,
    onCotaChange,
    onQtyChange,
    selectModalidadeLance,
    clearLanceEmbutido,
    onRecursoInputChange,
    clearSelection,
  };
}
