"use client";

import { useRef, useState, useTransition } from "react";

import { fetchContemplacoesGrupoAction, fetchContemplacoesMesAction } from "@/app/erp/assembleias/actions";

import { contempladasAtivas, situacaoContemplacao } from "@/lib/erp/contemplacoes";

type GrupoOption = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora: string | null;
};

type ContemplacaoRow = {
  id: string;
  assembleia_numero: number;
  assembleia_data: string | null;
  cota: string;
  modalidade: string;
  percentual_lance: number;
  situacao_cota: string;
  criado_em?: string;
  grupo?: {
    id: string;
    codigo_grupo: string;
    modalidade: string;
    administradora: string | null;
    media_lance_1m?: number | null;
    media_lance_3m?: number | null;
  };
};

type GrupoDetalhe = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora: string | null;
  media_lance_1m?: number | null;
  media_lance_3m?: number | null;
  media_lance_6m?: number | null;
  media_lance_12m?: number | null;
  ultima_assembleia_numero?: number | null;
  ultima_assembleia_data?: string | null;
  proxima_assembleia_numero?: number | null;
  proxima_assembleia_data?: string | null;
  contemplacoes_atualizado_em?: string | null;
  historico_completo?: boolean;
  sem_assembleias_realizadas?: boolean;
  data_primeira_assembleia?: string | null;
  assembleias_faltantes?: number[];
  cotas_entregues?: number | null;
  cotas_a_entregar?: number | null;
};

export function ErpContemplacoesPanel({ grupos }: { grupos: GrupoOption[] }) {
  const [modo, setModo] = useState<"grupo" | "mes">("grupo");
  const [grupoId, setGrupoId] = useState<string>("");
  const [mesAno, setMesAno] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const requisicao = useRef(0);
  const [assembleias, setAssembleias] = useState<Array<{ assembleia_numero: number; assembleia_data: string }>>([]);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Dados do modo Grupo
  const [grupoDetalhe, setGrupoDetalhe] = useState<GrupoDetalhe | null>(null);
  const [contemplacoesGrupo, setContemplacoesGrupo] = useState<ContemplacaoRow[]>([]);

  // Dados do modo Mês
  const [gruposSemResultadoMes, setGruposSemResultadoMes] = useState<string[]>([]);
  const [contemplacoesMes, setContemplacoesMes] = useState<ContemplacaoRow[]>([]);

  function carregarPorGrupo(id: string) {
    const requestId = ++requisicao.current;
    setGrupoDetalhe(null);
    setContemplacoesGrupo([]);
    setAssembleias([]);
    if (!id) {
      setGrupoId("");
      setGrupoDetalhe(null);
      setContemplacoesGrupo([]);
      return;
    }
    setGrupoId(id);
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetchContemplacoesGrupoAction(id);
        if (requestId !== requisicao.current) return;
        setAssembleias(res.assembleias);
        setGrupoDetalhe(res.grupo as unknown as GrupoDetalhe);
        setContemplacoesGrupo((res.contemplacoes || []) as unknown as ContemplacaoRow[]);
      } catch (err: unknown) {
        if (requestId !== requisicao.current) return;
        setErro((err instanceof Error ? err.message : null) || "Erro ao carregar contemplações do grupo.");
      }
    });
  }

  function carregarPorMes(mes: string) {
    const requestId = ++requisicao.current;
    setContemplacoesMes([]);
    setMesAno(mes);
    if (!mes) return;
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetchContemplacoesMesAction(mes);
        if (requestId !== requisicao.current) return;
        setGruposSemResultadoMes(res.grupos_sem_resultado);
        setContemplacoesMes((res.contemplacoes || []) as unknown as ContemplacaoRow[]);
      } catch (err: unknown) {
        if (requestId !== requisicao.current) return;
        setErro((err instanceof Error ? err.message : null) || "Erro ao carregar contemplações do mês.");
      }
    });
  }

  // Agrupa cotas por assembleia no modo Grupo
  const assembleiasAgrupadas = contemplacoesGrupo.reduce((acc, item) => {
    const assKey = item.assembleia_numero;
    if (!acc[assKey]) {
      acc[assKey] = {
        numero: item.assembleia_numero,
        data: item.assembleia_data,
        cotas: [],
      };
    }
    acc[assKey].cotas.push(item);
    return acc;
  }, {} as Record<number, { numero: number; data: string | null; cotas: ContemplacaoRow[] }>);

  for (const ass of assembleias) {
    assembleiasAgrupadas[ass.assembleia_numero] ??= { numero: ass.assembleia_numero, data: ass.assembleia_data, cotas: [] };
  }

  // Agrupa cotas por grupo no modo Mês
  const gruposNoMesAgrupados = contemplacoesMes.reduce((acc, item) => {
    const gNome = `${item.grupo?.id || "grupo"}:${item.assembleia_numero}`;
    if (!acc[gNome]) {
      acc[gNome] = {
        grupoNome: item.grupo?.codigo_grupo || "Grupo",
        modalidade: item.grupo?.modalidade || "",
        assembleiaNumero: item.assembleia_numero,
        data: item.assembleia_data,
        cotas: [],
      };
    }
    acc[gNome].cotas.push(item);
    return acc;
  }, {} as Record<string, { grupoNome: string; modalidade: string; assembleiaNumero: number; data: string | null; cotas: ContemplacaoRow[] }>);

  const formatPct = (val?: number | null) => {
    if (val == null || isNaN(val)) return "—";
    return `${Number(val).toFixed(2).replace(".", ",")}%`;
  };

  const getModalidadeBadge = (mod: string, situacao: string) => {
    const m = (mod || "").toUpperCase();
    if (m.includes("SORTEIO") && situacao === "CANCELADA") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20">Sorteio Canceladas</span>;
    }
    if (m.includes("SORTEIO")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">Sorteio</span>;
    }
    if (m.includes("FIXO")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-700 border border-purple-500/20">{m.includes("SEGUNDO") ? "2º Lance Fixo" : "Lance Fixo"}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/20">{m === "LANCE_LIVRE" ? "Lance Livre" : m === "LANCE_FIDELIDADE" ? "Lance Fidelidade" : m === "LANCE_LIMITADO" ? "Lance Limitado" : mod}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Modo de Visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Consulta de Contemplações & Médias de Lance</h2>
          <p className="text-xs text-slate-600">
            Histórico apurado pelo robô com cotas sorteadas, lances vencedores e médias móveis (1m, 3m, 6m, 12m).
          </p>
        </div>

        <div className="flex items-center bg-slate-50 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setModo("grupo");
              if (grupoId) carregarPorGrupo(grupoId);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              modo === "grupo"
                ? "bg-blue-100 text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            🏷️ Por Grupo
          </button>
          <button
            type="button"
            onClick={() => {
              setModo("mes");
              carregarPorMes(mesAno);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              modo === "mes"
                ? "bg-blue-100 text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            📅 Por Mês / Competência
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {erro}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 1: CONSULTA POR GRUPO                                                */}
      {/* ========================================================================= */}
      {modo === "grupo" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Selecione o Grupo:
            </label>
            <select
              value={grupoId}
              onChange={(e) => carregarPorGrupo(e.target.value)}
              className="w-full sm:w-96 px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Escolha um grupo para ver o histórico --</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.codigo_grupo} · {g.modalidade} {g.administradora ? `(${g.administradora})` : ""}
                </option>
              ))}
            </select>
            {isPending && <span className="text-xs text-slate-600 animate-pulse">Carregando dados...</span>}
          </div>

          {grupoDetalhe && (
            <div className="space-y-6">
              <div className="text-xs text-slate-700">Médias calculadas somente com lances livres confirmados de cotas ativas. Fixos, sorteios, canceladas e desclassificadas ficam fora da média.</div>
              {!grupoDetalhe.historico_completo && <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">Histórico verificado incompleto. {grupoDetalhe.assembleias_faltantes?.length || 0} assembleia(s) aguardam importação. Totais de entregues e a entregar ficam indisponíveis até a conferência completa desde a assembleia 1.</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-white border border-slate-200"><div className="text-sm text-slate-700">Cotas entregues</div><div className="text-2xl font-bold text-emerald-700">{grupoDetalhe.cotas_entregues ?? "—"}</div><div className="text-xs text-slate-600">Ativas já contempladas por sorteio ou lance</div></div>
                <div className="p-4 rounded-xl bg-white border border-slate-200"><div className="text-sm text-slate-700">Cotas a entregar</div><div className="text-2xl font-bold text-blue-700">{grupoDetalhe.cotas_a_entregar ?? "—"}</div><div className="text-xs text-slate-600">Cotas ativas menos entregues</div></div>
              </div>
              {/* Cards de Médias de Lance e Status */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Média 1 Mês (Último)</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {formatPct(grupoDetalhe.media_lance_1m)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Última assembleia</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Média 3 Meses</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {formatPct(grupoDetalhe.media_lance_3m)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Últimas 3 assembleias</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Média 6 Meses</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {formatPct(grupoDetalhe.media_lance_6m)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Últimas 6 assembleias</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Média 12 Meses</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {formatPct(grupoDetalhe.media_lance_12m)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Últimas 12 assembleias</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Última Assembleia</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    Nº {grupoDetalhe.ultima_assembleia_numero || "—"}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {grupoDetalhe.ultima_assembleia_data
                      ? new Date(grupoDetalhe.ultima_assembleia_data + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Sem data"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-600">Próxima Assembleia</div>
                  <div className="text-base font-bold text-blue-700 mt-1">
                    {grupoDetalhe.proxima_assembleia_numero ? `Nº ${grupoDetalhe.proxima_assembleia_numero}` : "—"}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {grupoDetalhe.proxima_assembleia_data
                      ? new Date(grupoDetalhe.proxima_assembleia_data + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Aguardando"}
                  </div>
                </div>
              </div>

              {/* Tabela de Assembleias e Cotas Contempladas */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Histórico de Assembleias e Resultados
                  </h3>
                  <span className="text-xs text-slate-600">
                    Total: {Object.keys(assembleiasAgrupadas).length} assembleias mapeadas ({contemplacoesGrupo.length} registros)
                  </span>
                </div>

                {Object.keys(assembleiasAgrupadas).length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {grupoDetalhe.sem_assembleias_realizadas ? `O portal confirma que ainda não houve assembleia. ${grupoDetalhe.data_primeira_assembleia ? "Primeira assembleia: " + new Date(grupoDetalhe.data_primeira_assembleia + "T12:00:00").toLocaleDateString("pt-BR") : ""}` : "Nenhuma assembleia verificada para este grupo ainda. Execute o Robô 2 para importar o histórico retroativo."}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {Object.values(assembleiasAgrupadas)
                      .sort((a, b) => b.numero - a.numero)
                      .map((ass) => (
                        <div key={ass.numero} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">
                                Assembleia Nº {ass.numero}
                              </span>
                              {ass.data && (
                                <span className="text-xs text-slate-600">
                                  · {new Date(ass.data + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-600">
                              {contempladasAtivas(ass.cotas)} contemplada(s) ativa(s) · {ass.cotas.filter(c => c.situacao_cota === "CANCELADA").length} cancelada(s) · {ass.cotas.filter(c => c.situacao_cota === "DESCLASSIFICADA").length} desclassificada(s)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {ass.cotas.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-mono font-semibold text-slate-800">
                                    Cota {c.cota}
                                  </div>
                                  <div>{getModalidadeBadge(c.modalidade, c.situacao_cota)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-900">
                                    {c.modalidade.includes("SORTEIO") ? "Sorteio" : c.percentual_lance > 0 ? `${c.percentual_lance.toFixed(4).replace(".", ",")}%` : "—"}
                                  </div>
                                  <span className={`text-[10px] ${c.situacao_cota === "DESCLASSIFICADA" ? "text-red-700" : c.situacao_cota === "CANCELADA" ? "text-amber-800" : "text-emerald-700"}`}>
                                    {situacaoContemplacao(c)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: CONSULTA POR MÊS / COMPETÊNCIA                                   */}
      {/* ========================================================================= */}
      {modo === "mes" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Selecione o Mês da Assembleia:
            </label>
            <input
              type="month"
              value={mesAno}
              onChange={(e) => carregarPorMes(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {isPending && <span className="text-xs text-slate-600 animate-pulse">Carregando dados...</span>}
          </div>

          {gruposSemResultadoMes.length > 0 && <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">{gruposSemResultadoMes.length} grupo(s) sem resultado verificado nesta competência. O total abaixo considera somente o histórico conferido.</div>}
          <div className="p-4 rounded-xl bg-white border border-slate-200"><div className="text-sm text-slate-700">Contempladas ativas no mês (verificadas)</div><div className="text-2xl font-bold text-emerald-700">{Object.values(gruposNoMesAgrupados).reduce((s, g) => s + contempladasAtivas(g.cotas), 0)}</div><div className="text-xs text-slate-600">Canceladas e desclassificadas excluídas</div></div>
          <div className="space-y-4">
            {Object.keys(gruposNoMesAgrupados).length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-200 bg-white">
                Nenhuma assembleia ou contemplação registrada no mês {mesAno}.
              </div>
            ) : (
              Object.values(gruposNoMesAgrupados).map((item) => (
                <div key={item.grupoNome} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{item.grupoNome}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-slate-700">
                        {item.modalidade}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Assembleia Nº {item.assembleiaNumero} {item.data ? `· ${new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}` : ""} · {contempladasAtivas(item.cotas)} contempladas ativas
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {item.cotas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-slate-800">Cota {c.cota}</div>
                          <div>{getModalidadeBadge(c.modalidade, c.situacao_cota)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">
                            {c.modalidade.includes("SORTEIO") ? "Sorteio" : c.percentual_lance > 0 ? `${c.percentual_lance.toFixed(4).replace(".", ",")}%` : "—"}
                          </div>
                          <span className={`text-[10px] ${c.situacao_cota === "DESCLASSIFICADA" ? "text-red-700" : c.situacao_cota === "CANCELADA" ? "text-amber-800" : "text-emerald-700"}`}>
                            {situacaoContemplacao(c)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
