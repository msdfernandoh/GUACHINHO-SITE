"use client";

import { useState, useTransition } from "react";

import { fetchContemplacoesGrupoAction, fetchContemplacoesMesAction } from "@/app/erp/assembleias/actions";

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
  contemplacoes_resumo?: any;
};

export function ErpContemplacoesPanel({ grupos }: { grupos: GrupoOption[] }) {
  const [modo, setModo] = useState<"grupo" | "mes">("grupo");
  const [grupoId, setGrupoId] = useState<string>("");
  const [mesAno, setMesAno] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Dados do modo Grupo
  const [grupoDetalhe, setGrupoDetalhe] = useState<GrupoDetalhe | null>(null);
  const [contemplacoesGrupo, setContemplacoesGrupo] = useState<ContemplacaoRow[]>([]);

  // Dados do modo Mês
  const [contemplacoesMes, setContemplacoesMes] = useState<ContemplacaoRow[]>([]);

  function carregarPorGrupo(id: string) {
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
        setGrupoDetalhe(res.grupo as unknown as GrupoDetalhe);
        setContemplacoesGrupo((res.contemplacoes || []) as unknown as ContemplacaoRow[]);
      } catch (err: any) {
        setErro(err.message || "Erro ao carregar contemplações do grupo.");
      }
    });
  }

  function carregarPorMes(mes: string) {
    setMesAno(mes);
    if (!mes) return;
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetchContemplacoesMesAction(mes);
        setContemplacoesMes((res || []) as unknown as ContemplacaoRow[]);
      } catch (err: any) {
        setErro(err.message || "Erro ao carregar contemplações do mês.");
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

  // Agrupa cotas por grupo no modo Mês
  const gruposNoMesAgrupados = contemplacoesMes.reduce((acc, item) => {
    const gNome = item.grupo?.codigo_grupo || "Grupo";
    if (!acc[gNome]) {
      acc[gNome] = {
        grupoNome: gNome,
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

  const getModalidadeBadge = (mod: string) => {
    const m = (mod || "").toUpperCase();
    if (m.includes("SORTEIO") && m.includes("CANCEL")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">Sorteio Canceladas</span>;
    }
    if (m.includes("SORTEIO")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Sorteio</span>;
    }
    if (m.includes("FIXO")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Lance Fixo</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Lance Livre</span>;
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Modo de Visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Consulta de Contemplações & Médias de Lance</h2>
          <p className="text-xs text-zinc-400">
            Histórico apurado pelo robô com cotas sorteadas, lances vencedores e médias móveis (1m, 3m, 6m, 12m).
          </p>
        </div>

        <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setModo("grupo");
              if (grupoId) carregarPorGrupo(grupoId);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              modo === "grupo"
                ? "bg-zinc-800 text-zinc-100 shadow"
                : "text-zinc-400 hover:text-zinc-200"
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
                ? "bg-zinc-800 text-zinc-100 shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            📅 Por Mês / Competência
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm">
          {erro}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 1: CONSULTA POR GRUPO                                                */}
      {/* ========================================================================= */}
      {modo === "grupo" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label className="text-sm font-medium text-zinc-300 whitespace-nowrap">
              Selecione o Grupo:
            </label>
            <select
              value={grupoId}
              onChange={(e) => carregarPorGrupo(e.target.value)}
              className="w-full sm:w-96 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Escolha um grupo para ver o histórico --</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.codigo_grupo} · {g.modalidade} {g.administradora ? `(${g.administradora})` : ""}
                </option>
              ))}
            </select>
            {isPending && <span className="text-xs text-zinc-400 animate-pulse">Carregando dados...</span>}
          </div>

          {grupoDetalhe && (
            <div className="space-y-6">
              {/* Cards de Médias de Lance e Status */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Média 1 Mês (Último)</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatPct(grupoDetalhe.media_lance_1m)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Última assembleia</div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Média 3 Meses</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatPct(grupoDetalhe.media_lance_3m)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Últimos 90 dias</div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Média 6 Meses</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatPct(grupoDetalhe.media_lance_6m)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Últimos 180 dias</div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Média 12 Meses</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatPct(grupoDetalhe.media_lance_12m)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Último ano</div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Última Assembleia</div>
                  <div className="text-base font-bold text-zinc-100 mt-1">
                    Nº {grupoDetalhe.ultima_assembleia_numero || "—"}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {grupoDetalhe.ultima_assembleia_data
                      ? new Date(grupoDetalhe.ultima_assembleia_data + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Sem data"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-400">Próxima Assembleia</div>
                  <div className="text-base font-bold text-blue-400 mt-1">
                    {grupoDetalhe.proxima_assembleia_numero ? `Nº ${grupoDetalhe.proxima_assembleia_numero}` : "—"}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {grupoDetalhe.proxima_assembleia_data
                      ? new Date(grupoDetalhe.proxima_assembleia_data + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Aguardando"}
                  </div>
                </div>
              </div>

              {/* Tabela de Assembleias e Cotas Contempladas */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Histórico Completo de Assembleias & Cotas Contempladas
                  </h3>
                  <span className="text-xs text-zinc-400">
                    Total: {Object.keys(assembleiasAgrupadas).length} assembleias mapeadas ({contemplacoesGrupo.length} cotas)
                  </span>
                </div>

                {Object.keys(assembleiasAgrupadas).length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    Nenhuma contemplação gravada para este grupo ainda. Execute o Robô 2 para importar o histórico retroativo.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/80">
                    {Object.values(assembleiasAgrupadas)
                      .sort((a, b) => b.numero - a.numero)
                      .map((ass) => (
                        <div key={ass.numero} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-zinc-100">
                                Assembleia Nº {ass.numero}
                              </span>
                              {ass.data && (
                                <span className="text-xs text-zinc-400">
                                  · {new Date(ass.data + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-400">
                              {ass.cotas.length} cota(s) contemplada(s)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {ass.cotas.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-mono font-semibold text-zinc-200">
                                    Cota {c.cota}
                                  </div>
                                  <div>{getModalidadeBadge(c.modalidade)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-zinc-100">
                                    {c.percentual_lance > 0 ? `${c.percentual_lance.toFixed(4).replace(".", ",")}%` : "Sorteio"}
                                  </div>
                                  <span className={`text-[10px] ${c.situacao_cota === "CANCELADA" ? "text-amber-400" : "text-emerald-400"}`}>
                                    {c.situacao_cota}
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
            <label className="text-sm font-medium text-zinc-300 whitespace-nowrap">
              Selecione o Mês da Assembleia:
            </label>
            <input
              type="month"
              value={mesAno}
              onChange={(e) => carregarPorMes(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {isPending && <span className="text-xs text-zinc-400 animate-pulse">Carregando dados...</span>}
          </div>

          <div className="space-y-4">
            {Object.keys(gruposNoMesAgrupados).length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500 rounded-xl border border-zinc-800 bg-zinc-950/60">
                Nenhuma assembleia ou contemplação registrada no mês {mesAno}.
              </div>
            ) : (
              Object.values(gruposNoMesAgrupados).map((item) => (
                <div key={item.grupoNome} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-zinc-100">{item.grupoNome}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {item.modalidade}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Assembleia Nº {item.assembleiaNumero} {item.data ? `· ${new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}` : ""} · {item.cotas.length} contempladas
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {item.cotas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-zinc-200">Cota {c.cota}</div>
                          <div>{getModalidadeBadge(c.modalidade)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-zinc-100">
                            {c.percentual_lance > 0 ? `${c.percentual_lance.toFixed(4).replace(".", ",")}%` : "Sorteio"}
                          </div>
                          <span className={`text-[10px] ${c.situacao_cota === "CANCELADA" ? "text-amber-400" : "text-emerald-400"}`}>
                            {c.situacao_cota}
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
