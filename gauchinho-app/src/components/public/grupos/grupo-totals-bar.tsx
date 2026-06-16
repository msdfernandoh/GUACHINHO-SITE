"use client";

import type { agregarResultadosLinhas } from "@/lib/grupos/simulacao-linha";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/form-primitives";

type Totais = ReturnType<typeof agregarResultadosLinhas>;

type Props = {
  totais: Totais;
  hasSelection: boolean;
  toastMsg: string | null;
  resultMsg: string | null;
  pdfLink: string | null;
  onSimulacao: () => void;
  onProposta: () => void;
  onEspecialista: () => void;
};

function TotalCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "gold" | "green";
}) {
  return (
    <div className="min-w-[100px] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={
          accent === "gold"
            ? "text-lg font-bold tabular-nums text-amber-400"
            : accent === "green"
              ? "text-lg font-bold tabular-nums text-emerald-300"
              : "text-base font-semibold tabular-nums text-zinc-100"
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function GrupoTotalsBar({
  totais,
  hasSelection,
  toastMsg,
  resultMsg,
  pdfLink,
  onSimulacao,
  onProposta,
  onEspecialista,
}: Props) {
  const outlineBtn =
    "border-zinc-500 bg-zinc-900 text-zinc-100 hover:border-amber-500/50 hover:bg-zinc-800 disabled:border-zinc-700 disabled:bg-zinc-800/80 disabled:text-zinc-400";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-amber-500/20 bg-zinc-950/95 px-4 py-4 backdrop-blur-md md:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <TotalCard label="Grupos" value={String(totais.gruposSelecionados)} />
          <TotalCard label="Qtd. cotas" value={String(totais.totalCotas)} />
          <TotalCard
            label="Soma cotas"
            value={formatCurrency(totais.somaCotas)}
            accent="gold"
          />
          <TotalCard label="1ª parcela" value={formatCurrency(totais.primeiraParcela)} />
          <TotalCard
            label="Lance total"
            value={formatCurrency(totais.lanceTotal)}
            sub={`Emb. ${formatCurrency(totais.lanceEmbutido)} · Próp. ${formatCurrency(totais.recursoProprio)}`}
            accent="gold"
          />
          <TotalCard
            label="Crédito líquido"
            value={formatCurrency(totais.creditoLiquido)}
            accent="gold"
          />
          <TotalCard
            label="Pós-contempl."
            value={formatCurrency(totais.parcelaPosContemplacaoTotal)}
            accent="green"
          />
          {totais.seguroTotal > 0 ? (
            <TotalCard label="Seguro/mês" value={formatCurrency(totais.seguroTotal)} />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <Button type="button" variant="gold" onClick={onSimulacao}>
            Gerar simulação
          </Button>
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
            disabled={!hasSelection}
            onClick={onProposta}
          >
            Gerar proposta
          </Button>
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
            disabled={!hasSelection}
            onClick={onEspecialista}
          >
            Falar com especialista
          </Button>
        </div>
      </div>

      {toastMsg ? <p className="mt-2 text-sm text-amber-300">{toastMsg}</p> : null}
      {resultMsg ? <p className="mt-2 text-sm text-emerald-400">{resultMsg}</p> : null}
      {pdfLink ? (
        <a
          href={pdfLink}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm text-amber-400 underline"
        >
          Baixar proposta PDF
        </a>
      ) : null}
    </div>
  );
}
