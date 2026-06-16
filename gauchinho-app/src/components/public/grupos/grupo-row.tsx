"use client";

import { Settings2 } from "lucide-react";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import { grupoUsaSeguroNaParcela } from "@/lib/grupos/calculos";
import { formatPrazoGrupo, type ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/form-primitives";
import { GrupoRowAdjustments } from "@/components/public/grupos/grupo-row-adjustments";
import {
  CellDash,
  CompactNumberInput,
  CompactSelect,
  MoneyPair,
  MoneyValue,
  Td,
} from "@/components/public/grupos/grupos-primitives";
import {
  createGrupoLinhaHandlers,
  useGrupoLinhaCalculo,
} from "@/components/public/grupos/use-grupo-linha";

export type GrupoRowProps = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  config: ConfigLinhaSimulacaoGrupo;
  onChange: (next: ConfigLinhaSimulacaoGrupo) => void;
  expanded: boolean;
  onToggleExpand: () => void;
};

export function GrupoRow({
  grupo,
  cotas,
  modalidades,
  config,
  onChange,
  expanded,
  onToggleExpand,
}: GrupoRowProps) {
  const { resultado, mods, modAtiva } = useGrupoLinhaCalculo({
    grupo,
    cotas,
    modalidades,
    config,
  });
  const temReduzida = grupo.tem_parcela_reduzida;
  const temSeguro = grupoUsaSeguroNaParcela(grupo);
  const pctMinRecurso = modAtiva ? Number(modAtiva.percentual_recurso_proprio_minimo) : 0;
  const handlers = createGrupoLinhaHandlers(config, onChange, mods, pctMinRecurso);
  const ativo = resultado.ativo;

  const recursoPct =
    config.usaRecursoProprio && config.recursoProprioModo === "percentual"
      ? config.recursoProprioInput
      : config.usaRecursoProprio && resultado.somaCotas > 0
        ? Math.round((resultado.recursoProprio / resultado.somaCotas) * 10000) / 100
        : null;

  const modalidadeLabel =
    ativo && config.usaLanceEmbutido && modAtiva
      ? modAtiva.nome
      : ativo && mods.length
        ? "—"
        : null;

  return (
    <>
      <tr
        className={cn(
          "border-b border-zinc-800/80 transition hover:bg-zinc-800/20",
          ativo && "bg-amber-500/[0.04]",
          expanded && "border-b-0",
        )}
      >
        <Td className="min-w-[72px]">
          <div className="font-semibold text-amber-400">{grupo.codigo_grupo}</div>
          {ativo ? (
            <span className="mt-0.5 inline-block rounded bg-amber-500/15 px-1.5 py-px text-[9px] font-medium uppercase text-amber-200">
              Ativo
            </span>
          ) : null}
        </Td>

        <Td className="min-w-[120px]">
          <CompactSelect
            className="min-w-[108px]"
            value={config.cotaId ?? ""}
            onChange={(e) => handlers.onCotaChange(e.target.value)}
          >
            <option value="">Cota…</option>
            {cotas.map((c) => (
              <option key={c.id} value={c.id}>
                {Number(c.valor_credito).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </option>
            ))}
          </CompactSelect>
        </Td>

        <Td>
          <CompactNumberInput
            min={0}
            step={1}
            value={config.quantidadeCotas || ""}
            onChange={(e) => handlers.onQtyChange(e.target.value)}
          />
        </Td>

        <Td>
          {ativo ? (
            <MoneyValue value={resultado.somaCotas} compact className="text-amber-300" />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td className="min-w-[100px]">
          {ativo ? (
            <div className="leading-tight">
              {temReduzida ? (
                <CompactSelect
                  className="mb-0.5 h-7 text-[10px]"
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
                <span className="text-[10px] text-zinc-500">Integral</span>
              )}
              <MoneyValue value={resultado.parcelaBase} compact />
            </div>
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo && resultado.lanceEmbutido > 0 ? (
            <MoneyPair
              pct={resultado.percentualLanceEmbutido}
              value={resultado.lanceEmbutido}
              valueClassName="text-zinc-200"
            />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo && config.usaRecursoProprio && resultado.recursoProprio > 0 ? (
            <MoneyPair pct={recursoPct} value={resultado.recursoProprio} />
          ) : ativo && pctMinRecurso > 0 && !config.usaRecursoProprio ? (
            <span className="text-[10px] text-amber-500/80" title="Ajuste na expansão">
              mín. {pctMinRecurso}%
            </span>
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo && resultado.lanceTotal > 0 ? (
            <MoneyValue value={resultado.lanceTotal} compact className="text-amber-300" />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo && temSeguro ? (
            <div className="leading-tight">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  title="Com seguro"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-medium",
                    config.usaSeguro
                      ? "bg-amber-500/90 text-zinc-950"
                      : "border border-zinc-700 text-zinc-500",
                  )}
                  onClick={() => handlers.patch({ usaSeguro: true })}
                >
                  C
                </button>
                <button
                  type="button"
                  title="Sem seguro"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-medium",
                    !config.usaSeguro
                      ? "bg-zinc-600 text-zinc-100"
                      : "border border-zinc-700 text-zinc-500",
                  )}
                  onClick={() => handlers.patch({ usaSeguro: false })}
                >
                  S
                </button>
              </div>
              {config.usaSeguro && resultado.seguroMensal > 0 ? (
                <MoneyValue value={resultado.seguroMensal} compact className="text-zinc-400" />
              ) : (
                <span className="text-[10px] text-zinc-600">Sem</span>
              )}
            </div>
          ) : ativo ? (
            <span className="text-[10px] text-zinc-600">—</span>
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo ? (
            <MoneyValue value={resultado.creditoLiquido} compact className="font-bold text-amber-400" />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo ? (
            <MoneyValue value={resultado.saldoDevedorFinal} compact className="text-zinc-300" />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          {ativo ? (
            <MoneyValue
              value={resultado.parcelaPosContemplacao}
              compact
              className="font-medium text-emerald-300"
            />
          ) : (
            <CellDash />
          )}
        </Td>

        <Td>
          <span
            className="font-mono text-[11px] text-zinc-400"
            title="Total / restante / realizadas"
          >
            {formatPrazoGrupo(grupo)}
          </span>
        </Td>

        <Td>
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {grupo.status}
          </span>
        </Td>

        <Td className="sticky right-0 bg-zinc-900/95">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 gap-1 border-zinc-600 bg-zinc-900 px-2 text-[11px] text-zinc-100 hover:border-amber-500/40 hover:bg-zinc-800",
              expanded && "border-amber-500/50 text-amber-200",
            )}
            onClick={onToggleExpand}
            title={modalidadeLabel ?? "Ajustes de lance"}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Ajustar
          </Button>
        </Td>
      </tr>

      {expanded ? (
        <tr className="border-b border-zinc-800/80 bg-zinc-950/80">
          <td colSpan={15} className="px-3 py-3">
            <GrupoRowAdjustments
              grupo={grupo}
              cotas={cotas}
              modalidades={modalidades}
              config={config}
              onChange={onChange}
            />
          </td>
        </tr>
      ) : null}
    </>
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
