"use client";

import type { GrupoModalidadeLance } from "@/lib/types";
import { labelParcelaModalidade } from "@/lib/grupos/modalidades-admin";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { minimoRecursoValor } from "@/components/public/grupos/use-grupo-linha";

type Props = {
  grupoId: string;
  mods: GrupoModalidadeLance[];
  somaCotas: number;
  /** Saldo devedor da linha (base para % de lance). */
  saldoDevedorLance: number;
  selectedId: string | null;
  onSelect: (mod: GrupoModalidadeLance) => void;
  onClearEmbutido?: () => void;
  compact?: boolean;
};

export function LanceStrategySelector({
  grupoId,
  mods,
  somaCotas,
  saldoDevedorLance,
  selectedId,
  onSelect,
  onClearEmbutido,
  compact,
}: Props) {
  if (!mods.length) return null;

  return (
    <div className="space-y-2">
      {onClearEmbutido ? (
        <button
          type="button"
          onClick={onClearEmbutido}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left text-xs transition",
            !selectedId
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100 ring-1 ring-zinc-500/40"
              : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600",
          )}
        >
          Sem estratégia / sem lance embutido
        </button>
      ) : null}
      <div
        className={cn(
          "grid gap-2",
          compact && mods.length > 1 ? "sm:grid-cols-2" : compact ? "sm:grid-cols-1" : "grid-cols-1",
        )}
      >
        {mods.map((m) => {
          const sel = selectedId === m.id;
          const pctEmb = Number(m.percentual_lance_embutido);
          const pctRec = Number(m.percentual_recurso_proprio_minimo);
          const baseLance = saldoDevedorLance;
          const embR$ = pctEmb > 0 ? minimoRecursoValor(baseLance, pctEmb) : 0;
          const recMinR$ = minimoRecursoValor(baseLance, pctRec);
          const parcelaLbl = labelParcelaModalidade(m);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition",
                sel
                  ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30"
                  : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600",
              )}
            >
              <p className="text-xs font-semibold text-zinc-100">{m.nome}</p>
              {pctEmb > 0 ? (
                <p className="mt-0.5 text-[11px] text-amber-200/90">
                  Embutido {pctEmb}% · {formatCurrency(embR$)}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-zinc-500">Sem lance embutido</p>
              )}
              {parcelaLbl ? (
                <p className="text-[10px] text-emerald-400/90">{parcelaLbl}</p>
              ) : null}
              {pctRec > 0 ? (
                <p className="text-[10px] text-zinc-500">
                  + mín. {pctRec}% ({formatCurrency(recMinR$)})
                </p>
              ) : null}
              <input
                type="radio"
                name={`lance-${grupoId}`}
                className="sr-only"
                checked={sel}
                readOnly
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
