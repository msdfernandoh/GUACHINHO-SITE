"use client";

import { useMemo, useState } from "react";

export type FormalizacaoCatalogoGrupo = {
  id: string;
  codigo: string;
  administradora: string;
  tipo: string;
  prazoOriginal: number;
  parcelasRestantes: number;
  produtos: Array<{
    id: string;
    valorCredito: number;
    modalidades: Array<{
      id: string;
      codigo: string;
      nome: string;
      valorParcela: number;
      percentualReducao: number | null;
    }>;
  }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function modalidadeHint(codigo: string, percentual: number | null): string {
  if (codigo === "INTEGRAL") return "Parcela cheia (100%)";
  if (codigo === "REDUZIDA_60_99") {
    return percentual ? `Parcela reduzida a ${percentual}%` : "Parcela reduzida entre 60% e 99%";
  }
  if (codigo === "REDUZIDA_ABAIXO_59") {
    return percentual ? `Parcela reduzida a ${percentual}%` : "Parcela reduzida abaixo de 59%";
  }
  return percentual ? `Parcela equivalente a ${percentual}%` : "Condição homologada";
}

export function FormalizacaoCatalogoFields({
  grupos,
  initialGrupoId,
  initialProdutoId,
  initialModalidadeId,
}: {
  grupos: FormalizacaoCatalogoGrupo[];
  initialGrupoId: string;
  initialProdutoId: string;
  initialModalidadeId: string;
}) {
  const initialGrupo = grupos.find((grupo) => grupo.id === initialGrupoId);
  const initialProduto = initialGrupo?.produtos.find((produto) => produto.id === initialProdutoId);
  const initialModalidade = initialProduto?.modalidades.find(
    (modalidade) => modalidade.id === initialModalidadeId,
  );

  const [grupoId, setGrupoId] = useState(initialGrupo?.id ?? "");
  const [produtoId, setProdutoId] = useState(initialProduto?.id ?? "");
  const [modalidadeId, setModalidadeId] = useState(initialModalidade?.id ?? "");

  const grupo = useMemo(() => grupos.find((item) => item.id === grupoId), [grupos, grupoId]);
  const produto = useMemo(
    () => grupo?.produtos.find((item) => item.id === produtoId),
    [grupo, produtoId],
  );
  const modalidade = useMemo(
    () => produto?.modalidades.find((item) => item.id === modalidadeId),
    [produto, modalidadeId],
  );

  function alterarGrupo(nextGrupoId: string) {
    setGrupoId(nextGrupoId);
    setProdutoId("");
    setModalidadeId("");
  }

  function alterarProduto(nextProdutoId: string) {
    setProdutoId(nextProdutoId);
    setModalidadeId("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Grupo canônico
          <select
            required
            name="grupo_id"
            value={grupoId}
            onChange={(event) => alterarGrupo(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o grupo</option>
            {grupos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.administradora} · Grupo {item.codigo} · {item.tipo}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Produto / cota comercial
          <select
            required
            name="opcao_cota_id"
            value={produtoId}
            disabled={!grupo}
            onChange={(event) => alterarProduto(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o valor do crédito</option>
            {(grupo?.produtos ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                Crédito de {money.format(item.valorCredito)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            A parcela e o saldo de meses não fazem parte do produto; são resolvidos abaixo.
          </span>
        </label>
      </div>

      <fieldset
        disabled={!produto}
        className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/20"
      >
        <legend className="px-2 text-sm font-bold text-slate-900 dark:text-white">
          Tipo de venda e modalidade da parcela
        </legend>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
          A escolha recalcula a parcela usando o valor homologado para este produto e esta modalidade.
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {(produto?.modalidades ?? []).map((item) => {
            const selected = modalidadeId === item.id;
            return (
              <label
                key={item.id}
                className={`cursor-pointer rounded-xl border bg-white p-4 transition dark:bg-slate-900 ${
                  selected
                    ? "border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-900"
                    : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"
                }`}
              >
                <span className="flex items-start gap-2">
                  <input
                    required
                    type="radio"
                    name="modalidade_comissao_id"
                    value={item.id}
                    checked={selected}
                    onChange={() => setModalidadeId(item.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-bold">{item.nome}</span>
                    <span className="block text-xs text-slate-500">
                      {modalidadeHint(item.codigo, item.percentualReducao)}
                    </span>
                  </span>
                </span>
                <span className="mt-4 block border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="block text-xs text-slate-500">Parcela atual</span>
                  <strong className="text-lg text-indigo-700 dark:text-indigo-300">
                    {money.format(item.valorParcela)}
                  </strong>
                </span>
              </label>
            );
          })}
        </div>
        {produto && produto.modalidades.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            Produto sem modalidade e parcela homologadas. Corrija o catálogo antes de formalizar.
          </p>
        ) : null}
      </fieldset>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <p className="font-bold">Resumo comercial calculado</p>
        {grupo && produto && modalidade ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <p><span className="block text-xs text-slate-500">Crédito</span>{money.format(produto.valorCredito)}</p>
            <p><span className="block text-xs text-slate-500">Parcela pela modalidade</span>{money.format(modalidade.valorParcela)}</p>
            <p><span className="block text-xs text-slate-500">Parcelas restantes do grupo</span>{grupo.parcelasRestantes} de {grupo.prazoOriginal}</p>
          </div>
        ) : (
          <p className="mt-1 text-slate-500">Escolha grupo, crédito e modalidade para calcular a condição da venda.</p>
        )}
      </div>
    </div>
  );
}
