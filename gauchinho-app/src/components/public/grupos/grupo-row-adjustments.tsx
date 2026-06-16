"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import { grupoUsaSeguroNaParcela } from "@/lib/grupos/calculos";
import { formatPrazoGrupo, type ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { parcelaTipoFromModalidade } from "@/lib/grupos/modalidades-admin";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Select } from "@/components/ui/form-primitives";
import { LanceStrategySelector } from "@/components/public/grupos/lance-strategy-selector";
import {
  createGrupoLinhaHandlers,
  useGrupoLinhaCalculo,
} from "@/components/public/grupos/use-grupo-linha";
import { MoneyValue, CompactSelect } from "@/components/public/grupos/grupos-primitives";
import {
  formatCustoEfetivoAnual,
  formatCustoEfetivoMensal,
} from "@/components/public/grupos/custo-efetivo-grupo";

type Props = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  config: ConfigLinhaSimulacaoGrupo;
  onChange: (next: ConfigLinhaSimulacaoGrupo) => void;
};

export function GrupoRowAdjustments({ grupo, cotas, modalidades, config, onChange }: Props) {
  const { resultado, mods, modAtiva } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
  });
  const temSeguro = grupoUsaSeguroNaParcela(grupo);
  const temReduzida = grupo.tem_parcela_reduzida;
  const exibeEstrategias = mods.length > 0;
  const pctMinRecurso = modAtiva ? Number(modAtiva.percentual_recurso_proprio_minimo) : 0;
  const handlers = createGrupoLinhaHandlers(config, onChange, mods, pctMinRecurso);

  const modSelecionadaId = config.modalidadeLanceId;
  const parcelaFixaNaMod = modAtiva ? parcelaTipoFromModalidade(modAtiva) : null;

  if (!resultado.ativo) {
    return (
      <p className="text-xs text-zinc-500">
        Selecione cota e quantidade (mín. 1) para ajustar lance e seguro.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
          Estratégias (lance e parcela)
        </p>
        {exibeEstrategias ? (
          <>
            <LanceStrategySelector
              grupoId={grupo.id}
              mods={mods}
              somaCotas={resultado.somaCotas}
              saldoDevedorLance={resultado.saldoDevedorInicial}
              selectedId={modSelecionadaId}
              onSelect={handlers.selectModalidadeLance}
              onClearEmbutido={handlers.clearLanceEmbutido}
              compact
            />
            {mods.length > 1 && !modSelecionadaId ? (
              <p className="mt-2 text-[10px] text-amber-400">Selecione uma estratégia.</p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            Cadastre estratégias no admin (lance embutido / parcela reduzida).
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
          Parcela, recurso e seguro
        </p>
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div>
            <p className="mb-1 text-[10px] uppercase text-zinc-500">Tipo de parcela</p>
            {parcelaFixaNaMod ? (
              <span className="text-xs text-emerald-300/90">
                {parcelaFixaNaMod === "reduzida" ? "Reduzida (estratégia)" : "Integral (estratégia)"}
              </span>
            ) : temReduzida ? (
              <CompactSelect
                className="max-w-[140px]"
                value={config.modalidadeParcela}
                onChange={(e) =>
                  handlers.patch({
                    modalidadeParcela: e.target.value as "reduzida" | "integral",
                  })
                }
              >
                <option value="reduzida">Reduzida</option>
                <option value="integral">Integral</option>
              </CompactSelect>
            ) : (
              <span className="text-xs text-zinc-400">Integral (única opção)</span>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">1ª parcela (un.)</p>
            <MoneyValue value={resultado.parcelaBase} compact className="text-white" />
            {resultado.quantidadeCotas > 1 ? (
              <p className="text-[10px] text-zinc-500">
                Total linha: {formatCurrency(resultado.primeiraParcela)}
              </p>
            ) : null}
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <label className="flex items-center gap-2 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={config.usaRecursoProprio}
                onChange={(e) => handlers.patch({ usaRecursoProprio: e.target.checked })}
              />
              Recurso próprio
            </label>
          {config.usaRecursoProprio ? (
            <div className="flex gap-1">
              <Select
                className="h-8 w-14 border-zinc-700 bg-zinc-950 text-xs text-zinc-100"
                value={config.recursoProprioModo}
                onChange={(e) =>
                  handlers.patch({
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
                  config.recursoProprioModo === "percentual" && pctMinRecurso > 0 ? pctMinRecurso : 0
                }
                className="h-8 flex-1 border-zinc-700 bg-zinc-950 text-xs text-zinc-100"
                value={config.recursoProprioInput}
                onChange={(e) => handlers.onRecursoInputChange(e.target.value)}
              />
            </div>
          ) : null}
          {config.usaRecursoProprio ? (
            <p className="text-xs font-medium text-white">
              {config.recursoProprioModo === "percentual"
                ? `${config.recursoProprioInput}% = ${formatCurrency(resultado.recursoProprio)}`
                : formatCurrency(resultado.recursoProprio)}
            </p>
          ) : null}
          {pctMinRecurso > 0 && config.usaLanceEmbutido ? (
            <p className="text-[10px] text-amber-400/90" title="Mínimo exigido pela modalidade">
              Mínimo {pctMinRecurso}% de recurso próprio.
            </p>
          ) : null}
          {resultado.avisoRecursoProprio ? (
            <p className="text-[10px] text-red-400">{resultado.avisoRecursoProprio}</p>
          ) : null}
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <p className="mb-1 text-[10px] uppercase text-zinc-500">Seguro na parcela</p>
            {temSeguro ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium",
                    config.usaSeguro
                      ? "bg-amber-500 text-zinc-950"
                      : "border border-zinc-600 text-zinc-300",
                  )}
                  onClick={() => handlers.patch({ usaSeguro: true })}
                >
                  Com
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium",
                    !config.usaSeguro
                      ? "bg-zinc-600 text-zinc-100"
                      : "border border-zinc-600 text-zinc-400",
                  )}
                  onClick={() => handlers.patch({ usaSeguro: false })}
                >
                  Sem
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-500">—</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
          Resultado da linha
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Embutido</p>
            <MoneyValue
              value={resultado.lanceEmbutido}
              compact
              className="text-amber-200/90"
            />
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Próprio</p>
            <MoneyValue value={resultado.recursoProprio} compact />
          </div>
          <div className="col-span-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
            <p className="text-[10px] text-amber-400">Lance total</p>
            <MoneyValue value={resultado.lanceTotal} className="text-amber-300" />
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Crédito líquido</p>
            <MoneyValue value={resultado.creditoLiquido} compact className="text-amber-400" />
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Pós-contempl.</p>
            <MoneyValue
              value={resultado.parcelaPosContemplacao}
              compact
              className="text-emerald-300"
            />
          </div>
          <div className="col-span-2 rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Custo efetivo (adm.)</p>
            <p className="text-xs font-medium text-zinc-200">
              Mensal: {formatCustoEfetivoMensal(grupo)}
            </p>
            <p className="text-xs text-zinc-400">Anual: {formatCustoEfetivoAnual(grupo)}</p>
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Saldo devedor total</p>
            <MoneyValue value={resultado.saldoDevedorInicial} compact className="text-zinc-200" />
            <p className="text-[9px] text-zinc-600">Sem lances</p>
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Saldo final</p>
            <MoneyValue value={resultado.saldoDevedorFinal} compact />
          </div>
          <div className="col-span-2 rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Prazo</p>
            <p className="font-mono text-xs text-zinc-400">{formatPrazoGrupo(grupo)}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          onClick={handlers.clearSelection}
        >
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}
