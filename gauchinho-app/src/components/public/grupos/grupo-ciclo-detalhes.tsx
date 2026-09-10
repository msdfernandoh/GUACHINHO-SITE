"use client";

import type { GrupoConsorcio } from "@/lib/types";
import { calcularCicloGrupoDatas, formatDataBr } from "@/lib/grupos/prazos";
import { descricaoReajusteAnual } from "@/lib/grupos/reajuste-anual";
import { cn } from "@/lib/utils/cn";

export function GrupoCicloDetalhes({ grupo }: { grupo: GrupoConsorcio }) {
  const ciclo = calcularCicloGrupoDatas(grupo);
  const reajuste = descricaoReajusteAnual(grupo);

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Vagas Disponíveis */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Vagas disponíveis
          </p>
          <p className="mt-0.5 text-base font-bold text-emerald-300">
            {ciclo.vagasDisponiveis != null ? (
              ciclo.vagasDisponiveis > 0 ? (
                `${ciclo.vagasDisponiveis.toLocaleString("pt-BR")} vagas`
              ) : (
                <span className="text-red-400 text-xs font-semibold">0 (Esgotado)</span>
              )
            ) : (
              "—"
            )}
          </p>
          {grupo.aguardando_novas_vagas ? (
            <p className="text-[9px] font-medium text-sky-300">Aguardando novas vagas</p>
          ) : (
            <p className="text-[9px] text-zinc-500">Cadastro do grupo</p>
          )}
        </div>

        {/* 2. Participantes / Capacidade */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Participantes / Capacidade
          </p>
          <p className="mt-0.5 text-base font-bold text-zinc-100">
            {ciclo.participantes != null ? ciclo.participantes.toLocaleString("pt-BR") : "—"}
          </p>
          <p className="text-[9px] text-zinc-500">Capacidade do grupo</p>
        </div>

        {/* 3. 1ª Assembleia (Início) */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            1ª assembleia (início)
          </p>
          <p className="mt-0.5 text-base font-bold text-zinc-100">
            {ciclo.dataPrimeiraAssembleia
              ? formatDataBr(ciclo.dataPrimeiraAssembleia)
              : "—"}
          </p>
          <p className="text-[9px] text-zinc-500">Início oficial</p>
        </div>

        {/* 4. Término do Grupo */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Término do grupo
          </p>
          <p className="mt-0.5 text-base font-bold text-zinc-100">
            {ciclo.dataTerminoGrupo ? formatDataBr(ciclo.dataTerminoGrupo) : "—"}
          </p>
          <p className="text-[9px] text-zinc-500">
            {ciclo.prazoTotalMeses != null ? `${ciclo.prazoTotalMeses} meses (prazo total)` : "Prazo total"}
          </p>
        </div>

        {/* 5. Assembleias / Prazo Restante */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Assembleias / Prazo
          </p>
          <p className="mt-0.5 text-base font-bold text-zinc-100">
            {ciclo.prazoTotalMeses ? `${ciclo.parcelasRealizadas} / ${ciclo.prazoTotalMeses}` : "—"}
          </p>
          <p className="text-[9px] text-zinc-500">
            {ciclo.prazoRestante} meses restantes
          </p>
        </div>

        {/* 6. Taxa Administrativa */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Taxa administrativa
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-200">
            {grupo.taxa_administrativa_percentual != null
              ? `${Number(grupo.taxa_administrativa_percentual).toLocaleString("pt-BR")}%`
              : "—"}
          </p>
        </div>

        {/* 7. Fundo de Reserva */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Fundo de reserva
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-200">
            {grupo.fundo_reserva_percentual != null
              ? `${Number(grupo.fundo_reserva_percentual).toLocaleString("pt-BR")}%`
              : "—"}
          </p>
        </div>

        {/* 8. Reajuste Anual */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Reajuste anual
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-200">
            {reajuste || (grupo.tipo_reajuste_anual === "FIXO"
              ? `${Number(grupo.reajuste_anual_percentual ?? 0).toLocaleString("pt-BR")}% fixo`
              : grupo.tipo_reajuste_anual === "VARIAVEL"
                ? String(grupo.reajuste_anual_indice ?? "Variável")
                : "Não informado")}
          </p>
        </div>

        {/* 9. Seguro */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Seguro mensal
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-200">
            {grupo.seguro_habilitado && grupo.seguro_percentual != null
              ? `${Number(grupo.seguro_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`
              : "Não incide"}
          </p>
        </div>

        {/* 10. Administradora / Tipo */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Administradora / Tipo
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-200">
            {grupo.administradora ?? "Racon"} · {grupo.modalidade ?? "Consórcio"}
          </p>
        </div>
      </div>

      {/* Observações operacionais do SaaS */}
      {grupo.observacoes ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Observações operacionais do SaaS
          </p>
          <p className="mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
            {grupo.observacoes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
