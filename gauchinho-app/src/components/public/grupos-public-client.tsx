"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { PublicGrupoAggregate } from "@/lib/types";
import { MODALIDADE_FILTRO_PUBLICO } from "@/lib/types";
import {
  agregarResultadosLinhas,
  calcularLinhaSimulacaoGrupo,
  defaultConfigLinha,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import {
  GrupoLinhaDesktopRow,
  GrupoPrazoCell,
  GrupoSimulacaoLinhaControls,
} from "@/components/public/grupos-linha-controls";

type ModalFiltro = (typeof MODALIDADE_FILTRO_PUBLICO)[number];

export type SelecaoGrupoPayload = {
  grupoId: string;
  cotaId: string;
  config: ConfigLinhaSimulacaoGrupo;
  resultado: ReturnType<typeof calcularLinhaSimulacaoGrupo>;
};

export function GruposPublicClient({
  aggregates,
  isStaff = false,
}: {
  aggregates: PublicGrupoAggregate[];
  isStaff?: boolean;
}) {
  const [filtro, setFiltro] = useState<ModalFiltro>("Todos");
  const [busca, setBusca] = useState("");
  const [configs, setConfigs] = useState<Record<string, ConfigLinhaSimulacaoGrupo>>(() => {
    const init: Record<string, ConfigLinhaSimulacaoGrupo> = {};
    aggregates.forEach(({ grupo, cotas, modalidades }) => {
      init[grupo.id] = defaultConfigLinha(grupo, cotas, modalidades);
    });
    return init;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAcao, setModalAcao] = useState<"simulacao" | "proposta" | "especialista">("simulacao");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return aggregates.filter(({ grupo, cotas }) => {
      if (!cotas.length) return false;
      if (filtro !== "Todos" && grupo.modalidade !== filtro) return false;
      if (!q) return true;
      return (
        grupo.codigo_grupo.toLowerCase().includes(q) ||
        cotas.some((c) => String(c.valor_credito).includes(q.replace(",", ".")))
      );
    });
  }, [aggregates, filtro, busca]);

  const linhasAtivas = useMemo(() => {
    const out: SelecaoGrupoPayload[] = [];
    aggregates.forEach(({ grupo, cotas, modalidades }) => {
      const config = configs[grupo.id];
      if (!config) return;
      const cota = cotas.find((c) => c.id === config.cotaId);
      const resultado = calcularLinhaSimulacaoGrupo({
        grupo,
        cota: cota ?? null,
        config,
        modalidades,
      });
      if (resultado.ativo && cota) {
        out.push({ grupoId: grupo.id, cotaId: cota.id, config, resultado });
      }
    });
    return out;
  }, [aggregates, configs]);

  const totais = useMemo(
    () => agregarResultadosLinhas(linhasAtivas.map((l) => l.resultado)),
    [linhasAtivas],
  );

  const hasSelection = linhasAtivas.length > 0;

  function setConfig(grupoId: string, config: ConfigLinhaSimulacaoGrupo) {
    setConfigs((prev) => ({ ...prev, [grupoId]: config }));
  }

  function openModal(acao: typeof modalAcao) {
    if (!hasSelection) {
      if (acao === "simulacao") {
        setToastMsg("Informe cota e quantidade (mín. 1) em ao menos um grupo.");
      }
      return;
    }
    setModalAcao(acao);
    setModalOpen(true);
    setResultMsg(null);
    setPdfLink(null);
    setToastMsg(null);
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResultMsg(null);
    setPdfLink(null);
    try {
      const res = await fetch("/api/public/grupos/fluxo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          acao: modalAcao,
          selecoes: linhasAtivas.map((s) => ({
            grupoId: s.grupoId,
            cotaId: s.cotaId,
            config: s.config,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      const pdfHref = (data.pdfPath as string) ?? (data.pdfDownloadUrl as string) ?? null;
      setPdfLink(pdfHref);
      setResultMsg(
        modalAcao === "proposta"
          ? `Proposta criada. Crédito líquido: ${formatCurrency(data.creditoLiquido)}`
          : `Simulação salva. Crédito líquido: ${formatCurrency(data.creditoLiquido)}`,
      );
      setModalOpen(false);
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 text-sm text-amber-400">
            <Sparkles className="h-4 w-4" /> Simulador premium
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Nossos Grupos
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
            Monte sua simulação por grupo: escolha o crédito, quantidade de cotas e estratégia de
            lance — como na planilha, com visual profissional.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          {MODALIDADE_FILTRO_PUBLICO.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFiltro(m)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                filtro === m
                  ? "bg-amber-500 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:border-amber-500/50",
              )}
            >
              {m}
            </button>
          ))}
          <div className="relative ml-auto min-w-[240px] flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              className="border-zinc-700 bg-zinc-900 pl-9 text-zinc-100"
              placeholder="Buscar por crédito ou grupo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {aggregates.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-16 text-center">
            <p className="text-lg text-zinc-300">Nenhum grupo disponível no momento.</p>
            {isStaff ? (
              <p className="mt-4 text-sm text-amber-400/90">
                <Link href="/admin/grupos" className="underline hover:text-amber-300">
                  Cadastre grupos no admin
                </Link>
              </p>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 px-6 py-12 text-center text-zinc-400">
            Nenhum resultado para os filtros atuais.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 lg:block">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-3">Grupo</th>
                    <th className="min-w-[320px] px-3 py-3">Montagem</th>
                    <th className="px-3 py-3" title="Total / restante / realizadas">
                      Prazo (T / R / Real.)
                    </th>
                    <th className="px-3 py-3">Saldo final</th>
                    <th className="px-3 py-3">Pós-contempl.</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ grupo, cotas, modalidades }) => {
                    const config =
                      configs[grupo.id] ?? defaultConfigLinha(grupo, cotas, modalidades);
                    return (
                      <GrupoLinhaDesktopRow
                        key={grupo.id}
                        grupo={grupo}
                        cotas={cotas}
                        modalidades={modalidades}
                        config={config}
                        onChange={(c) => setConfig(grupo.id, c)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 lg:hidden">
              {filtered.map(({ grupo, cotas, modalidades }) => {
                const config =
                  configs[grupo.id] ?? defaultConfigLinha(grupo, cotas, modalidades);
                const resultado = calcularLinhaSimulacaoGrupo({
                  grupo,
                  cota: cotas.find((c) => c.id === config.cotaId) ?? null,
                  config,
                  modalidades,
                });
                return (
                  <details
                    key={grupo.id}
                    className={cn(
                      "rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4",
                      resultado.ativo && "border-amber-500/40",
                    )}
                    open={resultado.ativo}
                  >
                    <summary className="cursor-pointer list-none font-semibold text-amber-400">
                      Grupo {grupo.codigo_grupo}
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        <GrupoPrazoCell grupo={grupo} />
                      </span>
                    </summary>
                    <div className="mt-4">
                      <GrupoSimulacaoLinhaControls
                        grupo={grupo}
                        cotas={cotas}
                        modalidades={modalidades}
                        config={config}
                        onChange={(c) => setConfig(grupo.id, c)}
                        compact
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}

        <div className="sticky bottom-4 mt-8 rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <div>
              <p className="text-xs uppercase text-zinc-500">Grupos</p>
              <p className="text-xl font-semibold">{totais.gruposSelecionados}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Qtd. cotas</p>
              <p className="text-xl font-semibold">{totais.totalCotas}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Soma das cotas</p>
              <p className="text-xl font-semibold">{formatCurrency(totais.somaCotas)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">1ª parcela</p>
              <p className="text-xl font-semibold">{formatCurrency(totais.primeiraParcela)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Lance embutido</p>
              <p className="text-lg font-semibold">{formatCurrency(totais.lanceEmbutido)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Saldo devedor</p>
              <p className="text-lg font-semibold">{formatCurrency(totais.saldoDevedorInicial)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Pós-contemplação (soma)</p>
              <p className="text-lg font-semibold text-emerald-300">
                {formatCurrency(totais.parcelaPosContemplacaoTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Lance total</p>
              <p className="text-lg font-semibold">{formatCurrency(totais.lanceTotal)}</p>
              <p className="text-[10px] text-zinc-500">
                Próprio {formatCurrency(totais.recursoProprio)}
              </p>
            </div>
            {totais.seguroTotal > 0 ? (
              <div>
                <p className="text-xs uppercase text-zinc-500">Seguro (mensal)</p>
                <p className="text-lg font-semibold">{formatCurrency(totais.seguroTotal)}</p>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <p className="text-xs uppercase text-amber-400">Crédito líquido</p>
              <p className="text-3xl font-bold text-amber-400">
                {formatCurrency(totais.creditoLiquido)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="gold" onClick={() => openModal("simulacao")}>
              Gerar simulação
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
              disabled={!hasSelection}
              onClick={() => openModal("proposta")}
            >
              Gerar proposta
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
              disabled={!hasSelection}
              onClick={() => openModal("especialista")}
            >
              Falar com especialista
            </Button>
          </div>
          {toastMsg ? <p className="mt-3 text-sm text-amber-300">{toastMsg}</p> : null}
          {resultMsg ? <p className="mt-3 text-sm text-emerald-400">{resultMsg}</p> : null}
          {pdfLink ? (
            <a
              href={pdfLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-amber-400 underline"
            >
              Baixar proposta PDF
            </a>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={submitModal}
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
          >
            <h2 className="text-lg font-semibold text-white">Seus dados</h2>
            <div>
              <Label>Nome</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="bg-zinc-950"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="bg-zinc-950"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={loading}>
                {loading ? "Enviando…" : "Confirmar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
