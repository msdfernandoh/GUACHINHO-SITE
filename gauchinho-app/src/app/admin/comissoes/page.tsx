import { getCurrentTenantContext } from "@/lib/tenant/context";
import { listPrevisoesFranquiaForEmpresa, listPrevisoesParticipantesForEmpresa } from "@/lib/comissoes/comissoes-service";

export default async function AdminComissoesPage() {
  const { empresaAtiva } = await getCurrentTenantContext();

  const empresaId = empresaAtiva?.id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  const empresaNome = empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? "Gauchinho Consórcios";

  const prevFranquia = await listPrevisoesFranquiaForEmpresa(empresaId);
  const prevParticipantes = await listPrevisoesParticipantesForEmpresa(empresaId);

  const totalFranquiaPrevisto = prevFranquia.reduce((acc, curr) => acc + Number(curr.valor_previsto ?? 0), 0);
  const totalPartPrevisto = prevParticipantes.reduce((acc, curr) => acc + Number(curr.valor_previsto ?? 0), 0);

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Motor de Comissões &amp; Previsões de Competência</h1>
          <p className="text-sm text-slate-500">
            Empresa: <strong className="text-slate-700">{empresaNome}</strong>
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-emerald-700">Previsão Receita Franquia (Bruto)</div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">
            {totalFranquiaPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-xs text-emerald-600 mt-1">{prevFranquia.length} parcelas/etapas previstas</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-blue-700">Previsão Comissão Participantes</div>
          <div className="text-2xl font-extrabold text-blue-900 mt-1">
            {totalPartPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-xs text-blue-600 mt-1">{prevParticipantes.length} repasses de participantes previstos</div>
        </div>
      </div>

      {/* Seção Previsões Franquia */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Cronograma de Receita da Franquia ({prevFranquia.length})</h2>
        {prevFranquia.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma previsão de comissão da franquia gerada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Competência</th>
                  <th className="p-3">Etapa</th>
                  <th className="p-3">Base Cálculo</th>
                  <th className="p-3">% Aplicado</th>
                  <th className="p-3">Valor Previsto</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prevFranquia.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{f.competencia}</td>
                    <td className="p-3 text-slate-700">{f.nome_etapa}</td>
                    <td className="p-3 text-slate-700">
                      {Number(f.base_calculo_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-slate-700">{f.percentual_aplicado}%</td>
                    <td className="p-3 font-medium text-emerald-700">
                      {Number(f.valor_previsto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        f.status === "prevista" ? "bg-emerald-100 text-emerald-800" :
                        f.status === "suspensa" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seção Previsões Participantes */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Cronograma de Comissão dos Participantes ({prevParticipantes.length})</h2>
        {prevParticipantes.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma previsão de participante registrada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Competência</th>
                  <th className="p-3">Etapa</th>
                  <th className="p-3">Base Cálculo</th>
                  <th className="p-3">% Aplicado</th>
                  <th className="p-3">Valor Previsto</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prevParticipantes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{p.competencia}</td>
                    <td className="p-3 text-slate-700">{p.nome_etapa}</td>
                    <td className="p-3 text-slate-700">
                      {Number(p.base_calculo_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-slate-700">{p.percentual_aplicado}%</td>
                    <td className="p-3 font-medium text-blue-700">
                      {Number(p.valor_previsto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "prevista" ? "bg-blue-100 text-blue-800" :
                        p.status === "suspensa" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
