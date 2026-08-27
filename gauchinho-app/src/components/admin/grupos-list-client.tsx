"use client";

import Link from "next/link";
import { calcularPrazoGrupoFromRow, grupoPrecisaReajusteCredito } from "@/lib/grupos/prazos";
import type { GrupoConsorcio } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { GrupoTabelaActions } from "@/components/grupos/grupo-tabela-actions";
import type { GrupoTabelaMetadata } from "@/lib/grupos/grupo-tabela.server";

type GrupoListRow = GrupoConsorcio & {
  grupos_cotas?: { count: number }[] | { count: number } | null;
  tabela_grupo?: GrupoTabelaMetadata | null;
};

export function GruposListClient({ grupos }: { grupos: GrupoListRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/90">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Tipo oficial</th>
            <th className="px-3 py-2">Prazo</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Créditos</th>
            <th className="px-3 py-2">Participantes</th>
            <th className="px-3 py-2">Ativo</th>
            <th className="px-3 py-2">Ação</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800 dark:text-zinc-200">
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-zinc-500 dark:text-zinc-400">
                Nenhum grupo encontrado com os filtros selecionados.
              </td>
            </tr>
          ) : null}
          {grupos.map((grupo) => {
            const count = Array.isArray(grupo.grupos_cotas)
              ? grupo.grupos_cotas[0]?.count
              : (grupo.grupos_cotas as { count: number } | undefined)?.count;
            const prazo = calcularPrazoGrupoFromRow(grupo);
            const precisaReajuste = grupoPrecisaReajusteCredito(
              prazo.parcelasRealizadasAtuais,
              grupo.credito_reajustado_ate_meses,
            );
            return (
              <tr
                key={grupo.id}
                className={cn(
                  "border-b border-zinc-100 transition-colors dark:border-zinc-800",
                  precisaReajuste
                    ? "bg-amber-500/10 dark:bg-amber-500/15"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                )}
              >
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {grupo.codigo_grupo}
                </td>
                <td className="px-3 py-2">{grupo.modalidade}</td>
                <td className="px-3 py-2">
                  {prazo.prazoTotal > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold tabular-nums">
                        {prazo.parcelasRealizadasAtuais} / {prazo.prazoTotal}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Restam {prazo.prazoRestanteAtual} meses
                      </span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">{grupo.status}</td>
                <td className="px-3 py-2">{count ?? 0}</td>
                <td className="px-3 py-2">
                  {grupo.quantidade_cotas_sorteio != null && grupo.quantidade_cotas_sorteio > 0
                    ? grupo.quantidade_cotas_sorteio
                    : "—"}
                </td>
                <td className="px-3 py-2">{grupo.ativo ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/grupos/${grupo.id}`}
                      className="text-amber-600 hover:underline dark:text-amber-400"
                    >
                      Detalhes
                    </Link>
                    <GrupoTabelaActions grupoId={grupo.id} origemPortal="SITE" tabela={grupo.tabela_grupo} compact />
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
