"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import { grupoUsaSeguroNaParcela } from "@/lib/grupos/calculos";
import { formatPrazoGrupo, labelModalidadeParcelaLinha, type ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { normalizarPercentualGrupo } from "@/lib/grupos/percentual";
import { parcelaTipoFromModalidade } from "@/lib/grupos/modalidades-admin";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Select } from "@/components/ui/form-primitives";
import { LanceStrategySelector } from "@/components/public/grupos/lance-strategy-selector";
import {
  createGrupoLinhaHandlers,
  useGrupoLinhaCalculo,
} from "@/components/public/grupos/use-grupo-linha";
import { MoneyValue, CompactSelect, CompactMoneyInput } from "@/components/public/grupos/grupos-primitives";
import {
  formatCustoEfetivoAnual,
  formatCustoEfetivoMensal,
} from "@/components/public/grupos/custo-efetivo-grupo";
import { GrupoCicloDetalhes } from "@/components/public/grupos/grupo-ciclo-detalhes";

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
  const permitePersonalizada = !!grupo.permite_parcela_reduzida_personalizada;
  const exibeTipoParcela = temReduzida || permitePersonalizada;
  const exibeEstrategias = mods.length > 0;
  const pctMinRecurso = modAtiva ? Number(modAtiva.percentual_recurso_proprio_minimo) : 0;
  const handlers = createGrupoLinhaHandlers(config, onChange, mods, pctMinRecurso);

  const modSelecionadaId = config.modalidadeLanceId;
  const parcelaFixaNaMod = modAtiva ? parcelaTipoFromModalidade(modAtiva) : null;

  if (!resultado.ativo) {
    return (
      <div className="space-y-3">
        <GrupoCicloDetalhes grupo={grupo} />
        <p className="text-xs text-zinc-500">
          Selecione cota e quantidade (mín. 1) para ajustar lance e seguro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GrupoCicloDetalhes grupo={grupo} />
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
            {exibeTipoParcela ? (
              <div className="space-y-2">
                {parcelaFixaNaMod ? (
                  <p className="text-[10px] text-zinc-500">
                    Estratégia sugere parcela{" "}
                    {parcelaFixaNaMod === "reduzida" ? "reduzida" : "integral"} — você pode alterar
                    abaixo.
                  </p>
                ) : null}
                <CompactSelect
                  className="max-w-[160px]"
                  value={config.modalidadeParcela}
                  onChange={(e) => {
                    const v = e.target.value as "reduzida" | "integral" | "personalizada";
                    const next: Partial<ConfigLinhaSimulacaoGrupo> = { modalidadeParcela: v };
                    if (v === "personalizada" && config.percentualParcelaPersonalizada == null) {
                      next.percentualParcelaPersonalizada =
                        grupo.percentual_parcela_reduzida_personalizada != null
                          ? Number(grupo.percentual_parcela_reduzida_personalizada)
                          : 40;
                    }
                    handlers.patch(next);
                  }}
                >
                  <option value="integral">Integral</option>
                  {temReduzida ? <option value="reduzida">Reduzida</option> : null}
                  {permitePersonalizada ? (
                    <option value="personalizada">Personalizada</option>
                  ) : null}
                </CompactSelect>
                {config.modalidadeParcela === "personalizada" && permitePersonalizada ? (
                  <div>
                    <p className="mb-1 text-[10px] uppercase text-zinc-500">% da integral</p>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      step="0.01"
                      className="h-8 max-w-[100px] border-zinc-700 bg-zinc-900 text-sm text-zinc-100"
                      value={config.percentualParcelaPersonalizada ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(",", ".");
                        const n = raw === "" ? null : Number(raw);
                        handlers.patch({
                          percentualParcelaPersonalizada:
                            n != null && Number.isFinite(n) ? n : null,
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-zinc-400">Integral (única opção)</span>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">1ª parcela (un.)</p>
            <MoneyValue value={resultado.parcelaBase} compact className="text-white" />
            {exibeTipoParcela ? (
              <div className="mt-2 space-y-0.5 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
                <p>
                  Integral:{" "}
                  <span className="text-zinc-300">
                    {formatCurrency(resultado.parcelaIntegral)}
                  </span>
                </p>
                {temReduzida && resultado.parcelaReduzida != null ? (
                  <p>
                    Reduzida ({normalizarPercentualGrupo(grupo.percentual_parcela_reduzida) || 60}
                    %):{" "}
                    <span className="text-zinc-300">
                      {formatCurrency(resultado.parcelaReduzida)}
                    </span>
                  </p>
                ) : null}
                {permitePersonalizada && resultado.parcelaPersonalizada != null ? (
                  <p>
                    Personalizada (
                    {config.percentualParcelaPersonalizada ??
                      grupo.percentual_parcela_reduzida_personalizada ??
                      "—"}
                    %):{" "}
                    <span className="text-zinc-300">
                      {formatCurrency(resultado.parcelaPersonalizada)}
                    </span>
                  </p>
                ) : null}
                <p className="text-zinc-600">
                  Selecionado: {labelModalidadeParcelaLinha(config, grupo)}
                </p>
              </div>
            ) : null}
            {resultado.quantidadeCotas > 1 ? (
              <p className="text-[10px] text-zinc-500">
                Total linha: {formatCurrency(resultado.primeiraParcela)}
              </p>
            ) : null}
          </div>

          {pctMinRecurso > 0 && config.usaLanceEmbutido ? (
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
              {config.recursoProprioModo === "valor" ? (
                <CompactMoneyInput
                  className="h-8 min-w-0 flex-1"
                  value={config.recursoProprioInput}
                  onValueChange={(v) => {
                    if (v <= 0) {
                      handlers.patch({ usaRecursoProprio: false, recursoProprioInput: 0 });
                      return;
                    }
                    handlers.patch({ usaRecursoProprio: true, recursoProprioInput: v });
                  }}
                />
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  min={pctMinRecurso > 0 ? pctMinRecurso : 0}
                  className="h-8 flex-1 border-zinc-700 bg-zinc-950 text-xs text-zinc-100"
                  value={config.recursoProprioInput || ""}
                  onChange={(e) => handlers.onRecursoInputChange(e.target.value)}
                />
              )}
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
          ) : null}

          <div className="border-t border-zinc-800 pt-3">
            <p className="mb-1 text-[10px] uppercase text-zinc-500">Seguro na 1ª parcela</p>
            {temSeguro ? (
              <>
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
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                  Após a contemplação o seguro é obrigatório e entra na parcela pós.
                </p>
              </>
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
            {resultado.percentualLanceEmbutido > 0 ? (
              <p className="text-[9px] text-zinc-600">
                {resultado.percentualLanceEmbutido}% sobre saldo devedor
              </p>
            ) : null}
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
            <p className="text-[9px] text-zinc-600">Crédito contratado − embutido</p>
            <MoneyValue value={resultado.creditoLiquido} compact className="text-amber-400" />
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Pós-contempl.</p>
            <p className="text-[9px] text-zinc-600">Inclui seguro obrigatório</p>
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
            <p className="text-[10px] text-zinc-500">Saldo devedor</p>
            <MoneyValue value={resultado.saldoDevedorInicial} compact className="text-zinc-200" />
            <p className="text-[9px] text-zinc-600">Base dos lances %</p>
          </div>
          <div className="rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Saldo pós-lance</p>
            <MoneyValue value={resultado.saldoPosLance} compact />
          </div>
          <div className="col-span-2 rounded-md bg-zinc-950/60 p-2">
            <p className="text-[10px] text-zinc-500">Prazo</p>
            <p className="font-mono text-xs text-zinc-400">{formatPrazoGrupo(grupo)}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outlineGold"
          className="mt-3 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          onClick={handlers.clearSelection}
        >
          Limpar seleção
        </Button>
      </div>
    </div>
    </div>
  );
}
