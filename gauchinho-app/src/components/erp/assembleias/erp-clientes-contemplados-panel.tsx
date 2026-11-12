import { listarClientesContempladosAction } from "@/app/erp/assembleias/actions";
import { formatBRL } from "@/lib/formatters/money";

function formatarData(data: string | null) {
  return data ? data.slice(0, 10).split("-").reverse().join("/") : "—";
}

export async function ErpClientesContempladosPanel() {
  const cotas = await listarClientesContempladosAction();

  return (
    <section className="rounded-xl border bg-white">
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold text-slate-900">Clientes contemplados</h2>
        <p className="text-sm text-slate-600">{cotas.length} {cotas.length === 1 ? "cota contemplada" : "cotas contempladas"}</p>
      </header>
      {cotas.length === 0 ? (
        <p className="p-5 text-sm text-slate-600">Nenhuma cota contemplada identificada na carteira.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Cliente</th>
                <th scope="col" className="px-4 py-3">Grupo / Cota</th>
                <th scope="col" className="px-4 py-3">Data da contratação</th>
                <th scope="col" className="px-4 py-3">Valor da cota</th>
                <th scope="col" className="px-4 py-3">Data da contemplação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cotas.map((cota) => (
                <tr key={cota.id}>
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{cota.cliente}</th>
                  <td className="px-4 py-3">{cota.grupo} / {cota.cota}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatarData(cota.contratacao)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{cota.credito == null ? "—" : formatBRL(cota.credito)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatarData(cota.contemplacao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
