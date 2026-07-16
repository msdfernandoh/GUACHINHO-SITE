import type { LinhaGrupoPropostaResumo } from "@/lib/contratacoes-online/extract-fields";

export function ContratacaoGruposResumo({ linhas }: { linhas: LinhaGrupoPropostaResumo[] }) {
  if (!linhas.length) return null;
  return (
    <div className="border-b border-slate-800 py-3 last:border-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400/90">
        Grupos selecionados
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="pb-1 pr-3 font-medium">Grupo</th>
              <th className="pb-1 pr-3 font-medium">Tipo</th>
              <th className="pb-1 pr-3 font-medium">Qtd. cotas</th>
              <th className="pb-1 font-medium">Meses decorridos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${l.codigoGrupo}-${i}`} className="border-t border-slate-800/80 text-slate-100">
                <td className="py-2 pr-3 font-semibold text-amber-200/90">{l.codigoGrupo}</td>
                <td className="py-2 pr-3 text-slate-300">{l.modalidade ?? "—"}</td>
                <td className="py-2 pr-3">{l.quantidadeCotas > 0 ? l.quantidadeCotas : "—"}</td>
                <td className="py-2">
                  {l.parcelasRealizadas != null ? `${l.parcelasRealizadas} meses` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
