"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marcarReajusteCreditoGrupoAction } from "@/app/admin/grupos/actions";
import {
  calcularPrazoGrupoFromRow,
  grupoPrecisaReajusteCredito,
  milestoneReajusteMeses,
} from "@/lib/grupos/prazos";
import type { GrupoConsorcio } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

type GrupoListRow = GrupoConsorcio & {
  grupos_cotas?: { count: number }[] | { count: number } | null;
};

export function GruposListClient({ grupos }: { grupos: GrupoListRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const marcarReajuste = (grupoId: string, codigo: string, marco: number) => {
    if (
      !confirm(
        `Confirmar que o crédito do grupo ${codigo} foi reajustado no marco de ${marco} meses?\n\nO destaque será removido até o próximo ciclo (a cada 12 meses).`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await marcarReajusteCreditoGrupoAction(grupoId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/90">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Modalidade</th>
            <th className="px-3 py-2">Prazo</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Cotas (valores)</th>
            <th className="px-3 py-2">Participantes</th>
            <th className="px-3 py-2">Ativo</th>
            <th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800 dark:text-zinc-200">
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-zinc-500 dark:text-zinc-400">
                Nenhum grupo encontrado. Ajuste os filtros ou cadastre um novo grupo.
              </td>
            </tr>
          ) : null}
          {grupos.map((g) => {
            const count = Array.isArray(g.grupos_cotas)
              ? g.grupos_cotas[0]?.count
              : (g.grupos_cotas as { count: number } | undefined)?.count;
            const prazo = calcularPrazoGrupoFromRow(g);
            const marco = milestoneReajusteMeses(prazo.parcelasRealizadasAtuais);
            const precisaReajuste = grupoPrecisaReajusteCredito(
              prazo.parcelasRealizadasAtuais,
              g.credito_reajustado_ate_meses,
            );
            const prazoLabel =
              prazo.prazoTotal > 0
                ? `${prazo.parcelasRealizadasAtuais} / ${prazo.prazoTotal}`
                : "—";

            return (
              <tr
                key={g.id}
                className={cn(
                  "border-b border-zinc-100 transition-colors dark:border-zinc-800",
                  precisaReajuste
                    ? "bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:hover:bg-amber-500/30"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                )}
              >
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {g.codigo_grupo}
                </td>
                <td className="px-3 py-2">{g.modalidade}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        precisaReajuste && "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {prazoLabel}
                    </span>
                    {precisaReajuste ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Reajustar crédito ({marco}m)
                      </span>
                    ) : prazo.prazoTotal > 0 ? (
                      <span className="text-[11px] text-zinc-500">
                        Restam {prazo.prazoRestanteAtual} meses
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">{g.status}</td>
                <td className="px-3 py-2">{count ?? 0}</td>
                <td className="px-3 py-2">
                  {g.quantidade_cotas_sorteio != null && g.quantidade_cotas_sorteio > 0
                    ? g.quantidade_cotas_sorteio
                    : "—"}
                </td>
                <td className="px-3 py-2">{g.ativo ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <Link
                      href={`/admin/grupos/${g.id}`}
                      className="text-amber-600 hover:underline dark:text-amber-400"
                    >
                      Editar
                    </Link>
                    {precisaReajuste ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => marcarReajuste(g.id, g.codigo_grupo, marco)}
                        className="text-left text-xs font-semibold text-amber-800 underline decoration-amber-600/50 hover:text-amber-950 disabled:opacity-50 dark:text-amber-200"
                      >
                        Marcar reajuste feito
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
