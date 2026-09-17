"use client";

import { useId, useMemo, useState, useTransition } from "react";
import {
  buscarResultadoFederalAction,
  createAssembleiaAction,
} from "@/app/erp/assembleias/actions";
import {
  calcularPedraPorLoteriaFederal,
  validarPrimeiroPremioFederal,
} from "@/lib/erp/assembleias";

export type GrupoFormOption = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  quantidade_cotas_sorteio?: number | null;
};

export function ErpAssembleiasForm({ grupos }: { grupos: GrupoFormOption[] }) {
  const [modo, setModo] = useState<"FEDERAL" | "MANUAL">("FEDERAL");
  const [dataAssembleia, setDataAssembleia] = useState("");
  const [numeroAssembleia, setNumeroAssembleia] = useState("");
  const [primeiroPremio, setPrimeiroPremio] = useState("");
  const [pedraManual, setPedraManual] = useState("");
  const [grupoId, setGrupoId] = useState("TODOS");
  const [observacao, setObservacao] = useState("");

  const [loadingBusca, setLoadingBusca] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const idModoFederal = useId();
  const idModoManual = useId();

  // Calcula preview instantâneo da pedra de cada grupo pela Loteria Federal
  const previewPedrasPorGrupo = useMemo(() => {
    if (modo !== "FEDERAL" || !validarPrimeiroPremioFederal(primeiroPremio)) {
      return [];
    }
    return grupos.map((g) => {
      const cotas =
        g.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
          ? Number(g.quantidade_cotas_sorteio)
          : g.modalidade?.toLowerCase().includes("imov")
          ? 999
          : 2000;
      try {
        const pedra = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
        return {
          id: g.id,
          codigo: g.codigo_grupo,
          modalidade: g.modalidade,
          cotas,
          pedra,
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as Array<{
      id: string;
      codigo: string;
      modalidade: string;
      cotas: number;
      pedra: number;
    }>;
  }, [modo, primeiroPremio, grupos]);

  async function handleBuscarFederal() {
    if (!dataAssembleia) {
      setBuscaMsg("Informe a data da assembleia/sorteio para buscar na Caixa.");
      return;
    }
    setLoadingBusca(true);
    setBuscaMsg(null);
    try {
      const res = await buscarResultadoFederalAction(dataAssembleia);
      if (res && res.encontrado && res.primeiroPremio) {
        setPrimeiroPremio(res.primeiroPremio);
        setBuscaMsg(
          `1º Prêmio oficial encontrado: ${res.primeiroPremio}${
            res.concurso ? ` (Concurso ${res.concurso})` : ""
          }`,
        );
      } else {
        setBuscaMsg(
          res?.mensagem ??
            "Resultado da Loteria Federal não encontrado para esta data. Digite o 1º prêmio manualmente.",
        );
      }
    } catch (e) {
      setBuscaMsg(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar a Caixa agora. Digite o 1º prêmio manualmente.",
      );
    } finally {
      setLoadingBusca(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (modo === "FEDERAL" && !validarPrimeiroPremioFederal(primeiroPremio)) {
      setFormError("Informe o 1º Prêmio da Loteria Federal com exatamente 5 dígitos numéricos.");
      return;
    }

    if (modo === "MANUAL" && (!pedraManual || Number(pedraManual) < 0)) {
      setFormError("Informe um número de pedra sorteada válido.");
      return;
    }

    const formData = new FormData();
    formData.set("modo", modo);
    formData.set("grupo_id", grupoId);
    formData.set("data_assembleia", dataAssembleia);
    if (numeroAssembleia) formData.set("numero_assembleia", numeroAssembleia);
    if (observacao) formData.set("observacao", observacao);

    if (modo === "FEDERAL") {
      formData.set("primeiro_premio_federal", primeiroPremio.trim());
    } else {
      formData.set("pedra_sorteada", pedraManual.trim());
    }

    startTransition(async () => {
      try {
        await createAssembleiaAction(formData);
        // Reset parcial
        setObservacao("");
        setBuscaMsg(null);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Erro ao registrar assembleia.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Registrar Assembleia / Sorteio</h2>
          <p className="text-xs text-slate-500">
            Calcule automaticamente a pedra de cada grupo pela Loteria Federal ou informe manualmente.
          </p>
        </div>

        {/* Alternância de Modo */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setModo("FEDERAL")}
            className={`rounded-md px-3 py-1.5 transition-all ${
              modo === "FEDERAL"
                ? "bg-white text-blue-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🎯 Pela Loteria Federal (Site)
          </button>
          <button
            type="button"
            onClick={() => setModo("MANUAL")}
            className={`rounded-md px-3 py-1.5 transition-all ${
              modo === "MANUAL"
                ? "bg-white text-blue-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ✍️ Pedra Manual Fixa
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Grupo */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-700">Grupo de Consórcio</label>
            <select
              name="grupo_id"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              required
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-800"
            >
              <option value="TODOS" className="font-bold text-blue-700">
                ★ Todos os grupos autorizados ({grupos.length})
              </option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  Grupo {g.codigo_grupo} · {g.modalidade}
                  {g.quantidade_cotas_sorteio ? ` (${g.quantidade_cotas_sorteio} cotas)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Data da Assembleia */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Data da Assembleia</label>
            <input
              name="data_assembleia"
              type="date"
              value={dataAssembleia}
              onChange={(e) => setDataAssembleia(e.target.value)}
              required
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          </div>

          {/* Nº Assembleia */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Nº Assembleia (opcional)</label>
            <input
              name="numero_assembleia"
              type="number"
              min="1"
              value={numeroAssembleia}
              onChange={(e) => setNumeroAssembleia(e.target.value)}
              placeholder="Ex: 55"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          </div>

          {/* Entrada da Pedra conforme Modo */}
          {modo === "FEDERAL" ? (
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>1º Prêmio Federal</span>
                {dataAssembleia && (
                  <button
                    type="button"
                    disabled={loadingBusca}
                    onClick={handleBuscarFederal}
                    className="text-[10px] font-semibold text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
                  >
                    {loadingBusca ? "Buscando…" : "Buscar Caixa"}
                  </button>
                )}
              </label>
              <input
                type="text"
                maxLength={5}
                inputMode="numeric"
                value={primeiroPremio}
                onChange={(e) => setPrimeiroPremio(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 95866"
                required={modo === "FEDERAL"}
                className="w-full rounded-lg border bg-white px-3 py-2 font-mono text-base font-bold tracking-widest text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Pedra Sorteada</label>
              <input
                type="number"
                min="0"
                value={pedraManual}
                onChange={(e) => setPedraManual(e.target.value)}
                placeholder="Ex: 466"
                required={modo === "MANUAL"}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
          )}
        </div>

        {/* Mensagem de busca Caixa */}
        {buscaMsg && (
          <p
            className={`text-xs font-semibold ${
              buscaMsg.includes("encontrado:")
                ? "text-emerald-700"
                : "text-amber-700"
            }`}
          >
            {buscaMsg}
          </p>
        )}

        {/* Preview das Pedras Calculadas por Grupo (Modo Federal) */}
        {modo === "FEDERAL" && previewPedrasPorGrupo.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-blue-900">
                🎯 Pedras Calculadas pela Loteria Federal ({primeiroPremio}):
              </p>
              <span className="text-[11px] text-blue-700">
                Fórmula: 1º Prêmio MOD Cotas do Grupo
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {previewPedrasPorGrupo.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs shadow-xs"
                >
                  <span className="font-semibold text-slate-700">
                    Grupo {p.codigo}:
                  </span>
                  <span className="rounded bg-blue-700 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                    Pedra {p.pedra}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({p.cotas} cotas)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observação e Botão */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação operacional (opcional)"
            className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-700 px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {isPending ? "Registrando…" : "Registrar assembleia"}
          </button>
        </div>

        {formError && (
          <p className="rounded-md bg-rose-50 p-2 text-xs font-bold text-rose-700">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
}
