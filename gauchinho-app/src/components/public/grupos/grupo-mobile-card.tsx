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
import { GrupoEmbutidoSelect, GrupoRecursoProprioCell } from "@/components/public/grupos/grupo-lance-cells";
import { grupoEmFormacao } from "@/lib/grupos/em-formacao";
import { descricaoReajusteAnual } from "@/lib/grupos/reajuste-anual";
import { grupoUsaSeguroNaParcela } from "@/lib/grupos/calculos";

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
  const tipoTranscorridoAtivo = config.tipoTranscorrido || "PRORROGADA";
  const temTranscorrido = cotas.some(
    (c) => c.tipo_transcorrido === "PRORROGADA" || c.tipo_transcorrido === "DILUIDA",
  );
  const cotasExibidas = temTranscorrido
    ? cotas.filter(
        (c) =>
          !c.tipo_transcorrido ||
          
          c.tipo_transcorrido === tipoTranscorridoAtivo,
      )
    : cotas;
  const emFormacao = grupoEmFormacao(grupo.data_primeira_assembleia);
  const temSeguro = grupoUsaSeguroNaParcela(grupo);

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
          {descricaoReajusteAnual(grupo) ? <span className="mt-1 block text-[10px] text-zinc-400">{descricaoReajusteAnual(grupo)}</span> : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {emFormacao ? <span className="grupo-em-formacao inline-flex rounded-full bg-[var(--tenant-secondary,#0c2340)] px-2 py-0.5 text-[10px] font-semibold text-white">Em Formação</span> : null}
            {grupo.vagas_disponiveis != null ? (
              <span
                style={grupo.vagas_disponiveis > 0 ? { color: "#ffffff", backgroundColor: "#0c2340" } : undefined}
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  grupo.vagas_disponiveis > 0
                    ? "grupo-tag-vagas border border-[#1e3a5f] bg-[#0c2340] !text-white text-white"
                    : "border border-red-500/30 bg-red-500/15 text-red-300",
                )}
              >
                {grupo.vagas_disponiveis > 0 ? `${grupo.vagas_disponiveis} vagas` : "0 vagas"}
              </span>
            ) : null}
            {grupo.aguardando_novas_vagas ? (
              <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                Aguardando novas vagas
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <CompactSelect
              className="min-w-[140px]"
              value={config.cotaId ?? ""}
              onChange={(e) => handlers.onCotaChange(e.target.value)}
            >
              <option value="">Cota…</option>
              {cotasExibidas.map((c) => (
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
            {temTranscorrido && (
              <button
                type="button"
                onClick={() => {
                  const nextMod = tipoTranscorridoAtivo === "PRORROGADA" ? "DILUIDA" : "PRORROGADA";
                  const curCota = cotas.find((c) => c.id === config.cotaId);
                  let nextCotaId = config.cotaId;
                  if (curCota) {
                    const matching = cotas.find(
                      (c) =>
                        c.id !== curCota.id &&
                        Number(c.valor_credito) === Number(curCota.valor_credito) &&
                        c.tipo_transcorrido === nextMod,
                    );
                    if (matching) nextCotaId = matching.id;
                  }
                  onChange({
                    ...config,
                    tipoTranscorrido: nextMod,
                    cotaId: nextCotaId,
                  });
                }}
                className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-zinc-700"
              >
                {tipoTranscorridoAtivo === "PRORROGADA" ? "Prorrogada" : "Diluída"} ⇄
              </button>
            )}
          </div>
          {resultado.ativo && mods.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] uppercase text-zinc-500">Embutido</p>
                <GrupoEmbutidoSelect config={config} mods={mods} handlers={handlers} className="max-w-full" />
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase text-zinc-500">Próprio</p>
                <GrupoRecursoProprioCell
                  config={config}
                  resultado={resultado}
                  handlers={handlers}
                  pctMinRecurso={pctMinRecurso}
                />
              </div>
            </div>
          ) : null}
        </div>
        {resultado.ativo ? (
          <div className="text-right text-xs">
            <p className="text-zinc-500">Líquido</p>
            <p className="text-base font-bold text-amber-400">
              {formatCurrency(resultado.creditoLiquido)}
            </p>
            <p className="mt-1 text-zinc-500">Pós-contempl.</p>
            <p className="font-semibold text-amber-300">
              {formatCurrency(resultado.parcelaPosContemplacao)}
            </p>
          </div>
        ) : (
          <GrupoPrazoCell grupo={grupo} />
        )}
      </div>

      {resultado.ativo ? (
        <div className="space-y-3 border-t border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-400">1ª parcela</span>
            <strong className="text-amber-300">{formatCurrency(resultado.primeiraParcela)}</strong>
          </div>
          {temSeguro ? (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-zinc-400">Seguro na 1ª parcela</legend>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((usaSeguro) => (
                  <button
                    key={String(usaSeguro)}
                    type="button"
                    aria-pressed={config.usaSeguro === usaSeguro}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold",
                      config.usaSeguro === usaSeguro
                        ? "border-amber-500 bg-amber-500 text-zinc-950"
                        : "border-zinc-600 text-zinc-300",
                    )}
                    onClick={() => handlers.patch({ usaSeguro })}
                  >
                    {usaSeguro ? "Com seguro" : "Sem seguro"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Após a contemplação, o seguro é obrigatório e está incluído na parcela pós-contemplação.
              </p>
            </fieldset>
          ) : null}
        </div>
      ) : null}

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
