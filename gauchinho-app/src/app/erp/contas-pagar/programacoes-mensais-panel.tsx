"use client";

import { useEffect, useState } from "react";
import { consultarProgramacoesMensais } from "./actions";

type Programacoes = Awaited<ReturnType<typeof consultarProgramacoesMensais>>;

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ListaProgramacoes() {
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<Programacoes | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let atual = true;
    consultarProgramacoesMensais(pagina)
      .then((dados) => {
        if (atual) {
          if (pagina > dados.totalPaginas) {
            setPagina(dados.totalPaginas);
          } else {
            setResultado(dados);
            setCarregando(false);
          }
        }
      })
      .catch(() => {
        if (atual) {
          setErro(true);
          setCarregando(false);
        }
      });
    return () => { atual = false; };
  }, [pagina, tentativa]);

  function mudarPagina(novaPagina: number) {
    setCarregando(true);
    setPagina(novaPagina);
  }

  if (carregando) return <p role="status" className="text-sm text-slate-600">Carregando programações…</p>;
  if (erro) return (
    <div role="alert" className="text-sm text-rose-700">
      Não foi possível carregar as programações.
      <button type="button" className="ml-2 font-semibold underline" onClick={() => {
        setErro(false);
        setCarregando(true);
        setTentativa((atual) => atual + 1);
      }}>Tentar novamente</button>
    </div>
  );
  if (!resultado?.series.length) return <p className="text-sm text-slate-600">Nenhuma programação mensal com lançamentos em aberto.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Despesa</th>
              <th scope="col" className="px-3 py-2">Primeiro vencimento em aberto</th>
              <th scope="col" className="px-3 py-2 text-right">Valor do lançamento</th>
              <th scope="col" className="px-3 py-2 text-right">Ocorrência</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resultado.series.map((serie) => {
              const conta = serie.contas[0];
              if (!conta) return null;
              return (
                <tr key={serie.id}>
                  <th scope="row" className="px-3 py-2 font-semibold text-slate-950">
                    {conta.descricao}
                    {serie.tipo === "DUPLICACAO" && <span className="block text-xs font-normal text-slate-600">Duplicação mensal</span>}
                  </th>
                  <td className="px-3 py-2">{conta.vencimento.split("-").reverse().join("/")}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{moeda.format(Number(conta.valor))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{conta.recorrencia_indice ?? "—"} de {serie.total_ocorrencias}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {resultado.totalPaginas > 1 && (
        <nav aria-label="Páginas das programações mensais" className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm">
          <button type="button" disabled={pagina <= 1} onClick={() => mudarPagina(pagina - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-50">Anterior</button>
          <span>{pagina} de {resultado.totalPaginas}</span>
          <button type="button" disabled={pagina >= resultado.totalPaginas} onClick={() => mudarPagina(pagina + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-50">Próxima</button>
        </nav>
      )}
    </>
  );
}

export function ProgramacoesMensaisPanel({ refreshKey }: { refreshKey: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="programacoes-mensais"
        onClick={() => setAberto((atual) => !atual)}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {aberto ? "Ocultar programações mensais" : "Listar fixas mensais"}
      </button>
      <div id="programacoes-mensais" hidden={!aberto} className="mt-3">
        {aberto && <ListaProgramacoes key={refreshKey} />}
      </div>
    </section>
  );
}
