"use client";

import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularLinhaSimulacaoGrupo,
  formatPrazoGrupo,
  listarModalidadesLanceAtivas,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
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

export function useGrupoLinhaCalculo(props: Props) {
  const cota = props.cotas.find((c) => c.id === props.config.cotaId) ?? null;
  const resultado = calcularLinhaSimulacaoGrupo({
    grupo: props.grupo,
    cota,
    config: props.config,
    modalidades: props.modalidades,
  });
  const mods = listarModalidadesLanceAtivas(props.grupo, props.modalidades);
  return { cota, resultado, mods };
}

export function GrupoSimulacaoLinhaControls({
  grupo,
  cotas,
  modalidades,
  config,
  onChange,
  compact,
}: Props) {
  const { resultado, mods } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
    onChange,
  });

  const temReduzida = grupo.tem_parcela_reduzida;
  const temSeguro = grupo.seguro_habilitado;
  const podeEmbutido = grupo.permite_lance_embutido && mods.length > 0;

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

  return (
    <div className={cn("space-y-3", compact && "text-sm")}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
            Cota / valor do crédito
          </label>
          <Select
            className="h-9 w-full min-w-[140px] border-zinc-700 bg-zinc-950 text-zinc-100"
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
            Qtd. cotas
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
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
            Soma das cotas
          </label>
          <p className="flex h-9 items-center font-medium text-amber-300">
            {formatCurrency(resultado.somaCotas)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
            Parcela
          </label>
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
            <span className="text-xs text-zinc-400">Integral</span>
          )}
          <p className="mt-1 text-sm font-semibold text-white">
            {formatCurrency(resultado.parcelaBase)}
            {config.usaSeguro && temSeguro ? (
              <span className="ml-1 text-xs font-normal text-zinc-500">+ seguro</span>
            ) : null}
          </p>
        </div>

        {podeEmbutido ? (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={config.usaLanceEmbutido}
                onChange={(e) => patch({ usaLanceEmbutido: e.target.checked })}
              />
              Lance embutido
            </label>
            {config.usaLanceEmbutido && mods.length > 1 ? (
              <Select
                className="h-8 max-w-xs border-zinc-700 bg-zinc-950 text-xs"
                value={config.modalidadeLanceId ?? ""}
                onChange={(e) => patch({ modalidadeLanceId: e.target.value })}
              >
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={config.usaRecursoProprio}
              onChange={(e) => patch({ usaRecursoProprio: e.target.checked })}
            />
            Recurso próprio
          </label>
          {config.usaRecursoProprio ? (
            <div className="flex gap-1">
              <Select
                className="h-8 w-16 border-zinc-700 bg-zinc-950 text-xs"
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
                className="h-8 w-24 border-zinc-700 bg-zinc-950 text-xs"
                value={config.recursoProprioInput}
                onChange={(e) =>
                  patch({ recursoProprioInput: Number(e.target.value) || 0 })
                }
              />
            </div>
          ) : null}
          {resultado.avisoRecursoProprio ? (
            <p className="text-[10px] text-amber-400">{resultado.avisoRecursoProprio}</p>
          ) : null}
        </div>

        {temSeguro ? (
          <div>
            <label className="mb-1 block text-[10px] uppercase text-zinc-500">Seguro</label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1",
                  config.usaSeguro
                    ? "bg-amber-500 text-zinc-950"
                    : "border border-zinc-600 text-zinc-400",
                )}
                onClick={() => patch({ usaSeguro: true })}
              >
                Com
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1",
                  !config.usaSeguro
                    ? "bg-zinc-700 text-zinc-100"
                    : "border border-zinc-600 text-zinc-400",
                )}
                onClick={() => patch({ usaSeguro: false })}
              >
                Sem
              </button>
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">Seguro não configurado</span>
        )}
      </div>

      <div className="grid gap-2 border-t border-zinc-800/80 pt-2 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Saldo devedor final</p>
          <p className="font-semibold text-white">
            {formatCurrency(resultado.saldoDevedorFinal)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Pós-contemplação</p>
          <p className="font-semibold text-emerald-300">
            {formatCurrency(resultado.parcelaPosContemplacao)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Crédito líquido</p>
          <p className="font-semibold text-amber-400">
            {formatCurrency(resultado.creditoLiquido)}
          </p>
        </div>
      </div>

      {resultado.ativo ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-zinc-400 hover:text-zinc-200"
          onClick={() =>
            onChange({
              ...config,
              quantidadeCotas: 0,
            })
          }
        >
          Limpar seleção
        </Button>
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
      <td className="px-3 py-4">
        <div className="font-semibold text-amber-400">{grupo.codigo_grupo}</div>
        {ativo ? (
          <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
            Selecionado
          </span>
        ) : null}
      </td>
      <td className="px-3 py-4">
        <GrupoSimulacaoLinhaControls
          grupo={grupo}
          cotas={cotas}
          modalidades={modalidades}
          config={config}
          onChange={onChange}
        />
      </td>
      <td className="px-3 py-4">
        <GrupoPrazoCell grupo={grupo} />
      </td>
      <td className="px-3 py-4 font-medium">{formatCurrency(resultado.saldoDevedorFinal)}</td>
      <td className="px-3 py-4 font-medium text-emerald-300">
        {formatCurrency(resultado.parcelaPosContemplacao)}
      </td>
      <td className="px-3 py-4">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">{grupo.status}</span>
      </td>
    </tr>
  );
}
