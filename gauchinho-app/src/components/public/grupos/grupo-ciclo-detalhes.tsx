"use client";

import type { GrupoConsorcio } from "@/lib/types";
import { calcularCicloGrupoDatas, formatDataBr } from "@/lib/grupos/prazos";

export function GrupoCicloDetalhes({ grupo }: { grupo: GrupoConsorcio }) {
  const ciclo = calcularCicloGrupoDatas(grupo);

  return (
    <div className="mb-4 grid gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Participantes do grupo
        </p>
        <p className="mt-0.5 text-sm font-medium text-zinc-100">
          {ciclo.participantes != null ? ciclo.participantes.toLocaleString("pt-BR") : "—"}
        </p>
        {ciclo.participantes == null ? (
          <p className="text-[10px] text-zinc-500">Cadastre no admin (sorteio / cotas).</p>
        ) : null}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          1ª assembleia (início)
        </p>
        <p className="mt-0.5 text-sm font-medium text-zinc-100">
          {ciclo.dataPrimeiraAssembleia
            ? formatDataBr(ciclo.dataPrimeiraAssembleia)
            : "—"}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Término do grupo
        </p>
        <p className="mt-0.5 text-sm font-medium text-zinc-100">
          {ciclo.dataTerminoGrupo ? formatDataBr(ciclo.dataTerminoGrupo) : "—"}
        </p>
        {ciclo.prazoTotalMeses != null ? (
          <p className="text-[10px] text-zinc-500">{ciclo.prazoTotalMeses} meses (prazo total)</p>
        ) : null}
      </div>
      <div className="text-[10px] leading-snug text-zinc-500 sm:col-span-2 lg:col-span-1">
        Datas calculadas com base na data base do cadastro, parcelas já realizadas na base e prazo
        total do grupo.
      </div>
    </div>
  );
}
