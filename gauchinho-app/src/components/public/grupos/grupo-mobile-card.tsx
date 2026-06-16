"use client";

import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import type { ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { CompactNumberInput, CompactSelect } from "@/components/public/grupos/grupos-primitives";
import { GrupoRowAdjustments } from "@/components/public/grupos/grupo-row-adjustments";
import { GrupoPrazoCell } from "@/components/public/grupos/grupo-row";
import { createGrupoLinhaHandlers, useGrupoLinhaCalculo } from "@/components/public/grupos/use-grupo-linha";

type Props = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  config: ConfigLinhaSimulacaoGrupo;
  onChange: (next: ConfigLinhaSimulacaoGrupo) => void;
};

export function GrupoMobileCard({ grupo, cotas, modalidades, config, onChange }: Props) {
  const [showAdjust, setShowAdjust] = useState(false);
  const { resultado, mods, modAtiva } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
  });
  const pctMinRecurso = modAtiva ? Number(modAtiva.percentual_recurso_proprio_minimo) : 0;
  const handlers = createGrupoLinhaHandlers(config, onChange, mods, pctMinRecurso);

  return (
    <article
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/80",
        resultado.ativo && "border-amber-500/35",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <p className="text-lg font-semibold text-amber-400">Grupo {grupo.codigo_grupo}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CompactSelect
              className="min-w-[140px]"
              value={config.cotaId ?? ""}
              onChange={(e) => handlers.onCotaChange(e.target.value)}
            >
              <option value="">Cota…</option>
              {cotas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCurrency(Number(c.valor_credito))}
                </option>
              ))}
            </CompactSelect>
            <CompactNumberInput
              min={0}
              value={config.quantidadeCotas || ""}
              onChange={(e) => handlers.onQtyChange(e.target.value)}
            />
          </div>
        </div>
        {resultado.ativo ? (
          <div className="text-right text-xs">
            <p className="text-zinc-500">Líquido</p>
            <p className="text-base font-bold text-amber-400">
              {formatCurrency(resultado.creditoLiquido)}
            </p>
            <p className="mt-1 text-zinc-500">Pós-contempl.</p>
            <p className="font-semibold text-emerald-300">
              {formatCurrency(resultado.parcelaPosContemplacao)}
            </p>
          </div>
        ) : (
          <GrupoPrazoCell grupo={grupo} />
        )}
      </div>

      <div className="border-t border-zinc-800 px-4 py-2">
        <button
          type="button"
          className="flex w-full items-center justify-between py-2 text-sm font-medium text-zinc-200"
          onClick={() => setShowAdjust((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-amber-500/80" />
            Ajustar lance e seguro
          </span>
          <ChevronDown className={cn("h-4 w-4 transition", showAdjust && "rotate-180")} />
        </button>
        {showAdjust ? (
          <div className="pb-4 pt-1">
            <GrupoRowAdjustments
              grupo={grupo}
              cotas={cotas}
              modalidades={modalidades}
              config={config}
              onChange={onChange}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
