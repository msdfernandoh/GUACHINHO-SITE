"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { agregarResultadosLinhas } from "@/lib/grupos/simulacao-linha";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";

type Totais = ReturnType<typeof agregarResultadosLinhas>;

type Props = {
  totais: Totais;
  toastMsg: string | null;
  resultMsg: string | null;
  pdfLink: string | null;
  onProposta: () => void;
  onContratar: () => void;
  onGerarLink?: () => void;
  contratarLoading?: boolean;
};

function TotalCard({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "gold" | "green";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-3 py-2.5 sm:px-4 sm:py-3",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-base font-bold tabular-nums sm:text-lg",
          accent === "gold"
            ? "text-amber-400"
            : accent === "green"
              ? "text-emerald-300"
              : "text-zinc-100",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-[10px] leading-snug text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function TotalsBarContent({
  totais,
  toastMsg,
  resultMsg,
  pdfLink,
  onProposta,
  onContratar,
  onGerarLink,
  contratarLoading,
  compactActions,
}: Props & { compactActions?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TotalCard label="Grupos" value={String(totais.gruposSelecionados)} />
        <TotalCard label="Qtd. cotas" value={String(totais.totalCotas)} />
        <TotalCard label="Soma cotas" value={formatCurrency(totais.somaCotas)} accent="gold" />
        <TotalCard label="1ª parcela" value={formatCurrency(totais.primeiraParcela)} accent="gold" />
      </div>

      <div className="mt-3 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
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
          label="Saldo pós-lance"
          value={formatCurrency(totais.saldoPosLance)}
        />
        <div
          className={cn(
            "flex flex-col gap-2 xl:col-span-1 xl:justify-stretch",
            compactActions && "flex-row flex-wrap sm:flex-col",
          )}
        >
          <Button
            type="button"
            variant="gold"
            className={cn(
              "h-full min-h-12 whitespace-nowrap px-6 text-base font-bold",
              compactActions ? "min-h-10 flex-1 sm:w-full" : "w-full",
            )}
            disabled={contratarLoading}
            onClick={onContratar}
          >
            Contratar agora
          </Button>
          {onGerarLink ? (
            <Button
              type="button"
              variant="outlineGold"
              className={cn(
                "min-h-10 border-zinc-600 bg-zinc-900 text-sm",
                compactActions ? "flex-1 sm:w-full" : "w-full",
              )}
              disabled={contratarLoading}
              onClick={onGerarLink}
            >
              Gerar link da proposta
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outlineGold"
            className={cn(
              "min-h-10 border-zinc-600 bg-zinc-900 text-xs",
              compactActions ? "w-full sm:w-full" : "w-full",
            )}
            onClick={onProposta}
          >
            Gerar proposta PDF
          </Button>
        </div>
      </div>

      {toastMsg ? <p className="mt-3 text-sm text-amber-300">{toastMsg}</p> : null}
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
    </>
  );
}

export function GrupoTotalsBar(props: Props) {
  const { totais, onContratar, contratarLoading } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  const temSelecao = totais.gruposSelecionados > 0 || totais.totalCotas > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-amber-500/20 bg-zinc-950/95 backdrop-blur-md">
      {/* Mobile: faixa compacta — não cobre a lista de grupos */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 pr-16">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Resumo</p>
            <p className="truncate text-sm font-semibold text-zinc-100">
              {temSelecao ? (
                <>
                  {totais.gruposSelecionados} grp · {totais.totalCotas} cotas ·{" "}
                  <span className="text-amber-400">{formatCurrency(totais.creditoLiquido)}</span>
                </>
              ) : (
                "Selecione cota e quantidade"
              )}
            </p>
          </button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            className="shrink-0 px-3 text-xs font-bold"
            disabled={contratarLoading}
            onClick={onContratar}
          >
            Contratar
          </Button>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Recolher resumo" : "Expandir resumo"}
          >
            {mobileOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen ? (
          <div className="max-h-[min(42vh,320px)] overflow-y-auto border-t border-zinc-800/80 px-3 py-3 pr-16">
            <TotalsBarContent {...props} compactActions />
          </div>
        ) : null}
      </div>

      {/* Desktop: layout original */}
      <div className="mx-auto hidden max-w-[1600px] px-4 py-4 pr-20 sm:px-6 sm:pr-44 md:pr-48 lg:block">
        <TotalsBarContent {...props} />
      </div>
    </div>
  );
}
