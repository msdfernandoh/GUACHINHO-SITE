"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularLinhaSimulacaoGrupo,
  listarModalidadesLanceAtivas,
  resolveModalidadeLanceAtiva,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { parcelaTipoFromModalidade } from "@/lib/grupos/modalidades-admin";

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
    const next: Partial<ConfigLinhaSimulacaoGrupo> = {
      cotaId,
      quantidadeCotas: config.quantidadeCotas > 0 ? config.quantidadeCotas : 1,
    };
    if (mods.length === 1 && !config.modalidadeLanceId) {
      const mod = mods[0]!;
      next.modalidadeLanceId = mod.id;
      next.usaLanceEmbutido = Number(mod.percentual_lance_embutido) > 0;
      const pt = parcelaTipoFromModalidade(mod);
      if (pt) next.modalidadeParcela = pt;
    }
    patch(next);
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
    let v = Number(raw) || 0;
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
