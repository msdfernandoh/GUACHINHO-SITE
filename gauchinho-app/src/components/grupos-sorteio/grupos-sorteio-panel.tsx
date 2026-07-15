"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, Select, surfaceInputDark } from "@/components/ui/form-primitives";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";
import {
  calcularPalavraChave,
  validarPrimeiroPremio,
  validarQuantidadeCotas,
} from "@/lib/grupos-sorteio/calcular-palavra-chave";
import { formatPeriodoBr } from "@/lib/grupos-sorteio/periodo";

export type GrupoSorteioOption = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  quantidade_cotas_sorteio: number | null;
};

export type SorteioHistoricoRow = {
  id: string;
  grupo_id: string;
  ano: number;
  mes: number;
  primeiro_premio: string;
  quantidade_cotas: number;
  palavra_chave: number;
  grupo?: { codigo_grupo: string; modalidade: string } | null;
};

type Props = {
  grupos: GrupoSorteioOption[];
  canManage: boolean;
  variant?: "public" | "admin";
  onSalvar?: (payload: {
    grupoId: string;
    periodo: string;
    primeiroPremio: string;
    quantidadeCotas: number;
    dataSorteio: string | null;
    fonteResultado: string | null;
    buscadoAutomaticamente: boolean;
    atualizarSeExistir: boolean;
  }) => Promise<void>;
  onSalvarTodos?: (payload: {
    periodo: string;
    primeiroPremio: string;
    dataSorteio: string | null;
    fonteResultado: string | null;
    buscadoAutomaticamente: boolean;
    atualizarSeExistir: boolean;
  }) => Promise<{ salvos: number }>;
};

function defaultPeriodo(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function GruposSorteioPanel({
  grupos,
  canManage,
  variant = "public",
  onSalvar,
  onSalvarTodos,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [grupoId, setGrupoId] = useState("");
  const [primeiroPremio, setPrimeiroPremio] = useState("");
  const [dataSorteio, setDataSorteio] = useState("");
  const [quantidadeCotas, setQuantidadeCotas] = useState("");
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [buscadoAuto, setBuscadoAuto] = useState(false);
  const [fonteResultado, setFonteResultado] = useState<string | null>(null);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [modoTodos, setModoTodos] = useState(false);

  const [histAno, setHistAno] = useState("");
  const [histMes, setHistMes] = useState("");
  const [histGrupo, setHistGrupo] = useState("");
  const [historico, setHistorico] = useState<SorteioHistoricoRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useLockBodyScroll(modalOpen);

  const grupoSel = useMemo(
    () => grupos.find((g) => g.id === grupoId) ?? null,
    [grupos, grupoId],
  );

  const cotasNum = useMemo(() => {
    const n = Number(quantidadeCotas);
    return Number.isFinite(n) ? n : NaN;
  }, [quantidadeCotas]);

  const cotaCalculada = useMemo(() => {
    if (!validarPrimeiroPremio(primeiroPremio) || !validarQuantidadeCotas(cotasNum)) {
      return null;
    }
    try {
      return calcularPalavraChave(primeiroPremio, cotasNum);
    } catch {
      return null;
    }
  }, [primeiroPremio, cotasNum]);

  const premioErro = useMemo(() => {
    if (!primeiroPremio) return null;
    if (!validarPrimeiroPremio(primeiroPremio)) {
      return "Informe exatamente 5 dígitos (zeros à esquerda são válidos).";
    }
    return null;
  }, [primeiroPremio]);

  const cotasErro = useMemo(() => {
    if (!quantidadeCotas) return null;
    if (!validarQuantidadeCotas(cotasNum)) {
      return "Quantidade de cotas deve ser inteiro maior que zero.";
    }
    return null;
  }, [quantidadeCotas, cotasNum]);

  const semCotasCadastro = grupoSel && grupoSel.quantidade_cotas_sorteio == null;

  useEffect(() => {
    if (!grupoId) return;
    const g = grupos.find((x) => x.id === grupoId);
    if (g?.quantidade_cotas_sorteio != null) {
      setQuantidadeCotas(String(g.quantidade_cotas_sorteio));
    }
  }, [grupoId, grupos]);

  const loadHistorico = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams();
      if (histAno) params.set("ano", histAno);
      if (histMes) params.set("mes", histMes);
      if (histGrupo) params.set("grupoId", histGrupo);
      const res = await fetch(`/api/public/grupos/sorteios?${params}`);
      const json = await res.json();
      setHistorico(json.rows ?? []);
    } catch {
      setHistorico([]);
    } finally {
      setHistLoading(false);
    }
  }, [histAno, histMes, histGrupo]);

  useEffect(() => {
    void loadHistorico();
  }, [loadHistorico]);

  function onPrimeiroPremioChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 5);
    setPrimeiroPremio(digits);
    setBuscadoAuto(false);
    setFonteResultado(null);
  }

  async function buscarPremio() {
    if (!canManage) return;
    if (!dataSorteio) {
      setBuscaMsg("Informe a data do sorteio.");
      return;
    }
    setLoadingBusca(true);
    setBuscaMsg(null);
    try {
      const res = await fetch(
        `/api/admin/grupos/sorteios/buscar-federal?data=${encodeURIComponent(dataSorteio)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setBuscaMsg(json.error ?? "Não foi possível consultar o resultado agora.");
        return;
      }
      if (!json.encontrado || !json.primeiroPremio) {
        setBuscaMsg(
          json.mensagem ??
            "Não encontramos resultado da Loteria Federal para esta data.",
        );
        return;
      }
      setPrimeiroPremio(String(json.primeiroPremio));
      setBuscadoAuto(true);
      setFonteResultado(json.fonte ?? null);
      if (json.concurso) {
        setBuscaMsg(`Concurso ${json.concurso} encontrado na ${json.fonte ?? "fonte oficial"}.`);
      } else {
        setBuscaMsg(null);
      }
    } catch {
      setBuscaMsg(
        "Não foi possível consultar o resultado agora. Informe o 1º prêmio manualmente.",
      );
    } finally {
      setLoadingBusca(false);
    }
  }

  async function salvar(atualizarSeExistir: boolean) {
    if (!canManage || !onSalvar) return;
    setSaveMsg(null);
    setLoadingSave(true);
    try {
      if (!modoTodos) {
        if (!grupoId) throw new Error("Selecione um grupo.");
        if (semCotasCadastro) {
          throw new Error(
            "Este grupo ainda não possui quantidade de cotas para sorteio cadastrada.",
          );
        }
        await onSalvar({
          grupoId,
          periodo,
          primeiroPremio,
          quantidadeCotas: cotasNum,
          dataSorteio: dataSorteio || null,
          fonteResultado,
          buscadoAutomaticamente: buscadoAuto,
          atualizarSeExistir,
        });
      } else if (onSalvarTodos) {
        const r = await onSalvarTodos({
          periodo,
          primeiroPremio,
          dataSorteio: dataSorteio || null,
          fonteResultado,
          buscadoAutomaticamente: buscadoAuto,
          atualizarSeExistir,
        });
        setSaveMsg(`Sorteios salvos para ${r.salvos} grupo(s).`);
        await loadHistorico();
        setLoadingSave(false);
        return;
      }
      setSaveMsg("Sorteio do mês salvo com sucesso.");
      await loadHistorico();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoadingSave(false);
    }
  }

  const previewTodos = useMemo(() => {
    if (!modoTodos || !validarPrimeiroPremio(primeiroPremio)) return [];
    return grupos
      .filter((g) => g.quantidade_cotas_sorteio != null)
      .map((g) => ({
        id: g.id,
        codigo: g.codigo_grupo,
        cotas: g.quantidade_cotas_sorteio!,
        palavra:
          validarQuantidadeCotas(g.quantidade_cotas_sorteio!) &&
          calcularPalavraChave(primeiroPremio, g.quantidade_cotas_sorteio!),
      }));
  }, [modoTodos, primeiroPremio, grupos]);

  const isDark = variant === "public";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isDark ? "outline" : "default"}
          className={cn(
            isDark &&
              "border-amber-500/60 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300",
          )}
          onClick={() => {
            setModalOpen(true);
            setSaveMsg(null);
          }}
        >
          Sorteio
        </Button>
        {canManage ? (
          <span className="text-xs text-zinc-500">
            Staff: calcule e salve resultados pela Loteria Federal.
          </span>
        ) : null}
      </div>

      <section
        className={cn(
          "rounded-xl border p-4",
          isDark
            ? "border-zinc-800 bg-zinc-900/40"
            : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/90",
        )}
      >
        <h2 className="text-lg font-semibold text-amber-500/90 dark:text-amber-400">
          Histórico de sorteios
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <div>
            <Label className={isDark ? "text-zinc-400" : undefined}>Ano</Label>
            <Input
              className={cn("mt-1 w-24", isDark && surfaceInputDark)}
              placeholder="2026"
              value={histAno}
              onChange={(e) => setHistAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div>
            <Label className={isDark ? "text-zinc-400" : undefined}>Mês</Label>
            <Input
              className={cn("mt-1 w-20", isDark && surfaceInputDark)}
              placeholder="07"
              value={histMes}
              onChange={(e) => setHistMes(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <Label className={isDark ? "text-zinc-400" : undefined}>Grupo</Label>
            <Select
              className={cn("mt-1 w-full", isDark && surfaceInputDark)}
              value={histGrupo}
              onChange={(e) => setHistGrupo(e.target.value)}
            >
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.codigo_grupo} — {g.modalidade}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" size="sm" className="self-end" onClick={() => void loadHistorico()}>
            Atualizar
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-2 py-2">Período</th>
                <th className="px-2 py-2">Grupo</th>
                <th className="px-2 py-2">1º Prêmio</th>
                <th className="px-2 py-2">Cotas</th>
                <th className="px-2 py-2">Cota sorteada</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-zinc-500">
                    Carregando…
                  </td>
                </tr>
              ) : historico.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-zinc-500">
                    Nenhum sorteio encontrado para os filtros.
                  </td>
                </tr>
              ) : (
                historico.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800/60">
                    <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                      {formatPeriodoBr(row.ano, row.mes)}
                    </td>
                    <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                      {row.grupo?.codigo_grupo ?? "—"}
                      {row.grupo?.modalidade ? (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {" "}
                          · {row.grupo.modalidade}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 font-mono text-zinc-800 dark:text-zinc-200">
                      {row.primeiro_premio}
                    </td>
                    <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                      {row.quantidade_cotas}
                    </td>
                    <td className="px-2 py-2 font-semibold text-amber-600 dark:text-amber-400">
                      {row.palavra_chave}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div
            className={cn(
              "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl",
              isDark ? "border-zinc-700 bg-zinc-950" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
            )}
          >
            <h2 className="text-xl font-bold text-amber-400">Sorteio pela Loteria Federal</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Informe o 1º Prêmio da Loteria Federal para calcular a palavra-chave do grupo.
            </p>

            {canManage ? (
              <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={modoTodos}
                  onChange={(e) => setModoTodos(e.target.checked)}
                />
                Calcular para todos os grupos
              </label>
            ) : null}

            <div className="mt-4 space-y-3">
              <div>
                <Label>Período</Label>
                <Input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className={cn(isDark && surfaceInputDark)}
                />
              </div>
              {!modoTodos ? (
                <div>
                  <Label>Grupo</Label>
                  <Select
                    value={grupoId}
                    onChange={(e) => setGrupoId(e.target.value)}
                    className={cn("w-full", isDark && surfaceInputDark)}
                  >
                    <option value="">Selecione…</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.codigo_grupo} — {g.modalidade}
                      </option>
                    ))}
                  </Select>
                  {semCotasCadastro ? (
                    <p className="mt-2 text-sm text-amber-500/90">
                      Este grupo ainda não possui quantidade de cotas para sorteio cadastrada.
                      Atualize o cadastro do grupo no admin.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canManage ? (
                <div>
                  <Label>Data do sorteio</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      type="date"
                      value={dataSorteio}
                      onChange={(e) => setDataSorteio(e.target.value)}
                      className={cn("flex-1", isDark && surfaceInputDark)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loadingBusca}
                      onClick={() => void buscarPremio()}
                    >
                      {loadingBusca ? "Buscando…" : "Buscar 1º prêmio"}
                    </Button>
                  </div>
                  {buscaMsg ? <p className="mt-1 text-sm text-amber-500/90">{buscaMsg}</p> : null}
                </div>
              ) : null}
              <div>
                <Label>1º Prêmio da Loteria Federal</Label>
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  value={primeiroPremio}
                  onChange={(e) => onPrimeiroPremioChange(e.target.value)}
                  placeholder="95866"
                  className={cn("font-mono tracking-widest", isDark && surfaceInputDark)}
                />
                {premioErro ? <p className="mt-1 text-sm text-red-400">{premioErro}</p> : null}
              </div>
              {!modoTodos ? (
                <div>
                  <Label>Quantidade de cotas</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={quantidadeCotas}
                    onChange={(e) => setQuantidadeCotas(e.target.value)}
                    className={cn(isDark && surfaceInputDark)}
                  />
                  {cotasErro ? <p className="mt-1 text-sm text-red-400">{cotasErro}</p> : null}
                </div>
              ) : null}

              {cotaCalculada != null && !modoTodos ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm text-zinc-400">Cota sorteada no mês</p>
                  <p className="text-3xl font-bold text-amber-400">{cotaCalculada}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Resultado calculado pelo resto da divisão do 1º Prêmio pela quantidade de
                    cotas do grupo.
                  </p>
                </div>
              ) : null}

              {modoTodos && previewTodos.length > 0 ? (
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-700">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="px-2 py-1">Grupo</th>
                        <th className="px-2 py-1">Cotas</th>
                        <th className="px-2 py-1">Palavra-chave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewTodos.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-800">
                          <td className="px-2 py-1">{p.codigo}</td>
                          <td className="px-2 py-1">{p.cotas}</td>
                          <td className="px-2 py-1 font-semibold text-amber-400">{p.palavra}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {modoTodos && grupos.some((g) => g.quantidade_cotas_sorteio == null) ? (
                <p className="text-xs text-zinc-500">
                  Grupos sem quantidade de cotas cadastrada ficam pendentes e não entram no lote.
                </p>
              ) : null}

              {saveMsg ? (
                <p
                  className={cn(
                    "text-sm",
                    saveMsg.includes("sucesso") || saveMsg.includes("salvos")
                      ? "text-emerald-400"
                      : "text-red-400",
                  )}
                >
                  {saveMsg}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Fechar
              </Button>
              {canManage ? (
                <>
                  <Button
                    type="button"
                    disabled={
                      loadingSave ||
                      (!modoTodos && cotaCalculada == null) ||
                      (modoTodos && !validarPrimeiroPremio(primeiroPremio))
                    }
                    onClick={() => void salvar(false)}
                  >
                    Salvar sorteio do mês
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingSave}
                    onClick={() => void salvar(true)}
                  >
                    Atualizar se já existir
                  </Button>
                </>
              ) : (
                <p className="text-xs text-zinc-500 self-center">
                  Apenas consulta: cadastro de sorteios é feito pela equipe autorizada.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
