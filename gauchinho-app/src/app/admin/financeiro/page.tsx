import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getResumoCaixaEmpresa } from "@/lib/financeiro/financeiro-service";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminFinanceiroPage() {
  const { empresaAtiva } = await getCurrentTenantContext();

  const empresaId = empresaAtiva?.id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  const empresaNome = empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? "Gauchinho Consórcios";

  const resumo = await getResumoCaixaEmpresa(empresaId);

  const admin = createAdminClient();
  const { data: movimentos } = await admin
    .from("caixa_movimentos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(50);

  const listaMovimentos = movimentos ?? [];

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Módulo Financeiro &amp; Livro Razão de Caixa</h1>
          <p className="text-sm text-slate-500">
            Empresa: <strong className="text-slate-700">{empresaNome}</strong>
          </p>
        </div>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-emerald-700">Entradas Reais em Caixa</div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">
            {resumo.totalEntradas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-rose-700">Saídas Reais de Caixa</div>
          <div className="text-2xl font-extrabold text-rose-900 mt-1">
            {resumo.totalSaidas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-blue-700">Saldo Atual de Caixa</div>
          <div className="text-2xl font-extrabold text-blue-900 mt-1">
            {resumo.saldoCaixa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </div>

      {/* Indicadores Preditivos & Compensações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs uppercase text-slate-500 font-semibold">Previsões a Receber (Franquia)</div>
          <div className="text-lg font-bold text-slate-800 mt-1">
            {resumo.totalPrevisoesReceber.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs uppercase text-slate-500 font-semibold">Obrigações a Pagar (Participantes)</div>
          <div className="text-lg font-bold text-slate-800 mt-1">
            {resumo.totalPrevisoesPagar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs uppercase text-amber-700 font-semibold">Saldos a Compensar (Estornos)</div>
          <div className="text-lg font-bold text-amber-900 mt-1">
            {resumo.totalSaldosACompensar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </div>

      {/* Tabela do Livro Razão / Caixa */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Livro Razão de Movimentos de Caixa ({listaMovimentos.length})</h2>
        {listaMovimentos.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma movimentação de caixa registrada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Competência</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {listaMovimentos.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-700">{m.data_movimento}</td>
                    <td className="p-3 font-semibold text-slate-900">{m.competencia}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        m.tipo_movimento === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {m.tipo_movimento.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">{m.origem_tipo}</td>
                    <td className="p-3 text-slate-700">{m.descricao}</td>
                    <td className={`p-3 font-bold ${m.tipo_movimento === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>
                      {m.tipo_movimento === "entrada" ? "+" : "-"} {Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
