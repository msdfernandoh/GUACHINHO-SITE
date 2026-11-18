import { resumirDashboardSpl } from "@/lib/spl/dashboard";
import { STATUS_CLIENTE, labelDe, type ClienteSpl, type ModeloParceria, type VendedorSpl } from "@/lib/spl/types";
import { BotaoCopiar, brl, Cartao } from "./spl-ui";
import { PlanoRecebimentoSpl } from "./spl-plano-recebimento";

const valorFormatado = (valor: number | null) => valor === null ? "—" : brl(valor);

export function SplDashboardImobiliaria({ clientes, vendedores, modelo, individual, links = {}, origem = "" }: {
  clientes: ClienteSpl[];
  vendedores: VendedorSpl[];
  modelo: ModeloParceria | null;
  individual?: VendedorSpl;
  links?: Record<string, string>;
  origem?: string;
}) {
  const dados = resumirDashboardSpl(clientes, vendedores, modelo);
  const indicadores = [
    ["Clientes indicados", String(dados.indicacoes.length)],
    ["Volume de negócio previsto", valorFormatado(dados.previsto)],
    ["Volume de negócio fechado", valorFormatado(dados.fechado)],
    ...(individual
      ? individual.modelo === "PROPRIO" ? [] : [["Minha comissão estimada", valorFormatado(dados.vendedores[0]?.comissao ?? null)]]
      : [
        ["Comissão estimada da imobiliária", valorFormatado(dados.comissaoImobiliaria)],
        ["Comissão estimada dos vendedores", valorFormatado(dados.comissaoVendedores)],
      ]),
  ];

  return (
    <>
      <Cartao>
        <h2 className="text-2xl font-black text-[#0A1931]">Dashboard</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {indicadores.map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-2xl bg-[#0A1931] p-4 text-white">
              <dt className="text-sm text-white">{rotulo}</dt>
              <dd className="mt-1 text-2xl font-black text-[#F59E0B]">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-slate-700">
          Os volumes somam os valores informados para as chaves. O previsto considera negócios em aberto.
          O fechado considera os marcados como fechados no SPL.
        </p>
        {individual?.modelo !== "PROPRIO" && <p className="mt-2 text-sm text-slate-700">
          As comissões são estimativas de consórcios com valor informado, usando o plano integral de imóveis como referência.
          Pagamentos do ERP ainda não estão disponíveis aqui. Em modelo próprio, o vendedor recebe diretamente da imobiliária.
        </p>}
      </Cartao>
      {individual?.modelo !== "PROPRIO" && <PlanoRecebimentoSpl modelo={individual?.modelo ?? modelo} />}
      <Cartao>
        <h3 className="text-xl font-black text-[#0A1931]">Clientes indicados</h3>
        {dados.indicacoes.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-700">
                <tr><th scope="col" className="p-2">Cliente</th><th scope="col" className="p-2">Vendedor</th><th scope="col" className="p-2">Situação</th><th scope="col" className="p-2 text-right">Valor informado</th></tr>
              </thead>
              <tbody className="divide-y">
                {dados.indicacoes.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="p-2 font-semibold">{item.nome}</th>
                    <td className="p-2">{item.vendedor}</td>
                    <td className="p-2">{labelDe(STATUS_CLIENTE, item.status)}</td>
                    <td className="whitespace-nowrap p-2 text-right">{valorFormatado(item.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">Nenhum cliente indicado.</p>}
      </Cartao>
      {!individual && <Cartao>
        <h3 className="text-xl font-black text-[#0A1931]">Comissão por vendedor</h3>
        {dados.vendedores.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-700">
                <tr><th scope="col" className="p-2">Vendedor</th><th scope="col" className="p-2 text-right">Clientes indicados</th><th scope="col" className="p-2 text-right">Comissão estimada</th><th scope="col" className="p-2">Dashboard individual</th></tr>
              </thead>
              <tbody className="divide-y">
                {dados.vendedores.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="p-2 font-semibold">{item.nome}</th>
                    <td className="p-2 text-right">{item.indicacoes}</td>
                    <td className="whitespace-nowrap p-2 text-right">{valorFormatado(item.comissao)}</td>
                    <td className="p-2">
                      {links[item.id] ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a href={links[item.id]} className="font-bold text-[#153E90] underline" target="_blank" rel="noreferrer">Abrir</a>
                          <BotaoCopiar texto={`${origem}${links[item.id]}`} />
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">Nenhum vendedor cadastrado.</p>}
      </Cartao>}
    </>
  );
}
