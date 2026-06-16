"use client";

import { useState } from "react";
import type { PublicGrupoAggregate } from "@/lib/types";
import { defaultConfigLinha, type ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { GrupoRow } from "@/components/public/grupos/grupo-row";
import { Th } from "@/components/public/grupos/grupos-primitives";

type Props = {
  rows: PublicGrupoAggregate[];
  configs: Record<string, ConfigLinhaSimulacaoGrupo>;
  onConfigChange: (grupoId: string, config: ConfigLinhaSimulacaoGrupo) => void;
};

export function GruposTable({ rows, configs, onConfigChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="min-w-[1360px] w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <tr>
            <Th>Grupo</Th>
            <Th>Cota</Th>
            <Th>Qtd.</Th>
            <Th>Soma</Th>
            <Th title="Crédito + taxas e fundo — base dos lances %">Saldo devedor</Th>
            <Th>Parcela</Th>
            <Th title="Lance embutido (% sobre saldo devedor)">Embutido</Th>
            <Th title="Recurso próprio (% sobre saldo devedor)">Próprio</Th>
            <Th>Lance total</Th>
            <Th>Seguro</Th>
            <Th title="Crédito contratado − lance embutido">Crédito líquido</Th>
            <Th title="Saldo devedor − lance total">Saldo pós-lance</Th>
            <Th>Pós-cont.</Th>
            <Th title="Total / restante / realizadas">Prazo</Th>
            <Th className="sticky right-0 bg-zinc-950/95">Ajustes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ grupo, cotas, modalidades }) => {
            const config =
              configs[grupo.id] ?? defaultConfigLinha(grupo, cotas, modalidades);
            return (
              <GrupoRow
                key={grupo.id}
                grupo={grupo}
                cotas={cotas}
                modalidades={modalidades}
                config={config}
                onChange={(c) => onConfigChange(grupo.id, c)}
                expanded={expandedId === grupo.id}
                onToggleExpand={() =>
                  setExpandedId((id) => (id === grupo.id ? null : grupo.id))
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
