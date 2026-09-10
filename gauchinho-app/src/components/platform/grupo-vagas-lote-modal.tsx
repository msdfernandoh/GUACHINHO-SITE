"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GrupoRecord } from "@/lib/platform/grupos-prontidao";
import { atualizarVagasGruposLotePlatformAction } from "@/app/platform/grupos-actions";

type Props = {
  grupos: GrupoRecord[];
  onClose: () => void;
};

type FiltroAba = "TODOS" | "COM_VAGAS" | "SEM_VAGAS" | "ALTERADOS";

export function GrupoVagasEmLoteModal({ grupos, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mapa de edições locais: grupoId -> nova quantidade de vagas
  const [vagasEditadas, setVagasEditadas] = useState<Map<string, number>>(new Map());

  // Filtro de texto e abas
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<FiltroAba>("TODOS");

  function getVagasOriginais(g: GrupoRecord): number {
    return Math.max(0, Number(g.vagas_disponiveis) || 0);
  }

  function getVagasAtuais(g: GrupoRecord): number {
    if (vagasEditadas.has(g.id)) {
      return vagasEditadas.get(g.id)!;
    }
    return getVagasOriginais(g);
  }

  function isAlterado(g: GrupoRecord): boolean {
    if (!vagasEditadas.has(g.id)) return false;
    return vagasEditadas.get(g.id) !== getVagasOriginais(g);
  }

  function handleSetVagas(grupoId: string, valor: number) {
    const limpo = Math.max(0, Math.floor(valor || 0));
    setVagasEditadas((prev) => {
      const next = new Map(prev);
      next.set(grupoId, limpo);
      return next;
    });
  }

  function handleAjustarVagas(grupoId: string, delta: number, original: number) {
    const atual = vagasEditadas.has(grupoId) ? vagasEditadas.get(grupoId)! : original;
    handleSetVagas(grupoId, atual + delta);
  }

  function handleRestaurarLinha(grupoId: string) {
    setVagasEditadas((prev) => {
      const next = new Map(prev);
      next.delete(grupoId);
      return next;
    });
  }

  function handleRestaurarTudo() {
    setVagasEditadas(new Map());
  }

  // Lista dos grupos que realmente foram alterados
  const listaAlterados = useMemo(() => {
    const alterados: Array<{ id: string; vagas_disponiveis: number; original: number; codigo: string }> = [];
    for (const g of grupos) {
      if (vagasEditadas.has(g.id)) {
        const novo = vagasEditadas.get(g.id)!;
        const orig = getVagasOriginais(g);
        if (novo !== orig) {
          alterados.push({
            id: g.id,
            vagas_disponiveis: novo,
            original: orig,
            codigo: g.codigo_grupo,
          });
        }
      }
    }
    return alterados;
  }, [grupos, vagasEditadas]);

  // Filtragem da lista
  const gruposFiltrados = useMemo(() => {
    return grupos.filter((g) => {
      // Filtro de texto
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const cod = (g.codigo_grupo ?? "").toLowerCase();
        const adminNome =
          typeof g.administradora === "object"
            ? g.administradora?.nome
            : g.administradora || "";
        const admin = (adminNome ?? "").toLowerCase();
        if (!cod.includes(q) && !admin.includes(q)) return false;
      }

      // Filtro de aba
      const vagasAtuais = getVagasAtuais(g);
      if (aba === "COM_VAGAS") return vagasAtuais > 0;
      if (aba === "SEM_VAGAS") return vagasAtuais === 0;
      if (aba === "ALTERADOS") return isAlterado(g);
      return true;
    });
  }, [grupos, busca, aba, vagasEditadas]);

  function handleSalvar() {
    if (listaAlterados.length === 0) return;
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const payload = listaAlterados.map((item) => ({
          id: item.id,
          vagas_disponiveis: item.vagas_disponiveis,
        }));

        const res = await atualizarVagasGruposLotePlatformAction(payload);
        if (!res.ok) {
          setErrorMessage(res.error);
          return;
        }

        setSuccessMessage(`${res.atualizados} grupo(s) tiveram suas vagas atualizadas com sucesso!`);
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 800);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Erro inesperado ao salvar alterações de vagas.",
        );
      }
    });
  }

  const totalComVagas = grupos.filter((g) => getVagasAtuais(g) > 0).length;
  const totalSemVagas = grupos.filter((g) => getVagasAtuais(g) === 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                ⚡
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Atualização Rápida de Vagas dos Grupos
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Altere as vagas de múltiplos grupos simultaneamente. Grupos com 0 vagas são exibidos
              automaticamente no site com a tag{" "}
              <strong className="text-amber-600 dark:text-amber-400">Aguardando novas vagas</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou administradora..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-2xs dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setAba("TODOS")}
              className={`rounded-md px-2.5 py-1 transition ${
                aba === "TODOS"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Todos ({grupos.length})
            </button>
            <button
              type="button"
              onClick={() => setAba("COM_VAGAS")}
              className={`rounded-md px-2.5 py-1 transition ${
                aba === "COM_VAGAS"
                  ? "bg-emerald-600 text-white"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
              }`}
            >
              Com Vagas ({totalComVagas})
            </button>
            <button
              type="button"
              onClick={() => setAba("SEM_VAGAS")}
              className={`rounded-md px-2.5 py-1 transition ${
                aba === "SEM_VAGAS"
                  ? "bg-amber-600 text-white"
                  : "text-amber-700 hover:bg-amber-50 dark:text-amber-400"
              }`}
            >
              Sem Vagas ({totalSemVagas})
            </button>
            <button
              type="button"
              onClick={() => setAba("ALTERADOS")}
              className={`rounded-md px-2.5 py-1 transition ${
                aba === "ALTERADOS"
                  ? "bg-cyan-700 text-white"
                  : "text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400"
              }`}
            >
              Alterados ({listaAlterados.length})
            </button>
          </div>
        </div>

        {/* Mensagens de Erro / Sucesso */}
        {errorMessage && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <strong>Erro:</strong> {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✓ {successMessage}
          </div>
        )}

        {/* Tabela de Grupos com Vagas */}
        <div className="flex-1 overflow-y-auto p-5">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/90">
              <tr>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-left">Administradora / Tipo</th>
                <th className="px-3 py-2 text-center">Capacidade</th>
                <th className="px-3 py-2 text-center">Vagas Atuais</th>
                <th className="px-3 py-2 text-center min-w-[240px]">Alterar Vagas</th>
                <th className="px-3 py-2 text-center">Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gruposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum grupo localizado com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                gruposFiltrados.map((g) => {
                  const orig = getVagasOriginais(g);
                  const atual = getVagasAtuais(g);
                  const alterou = isAlterado(g);
                  const diff = atual - orig;

                  const adminNome =
                    typeof g.administradora === "object"
                      ? g.administradora?.nome
                      : g.administradora || "—";
                  const tipoNome = g.tipo?.nome || g.modalidade || "—";

                  return (
                    <tr
                      key={g.id}
                      className={`transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        alterou ? "bg-cyan-500/10 dark:bg-cyan-500/15" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                        {g.codigo_grupo}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">{adminNome}</span>
                        <span className="ml-1 text-[11px] text-slate-400">({tipoNome})</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500">
                        {g.capacidade_total ? g.capacidade_total.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">
                        {orig > 0 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {orig}
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            0 (Esgotado)
                          </span>
                        )}
                      </td>

                      {/* Coluna de Alteração Rápida */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAjustarVagas(g.id, -1, orig)}
                            className="h-7 w-7 rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            title="Diminuir 1 vaga"
                          >
                            -1
                          </button>

                          <input
                            type="number"
                            min={0}
                            value={atual}
                            onChange={(e) => handleSetVagas(g.id, Number(e.target.value))}
                            className="h-7 w-16 rounded border border-slate-300 bg-white px-1 text-center font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />

                          <button
                            type="button"
                            onClick={() => handleAjustarVagas(g.id, 1, orig)}
                            className="h-7 w-7 rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            title="Aumentar 1 vaga"
                          >
                            +1
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAjustarVagas(g.id, 10, orig)}
                            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[10px] font-bold text-slate-600 shadow-2xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            title="Adicionar 10 vagas"
                          >
                            +10
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetVagas(g.id, 0)}
                            className="h-7 rounded border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                            title="Zerar vagas (marca como Aguardando novas vagas no site)"
                          >
                            Zerar
                          </button>

                          {alterou && (
                            <button
                              type="button"
                              onClick={() => handleRestaurarLinha(g.id)}
                              className="h-7 rounded border border-slate-200 bg-slate-100 px-1 text-[10px] text-slate-500 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
                              title="Desfazer alteração"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Variação */}
                      <td className="px-3 py-2.5 text-center">
                        {alterou ? (
                          diff > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              +{diff} vaga(s)
                            </span>
                          ) : diff < 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                              {diff} vaga(s)
                            </span>
                          ) : null
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            {listaAlterados.length > 0 ? (
              <>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
                  {listaAlterados.length} grupo(s) com alterações pendentes
                </span>
                <button
                  type="button"
                  onClick={handleRestaurarTudo}
                  disabled={isPending}
                  className="text-xs text-slate-500 hover:text-slate-800 underline dark:hover:text-white"
                >
                  Descartar todas as alterações
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">Nenhuma alteração pendente.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={listaAlterados.length === 0 || isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Salvando {listaAlterados.length} grupo(s)...
                </>
              ) : (
                `Salvar e Atualizar Todos (${listaAlterados.length})`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
