"use client";

import type { GrupoModalidadeLance } from "@/lib/types";
import type { ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { cn } from "@/lib/utils/cn";
import { CompactNumberInput, CompactSelect, MoneyValue } from "@/components/public/grupos/grupos-primitives";

type EmbutidoHandlers = {
  clearLanceEmbutido: () => void;
  selectModalidadeLance: (mod: GrupoModalidadeLance) => void;
};

/** Valor do select: sempre permite "Sem embutido" + modalidades cadastradas. */
export function embutidoSelectValue(config: ConfigLinhaSimulacaoGrupo): string {
  if (!config.usaLanceEmbutido) return "__sem__";
  if (config.modalidadeLanceId) return config.modalidadeLanceId;
  return "__sem__";
}

export function GrupoEmbutidoSelect({
  config,
  mods,
  handlers,
  className,
}: {
  config: ConfigLinhaSimulacaoGrupo;
  mods: GrupoModalidadeLance[];
  handlers: EmbutidoHandlers;
  className?: string;
}) {
  if (mods.length === 0) return null;

  return (
    <CompactSelect
      className={cn("h-7 max-w-[112px] text-[10px]", className)}
      value={embutidoSelectValue(config)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__sem__") handlers.clearLanceEmbutido();
        else {
          const mod = mods.find((m) => m.id === v);
          if (mod) handlers.selectModalidadeLance(mod);
        }
      }}
    >
      <option value="__sem__">Sem embutido</option>
      {mods.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nome}
        </option>
      ))}
    </CompactSelect>
  );
}

type RecursoHandlers = {
  patch: (partial: Partial<ConfigLinhaSimulacaoGrupo>) => void;
  onRecursoInputChange: (raw: string) => void;
};

export function GrupoRecursoProprioCell({
  config,
  resultado,
  handlers,
  pctMinRecurso,
}: {
  config: ConfigLinhaSimulacaoGrupo;
  resultado: { recursoProprio: number; saldoDevedorInicial: number };
  handlers: RecursoHandlers;
  pctMinRecurso: number;
}) {
  const modo = config.recursoProprioModo;
  const inputVal = config.recursoProprioInput > 0 ? config.recursoProprioInput : "";

  return (
    <div className="flex min-w-[92px] flex-col gap-1">
      <div className="flex gap-0.5">
        <button
          type="button"
          title="Percentual sobre saldo devedor"
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium",
            modo === "percentual"
              ? "bg-amber-500/90 text-zinc-950"
              : "border border-zinc-700 text-zinc-500",
          )}
          onClick={() =>
            handlers.patch({
              recursoProprioModo: "percentual",
              usaRecursoProprio: config.recursoProprioInput > 0,
            })
          }
        >
          %
        </button>
        <button
          type="button"
          title="Valor em reais"
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium",
            modo === "valor"
              ? "bg-amber-500/90 text-zinc-950"
              : "border border-zinc-700 text-zinc-500",
          )}
          onClick={() =>
            handlers.patch({
              recursoProprioModo: "valor",
              usaRecursoProprio: config.recursoProprioInput > 0,
            })
          }
        >
          R$
        </button>
      </div>
      <CompactNumberInput
        className="w-full min-w-[72px]"
        min={0}
        step={modo === "percentual" ? 0.01 : 1}
        placeholder={modo === "percentual" ? "%" : "R$"}
        value={inputVal}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw.trim()) {
            handlers.patch({ usaRecursoProprio: false, recursoProprioInput: 0 });
            return;
          }
          handlers.patch({ usaRecursoProprio: true });
          handlers.onRecursoInputChange(raw);
        }}
      />
      {config.usaRecursoProprio && resultado.recursoProprio > 0 ? (
        <MoneyValue value={resultado.recursoProprio} compact className="text-zinc-200" />
      ) : pctMinRecurso > 0 && config.usaLanceEmbutido ? (
        <span className="text-[9px] text-amber-500/80">mín. {pctMinRecurso}%</span>
      ) : null}
    </div>
  );
}
