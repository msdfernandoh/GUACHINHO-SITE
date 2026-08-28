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

function formatPrazo(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  accent?: "gold";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-zinc-800/90 bg-zinc-950/70 px-2.5 py-1.5 sm:px-3 sm:py-2",
        className,
      )}
    >
      <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-sm font-bold tabular-nums sm:text-base",
          accent === "gold" ? "text-amber-400" : "text-zinc-100",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[9px] leading-snug text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function InlineStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[4.5rem] shrink-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("text-base font-bold tabular-nums", accent ? "text-amber-400" : "text-zinc-100")}>
        {value}
      </p>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TotalCard label="Grupos" value={String(totais.gruposSelecionados)} />
        <TotalCard label="Qtd. cotas" value={String(totais.totalCotas)} />
        <TotalCard label="Soma cotas" value={formatCurrency(totais.somaCotas)} accent="gold" />
        <TotalCard label="1ª parcela" value={formatCurrency(totais.primeiraParcela)} accent="gold" />
      </div>

      <div className="mt-2 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
        <TotalCard
          label="Lance total"
          value={formatCurrency(totais.lanceTotal)}
          sub={`Emb. ${formatCurrency(totais.lanceEmbutido)} · Próp. ${formatCurrency(totais.recursoProprio)}`}
          accent="gold"
        />
        <div className="grid grid-cols-2 gap-2">
          <TotalCard label="Crédito líquido" value={formatCurrency(totais.creditoLiquido)} accent="gold" />
          <TotalCard label="Saldo pós-lance" value={formatCurrency(totais.saldoPosLance)} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <TotalCard
          label="Parcela pós-contemplação"
          value={formatCurrency(totais.parcelaPosContemplacaoTotal)}
          accent="gold"
        />
        <TotalCard
          label="Prazo restante pós-contemplação"
          value={formatPrazo(totais.prazoRestanteAposContemplacaoMax)}
        />
      </div>

      <div
        className={cn(
          "mt-2 flex flex-col gap-2",
          compactActions ? "sm:flex-row sm:flex-wrap" : "sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch",
        )}
      >
        <Button
          type="button"
          variant="gold"
          className="min-h-10 w-full whitespace-nowrap px-4 text-sm font-bold sm:flex-1 lg:w-full"
          disabled={contratarLoading}
          onClick={onContratar}
        >
          Contratar agora
        </Button>
        {onGerarLink ? (
          <Button
            type="button"
            variant="outlineGold"
            className="min-h-9 w-full border-zinc-600 bg-zinc-900 text-xs sm:flex-1 lg:w-full"
            disabled={contratarLoading}
            onClick={onGerarLink}
          >
            Gerar link da proposta
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outlineGold"
          className="min-h-9 w-full border-zinc-600 bg-zinc-900 text-xs lg:w-full"
          onClick={onProposta}
        >
          Gerar proposta PDF
        </Button>
      </div>

      {toastMsg ? <p className="mt-2 text-xs text-amber-300">{toastMsg}</p> : null}
      {resultMsg ? <p className="mt-1 text-xs text-emerald-400">{resultMsg}</p> : null}
      {pdfLink ? (
        <a
          href={pdfLink}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs text-amber-400 underline"
        >
          Baixar proposta PDF
        </a>
      ) : null}
    </>
  );
}

function DesktopTotalsBar(props: Props) {
  const { totais, toastMsg, resultMsg, pdfLink, onProposta, onContratar, onGerarLink, contratarLoading } =
    props;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-5 gap-y-2">
        <InlineStat label="Grupos" value={String(totais.gruposSelecionados)} />
        <InlineStat label="Cotas" value={String(totais.totalCotas)} />
        <InlineStat label="Soma cotas" value={formatCurrency(totais.somaCotas)} accent />
        <InlineStat label="1ª parcela" value={formatCurrency(totais.primeiraParcela)} accent />
        <span className="hidden h-8 w-px bg-zinc-700 xl:block" aria-hidden />
        <InlineStat label="Lance" value={formatCurrency(totais.lanceTotal)} accent />
        <InlineStat label="Créd. líquido" value={formatCurrency(totais.creditoLiquido)} accent />
        <InlineStat label="Saldo pós-lance" value={formatCurrency(totais.saldoPosLance)} />
        <InlineStat
          label="Parcela pós-cont."
          value={formatCurrency(totais.parcelaPosContemplacaoTotal)}
          accent
        />
        <InlineStat
          label="Prazo pós-cont."
          value={formatPrazo(totais.prazoRestanteAposContemplacaoMax)}
        />
        <p className="w-full text-[10px] text-zinc-500 xl:w-auto xl:max-w-[220px]">
          Lance: emb. {formatCurrency(totais.lanceEmbutido)} · próp. {formatCurrency(totais.recursoProprio)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="gold"
          className="min-h-10 whitespace-nowrap px-4 text-sm font-bold"
          disabled={contratarLoading}
          onClick={onContratar}
        >
          Contratar agora
        </Button>
        {onGerarLink ? (
          <Button
            type="button"
            variant="outlineGold"
            className="min-h-10 border-zinc-600 bg-zinc-900 px-3 text-xs"
            disabled={contratarLoading}
            onClick={onGerarLink}
          >
            Link proposta
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outlineGold"
          className="min-h-10 border-zinc-600 bg-zinc-900 px-3 text-xs"
          onClick={onProposta}
        >
          PDF
        </Button>
      </div>

      {(toastMsg || resultMsg || pdfLink) && (
        <div className="w-full basis-full border-t border-zinc-800/80 pt-2 text-xs">
          {toastMsg ? <p className="text-amber-300">{toastMsg}</p> : null}
          {resultMsg ? <p className="text-emerald-400">{resultMsg}</p> : null}
          {pdfLink ? (
            <a href={pdfLink} target="_blank" rel="noreferrer" className="text-amber-400 underline">
              Baixar proposta PDF
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function GrupoTotalsBar(props: Props) {
  const { totais, onContratar, onGerarLink, contratarLoading } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  const temSelecao = totais.gruposSelecionados > 0 || totais.totalCotas > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-amber-500/25 bg-zinc-950/95 shadow-[0_-8px_28px_rgba(0,0,0,0.28)] backdrop-blur-md">
      <div className="lg:hidden">
        <div className="flex items-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            className="min-h-10 shrink-0 px-3 text-xs font-bold"
            disabled={contratarLoading}
            onClick={onContratar}
          >
            Contratar
          </Button>
          {onGerarLink ? (
            <Button
              type="button"
              variant="outlineGold"
              size="sm"
              className="min-h-10 shrink-0 border-zinc-600 bg-zinc-900 px-3 text-xs"
              disabled={contratarLoading}
              onClick={onGerarLink}
            >
              Gerar link
            </Button>
          ) : null}
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
          <div className="max-h-[min(38vh,280px)] overflow-y-auto border-t border-zinc-800/80 px-3 py-2">
            <TotalsBarContent {...props} compactActions />
          </div>
        ) : null}
      </div>

      <div className="mx-auto hidden max-w-[1600px] px-4 py-3 sm:px-6 lg:block">
        <DesktopTotalsBar {...props} />
      </div>
    </div>
  );
}
