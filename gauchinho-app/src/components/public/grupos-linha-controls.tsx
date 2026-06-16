"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularLinhaSimulacaoGrupo,
  formatPrazoGrupo,
  listarModalidadesLanceAtivas,
  resolveModalidadeLanceAtiva,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { grupoUsaSeguroNaParcela } from "@/lib/grupos/calculos";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Select } from "@/components/ui/form-primitives";

type Props = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  config: ConfigLinhaSimulacaoGrupo;
  onChange: (next: ConfigLinhaSimulacaoGrupo) => void;
  compact?: boolean;
};

function sectionTitle(text: string) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
      {text}
    </p>
  );
}

function minimoRecursoValor(somaCotas: number, pct: number) {
  return Math.round(somaCotas * (pct / 100) * 100) / 100;
}

export function useGrupoLinhaCalculo(props: Props) {
  const cota = props.cotas.find((c) => c.id === props.config.cotaId) ?? null;
  const resultado = calcularLinhaSimulacaoGrupo({
    grupo: props.grupo,
    cota,
    config: props.config,
    modalidades: props.modalidades,
  });
  const mods = listarModalidadesLanceAtivas(props.grupo, props.modalidades);
  const modAtiva = resolveModalidadeLanceAtiva(props.config, mods);
  return { cota, resultado, mods, modAtiva };
}

export function GrupoSimulacaoLinhaControls({
  grupo,
  cotas,
  modalidades,
  config,
  onChange,
  compact,
}: Props) {
  const { resultado, mods, modAtiva } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
    onChange,
  });

  const temReduzida = grupo.tem_parcela_reduzida;
  const temSeguro = grupoUsaSeguroNaParcela(grupo);
  const exibeLance = grupo.permite_lance_embutido && mods.length > 0;
  const pctMinRecurso = modAtiva ? Number(modAtiva.percentual_recurso_proprio_minimo) : 0;
  const minRecursoR$ = minimoRecursoValor(resultado.somaCotas, pctMinRecurso);

  function patch(partial: Partial<ConfigLinhaSimulacaoGrupo>) {
    onChange({ ...config, ...partial });
  }

  function onCotaChange(cotaId: string) {
    const next: Partial<ConfigLinhaSimulacaoGrupo> = {
      cotaId,
      quantidadeCotas: config.quantidadeCotas > 0 ? config.quantidadeCotas : 1,
    };
    if (mods.length === 1 && !config.modalidadeLanceId) {
      next.modalidadeLanceId = mods[0]!.id;
      next.usaLanceEmbutido = true;
    }
    patch(next);
  }

  function onQtyChange(raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    patch({ quantidadeCotas: n });
  }

  function selectModalidadeLance(mod: GrupoModalidadeLance) {
    const minPct = Number(mod.percentual_recurso_proprio_minimo) || 0;
    const next: ConfigLinhaSimulacaoGrupo = {
      ...config,
      modalidadeLanceId: mod.id,
      usaLanceEmbutido: true,
    };
    if (minPct > 0) {
      next.usaRecursoProprio = true;
      next.recursoProprioModo = "percentual";
      next.recursoProprioInput = Math.max(config.recursoProprioInput, minPct);
    }
    onChange(next);
  }

  function onRecursoInputChange(raw: string) {
    let v = Number(raw) || 0;
    if (config.recursoProprioModo === "percentual" && pctMinRecurso > 0) {
      v = Math.max(v, pctMinRecurso);
    }
    patch({ recursoProprioInput: v });
  }

  const modSelecionadaId =
    config.usaLanceEmbutido && config.modalidadeLanceId
      ? config.modalidadeLanceId
      : mods.length === 1
        ? mods[0]!.id
        : null;

  return (
    <div className={cn("space-y-4", compact && "text-sm")}>
      {/* Bloco 1 — Cota */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
        {sectionTitle("Cota")}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
              Valor do crédito
            </label>
            <Select
              className="h-9 w-full border-zinc-700 bg-zinc-950 text-zinc-100"
              value={config.cotaId ?? ""}
              onChange={(e) => onCotaChange(e.target.value)}
            >
              <option value="">Selecione…</option>
              {cotas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCurrency(Number(c.valor_credito))}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
              Quantidade
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              className="h-9 border-zinc-700 bg-zinc-950"
              value={config.quantidadeCotas || ""}
              onChange={(e) => onQtyChange(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <p className="text-[10px] uppercase text-zinc-500">Soma das cotas</p>
            <p className="text-lg font-semibold text-amber-300">
              {formatCurrency(resultado.somaCotas)}
            </p>
          </div>
        </div>
      </div>

      {resultado.ativo ? (
        <>
          {/* Bloco 2 — Parcela */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
            {sectionTitle("Parcela")}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-[10px] uppercase text-zinc-500">Tipo</label>
                {temReduzida ? (
                  <Select
                    className="h-9 border-zinc-700 bg-zinc-950"
                    value={config.modalidadeParcela}
                    onChange={(e) =>
                      patch({
                        modalidadeParcela: e.target.value as "reduzida" | "integral",
                      })
                    }
                  >
                    <option value="reduzida">Reduzida</option>
                    <option value="integral">Integral</option>
                  </Select>
                ) : (
                  <span className="text-sm text-zinc-300">Integral</span>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">1ª parcela (un.)</p>
                <p className="text-xl font-bold text-white">{formatCurrency(resultado.parcelaBase)}</p>
                {resultado.quantidadeCotas > 1 ? (
                  <p className="text-xs text-zinc-500">
                    Total linha: {formatCurrency(resultado.primeiraParcela)}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase text-zinc-500">Seguro</label>
                {temSeguro ? (
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className={cn(
                        "rounded-full px-3 py-1.5 font-medium",
                        config.usaSeguro
                          ? "bg-amber-500 text-zinc-950"
                          : "border border-zinc-600 text-zinc-300",
                      )}
                      onClick={() => patch({ usaSeguro: true })}
                    >
                      Com
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-full px-3 py-1.5 font-medium",
                        !config.usaSeguro
                          ? "bg-zinc-600 text-zinc-100"
                          : "border border-zinc-600 text-zinc-400",
                      )}
                      onClick={() => patch({ usaSeguro: false })}
                    >
                      Sem
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Não configurado</span>
                )}
                {config.usaSeguro && resultado.seguroMensal > 0 ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    + {formatCurrency(resultado.seguroMensal)}/mês na linha
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Bloco 3 — Estratégia de lance */}
          {exibeLance ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
              {sectionTitle("Estratégia de lance")}
              <div className="space-y-2">
                {mods.map((m) => {
                  const sel = modSelecionadaId === m.id && config.usaLanceEmbutido;
                  const pctEmb = Number(m.percentual_lance_embutido);
                  const pctRec = Number(m.percentual_recurso_proprio_minimo);
                  const embR$ = Math.round(resultado.somaCotas * (pctEmb / 100) * 100) / 100;
                  const recMinR$ = minimoRecursoValor(resultado.somaCotas, pctRec);
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 transition",
                        sel
                          ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30"
                          : "border-zinc-700 hover:border-zinc-600",
                      )}
                    >
                      <input
                        type="radio"
                        name={`lance-${grupo.id}`}
                        className="mt-1"
                        checked={sel}
                        onChange={() => selectModalidadeLance(m)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-100">{m.nome}</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          Lance embutido: {pctEmb}% ={" "}
                          <span className="font-medium text-amber-200">{formatCurrency(embR$)}</span>
                        </p>
                        {pctRec > 0 ? (
                          <p className="text-xs text-zinc-500">
                            Recurso próprio mínimo: {pctRec}% = {formatCurrency(recMinR$)}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-600">Sem recurso próprio mínimo</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {mods.length > 1 && !config.usaLanceEmbutido ? (
                <p className="mt-2 text-xs text-amber-400">Selecione uma modalidade de lance acima.</p>
              ) : null}

              <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
                <div className="rounded-lg bg-zinc-900/80 p-3">
                  <p className="text-[10px] uppercase text-zinc-500">Lance embutido (aplicado)</p>
                  {config.usaLanceEmbutido && resultado.lanceEmbutido > 0 ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        {resultado.percentualLanceEmbutido}% ={" "}
                        {formatCurrency(resultado.lanceEmbutido)}
                      </p>
                      <p className="text-[10px] text-zinc-500">Sobre a soma das cotas</p>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">—</p>
                  )}
                </div>

                <div className="rounded-lg bg-zinc-900/80 p-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={config.usaRecursoProprio}
                      onChange={(e) => patch({ usaRecursoProprio: e.target.checked })}
                    />
                    Recurso próprio
                  </label>
                  {config.usaRecursoProprio ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1">
                        <Select
                          className="h-8 w-14 border-zinc-700 bg-zinc-950 text-xs"
                          value={config.recursoProprioModo}
                          onChange={(e) =>
                            patch({
                              recursoProprioModo: e.target.value as "percentual" | "valor",
                            })
                          }
                        >
                          <option value="percentual">%</option>
                          <option value="valor">R$</option>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min={
                            config.recursoProprioModo === "percentual" && pctMinRecurso > 0
                              ? pctMinRecurso
                              : 0
                          }
                          className="h-8 flex-1 border-zinc-700 bg-zinc-950 text-sm"
                          value={config.recursoProprioInput}
                          onChange={(e) => onRecursoInputChange(e.target.value)}
                        />
                      </div>
                      <p className="text-sm font-medium text-white">
                        {config.recursoProprioModo === "percentual"
                          ? `${config.recursoProprioInput}% = ${formatCurrency(resultado.recursoProprio)}`
                          : formatCurrency(resultado.recursoProprio)}
                      </p>
                    </div>
                  ) : null}
                  {pctMinRecurso > 0 && config.usaLanceEmbutido ? (
                    <p className="mt-2 text-[10px] text-amber-400/90">
                      Esta modalidade exige recurso próprio mínimo de {pctMinRecurso}%.
                    </p>
                  ) : null}
                  {resultado.avisoRecursoProprio ? (
                    <p className="mt-1 text-[10px] text-red-400">{resultado.avisoRecursoProprio}</p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 sm:col-span-2">
                  <p className="text-[10px] uppercase text-amber-400">Lance total</p>
                  <p className="text-2xl font-bold text-amber-300">
                    {formatCurrency(resultado.lanceTotal)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Embutido: {formatCurrency(resultado.lanceEmbutido)} · Próprio:{" "}
                    {formatCurrency(resultado.recursoProprio)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Bloco 4 — Resultado */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
            {sectionTitle("Resultado da linha")}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Crédito líquido</p>
                <p className="text-lg font-bold text-amber-400">
                  {formatCurrency(resultado.creditoLiquido)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Saldo devedor final</p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(resultado.saldoDevedorFinal)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Pós-contemplação</p>
                <p className="text-lg font-semibold text-emerald-300">
                  {formatCurrency(resultado.parcelaPosContemplacao)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Prazo T / R / Real.</p>
                <p className="font-mono text-sm text-zinc-300">{formatPrazoGrupo(grupo)}</p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => patch({ quantidadeCotas: 0, cotaId: config.cotaId })}
          >
            Limpar seleção
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function GrupoPrazoCell({ grupo }: { grupo: GrupoConsorcio }) {
  return (
    <span
      className="whitespace-nowrap font-mono text-xs text-zinc-300"
      title="Total / restantes / realizadas"
    >
      {formatPrazoGrupo(grupo)}
    </span>
  );
}

export function GrupoLinhaDesktopRow({
  grupo,
  cotas,
  modalidades,
  config,
  onChange,
}: Props) {
  const { resultado } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
    onChange,
  });
  const ativo = resultado.ativo;

  return (
    <tr
      className={cn(
        "border-b border-zinc-800/80 align-top transition hover:bg-zinc-800/30",
        ativo && "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20",
      )}
    >
      <td className="px-3 py-4 align-top">
        <div className="font-semibold text-amber-400">{grupo.codigo_grupo}</div>
        <p className="mt-1 text-xs text-zinc-500">{grupo.modalidade}</p>
        {ativo ? (
          <span className="mt-2 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
            Selecionado
          </span>
        ) : null}
        {ativo ? (
          <div className="mt-3 space-y-1 text-xs">
            <p className="text-zinc-500">
              Líquido:{" "}
              <span className="font-medium text-amber-300">
                {formatCurrency(resultado.creditoLiquido)}
              </span>
            </p>
            <p className="text-zinc-500">
              Pós-contempl.:{" "}
              <span className="text-emerald-300">
                {formatCurrency(resultado.parcelaPosContemplacao)}
              </span>
            </p>
          </div>
        ) : null}
      </td>
      <td className="min-w-[420px] px-3 py-4">
        <GrupoSimulacaoLinhaControls
          grupo={grupo}
          cotas={cotas}
          modalidades={modalidades}
          config={config}
          onChange={onChange}
        />
      </td>
      <td className="px-3 py-4 align-top">
        <GrupoPrazoCell grupo={grupo} />
      </td>
      <td className="px-3 py-4 align-top font-medium">{formatCurrency(resultado.saldoDevedorFinal)}</td>
      <td className="px-3 py-4 align-top font-medium text-emerald-300">
        {formatCurrency(resultado.parcelaPosContemplacao)}
      </td>
      <td className="px-3 py-4 align-top">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">{grupo.status}</span>
      </td>
    </tr>
  );
}
