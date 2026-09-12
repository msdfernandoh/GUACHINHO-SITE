"use client";

import Image from "next/image";
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";
import type { CheckinDisponibilidadeInfo } from "@/lib/eventos-sorteio/disponibilidade";

type Props = {
  evento: {
    id: string;
    nome: string;
    slug: string;
    corPrimaria?: string | null;
    corSecundaria?: string | null;
    logoPersonalizadoUrl?: string | null;
  };
  disponibilidade: CheckinDisponibilidadeInfo;
};

export function EventoCheckinFechado({ evento, disponibilidade }: Props) {
  const tenantBrand = useTenantBrand();
  const logo = evento.logoPersonalizadoUrl || tenantBrand.logoUrl;
  const primaryColor = evento.corPrimaria || tenantBrand.corPrimaria || "#0066cc";
  const brandNome = tenantBrand.nome || "Consórcios";

  const isEncerrado = disponibilidade.status === "encerrado";

  return (
    <div
      className="mx-auto w-full max-w-md min-h-[70vh] flex flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white/95 p-6 text-zinc-900 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-100 sm:p-8"
      style={{ "--theme-primary": primaryColor } as React.CSSProperties}
    >
      {/* Cabeçalho da Marca */}
      <header className="flex flex-col items-center text-center">
        {logo ? (
          <div className="flex h-14 w-auto items-center justify-center">
            <Image
              src={logo}
              alt={brandNome}
              width={160}
              height={56}
              className="max-h-12 w-auto object-contain"
              priority
            />
          </div>
        ) : (
          <span className="text-lg font-black tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
            {brandNome}
          </span>
        )}
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {evento.nome}
        </p>
      </header>

      {/* Conteúdo Central */}
      <div className="my-auto py-8 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-3xl dark:bg-zinc-800/80">
          {isEncerrado ? "🏁" : "⏳"}
        </div>

        <div className="space-y-2">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              isEncerrado
                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
            }`}
          >
            {isEncerrado ? "Check-in Encerrado" : "Check-in Ainda Não Aberto"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEncerrado ? "Este evento já encerrou" : "Aguarde a liberação do check-in"}
          </h1>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          {isEncerrado ? (
            <p>O período de check-in e sorteio de prêmios deste evento já foi finalizado.</p>
          ) : (
            <div className="space-y-2">
              {disponibilidade.horarioEventoFormatado ? (
                <p>
                  Confirmado para: <strong>{disponibilidade.horarioEventoFormatado}</strong>
                </p>
              ) : null}
              {disponibilidade.horarioAberturaFormatado ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  A liberação do check-in e número da sorte ocorrerá a partir das{" "}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {disponibilidade.horarioAberturaFormatado}
                  </strong>
                  .
                </p>
              ) : null}
            </div>
          )}
        </div>

        {!isEncerrado ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            💡 Guarde este link ou QR Code e acerte sua presença no horário programado para concorrer aos prêmios!
          </p>
        ) : null}
      </div>

      {/* Rodapé discreto */}
      <footer className="text-center text-xs text-zinc-400 dark:text-zinc-600">
        Presença e sorteio de brindes · {brandNome}
      </footer>
    </div>
  );
}
