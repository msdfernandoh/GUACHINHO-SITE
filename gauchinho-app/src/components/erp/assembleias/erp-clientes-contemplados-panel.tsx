import { listarClientesContempladosAction } from "@/app/erp/assembleias/actions";
import { rotuloModalidadeContemplacao } from "@/lib/erp/contemplacoes";
import { formatBRL } from "@/lib/formatters/money";
import { AvisoContemplado } from "./aviso-contemplado";
import { RecusaContemplacao } from "./recusa-contemplacao";

function formatarData(data: string | null) {
  return data ? data.slice(0, 10).split("-").reverse().join("/") : "—";
}

const COR_MODALIDADE: Record<string, string> = {
  Sorteio: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Lance livre": "bg-blue-50 text-blue-800 border-blue-200",
  "Lance fixo": "bg-violet-50 text-violet-800 border-violet-200",
  "Lance fidelidade": "bg-amber-50 text-amber-800 border-amber-200",
};

export async function ErpClientesContempladosPanel() {
  const cotas = await listarClientesContempladosAction();
  const contempladas = cotas.filter((c) => c.situacao === "contemplada").length;
  const semLance = cotas.length - contempladas;

  return (
    <section className="rounded-xl border bg-white">
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold text-slate-900">Clientes contemplados</h2>
        <p className="text-sm text-slate-600">
          {contempladas} {contempladas === 1 ? "cota contemplada" : "cotas contempladas"}
          {semLance ? ` · ${semLance} contemplação(ões) por lance sem pagamento` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-500">No lance livre o cliente pode recusar (não pagar o lance). Use “Cliente recusou” para a cota voltar a concorrer como cota normal. As desclassificadas pela Racon já entram assim.</p>
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
                <th scope="col" className="px-4 py-3">Modalidade</th>
                <th scope="col" className="px-4 py-3">Contratação</th>
                <th scope="col" className="px-4 py-3">Valor da cota</th>
                <th scope="col" className="px-4 py-3">Contemplação</th>
                <th scope="col" className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cotas.map((cota) => {
                const mod = rotuloModalidadeContemplacao(cota.modalidade);
                const lance = !!mod && mod !== "Sorteio";
                return (
                  <tr key={cota.id} className={cota.situacao === "contemplada" ? "" : "bg-slate-50/70 text-slate-500"}>
                    <th scope="row" className={`px-4 py-3 font-semibold ${cota.situacao === "contemplada" ? "text-slate-900" : "text-slate-500"}`}>{cota.cliente}</th>
                    <td className="px-4 py-3">{cota.grupo} / {cota.cota}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {mod ? <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${COR_MODALIDADE[mod] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>{mod}</span> : <span className="text-xs text-slate-400">Não informada</span>}
                        {cota.situacao === "desclassificada" && <span className="text-xs font-semibold text-red-700">Desclassificada · lance não pago</span>}
                        {cota.situacao === "recusada" && <span className="text-xs font-semibold text-red-700">Recusada · voltou aos sorteios</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatarData(cota.contratacao)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{cota.credito == null ? "—" : formatBRL(cota.credito)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatarData(cota.contemplacao)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-start gap-2">
                        {cota.situacao === "contemplada" && <AvisoContemplado cota={cota} />}
                        {(cota.situacao === "recusada" || (cota.situacao === "contemplada" && lance)) && (
                          <RecusaContemplacao grupoId={cota.grupoId} cota={cota.cota} data={cota.contemplacao} modalidade={cota.modalidade} recusaId={cota.recusaId} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
