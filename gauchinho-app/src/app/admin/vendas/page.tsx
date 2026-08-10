import { getCurrentTenantContext } from "@/lib/tenant/context";
import { listVendasForEmpresa, listCotasDefinitivasForEmpresa } from "@/lib/vendas/vendas-service";
import Link from "next/link";

export default async function AdminVendasPage() {
  const { empresaAtiva } = await getCurrentTenantContext();

  const empresaId = empresaAtiva?.id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  const empresaNome = empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? "Gauchinho Consórcios";

  const vendas = await listVendasForEmpresa(empresaId);
  const cotas = await listCotasDefinitivasForEmpresa(empresaId);

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendas &amp; Cotas Definitivas</h1>
          <p className="text-sm text-slate-500">
            Empresa: <strong className="text-slate-700">{empresaNome}</strong>
          </p>
        </div>
      </div>

      {/* Seção Vendas Efetivadas */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Vendas Efetivadas ({vendas.length})</h2>
        {vendas.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma venda registrada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Crédito</th>
                  <th className="p-3">Prazo</th>
                  <th className="p-3">Parcela</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vendas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-900">
                      {v.cliente_nome}
                      {v.cliente_email && <div className="text-xs text-slate-500">{v.cliente_email}</div>}
                    </td>
                    <td className="p-3 text-slate-700">
                      {v.valor_credito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-slate-700">{v.prazo} meses</td>
                    <td className="p-3 text-slate-700">
                      {v.parcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {v.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seção Cotas Definitivas */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Cotas Definitivas do Cliente ({cotas.length})</h2>
        {cotas.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma cota definitiva registrada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Grupo</th>
                  <th className="p-3">Cota</th>
                  <th className="p-3">Crédito</th>
                  <th className="p-3">Prazo</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cotas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-900">{c.numero_grupo}</td>
                    <td className="p-3 text-slate-700">{c.numero_cota ?? "Pendente SIF"}</td>
                    <td className="p-3 text-slate-700">
                      {c.valor_credito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-slate-700">{c.prazo} meses</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {c.status}
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
