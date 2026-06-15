"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";
import { MODALIDADE_FILTRO_PUBLICO } from "@/lib/types";
import {
  calcularTotaisGrupos,
  grupoToParametros,
} from "@/lib/grupos/calculos";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label } from "@/components/ui/form-primitives";

export type PublicGrupoRow = {
  grupo: GrupoConsorcio;
  cota: GrupoCota;
};

type ModalFiltro = (typeof MODALIDADE_FILTRO_PUBLICO)[number];

export function GruposPublicClient({
  rows,
  isStaff = false,
}: {
  rows: PublicGrupoRow[];
  isStaff?: boolean;
}) {
  const [filtro, setFiltro] = useState<ModalFiltro>("Todos");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAcao, setModalAcao] = useState<"simulacao" | "proposta" | "especialista">("simulacao");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const hasSelection = Object.keys(selected).length > 0;

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(({ grupo, cota }) => {
      if (filtro !== "Todos" && grupo.modalidade !== filtro) return false;
      if (!q) return true;
      const credito = String(cota.valor_credito);
      return (
        grupo.codigo_grupo.toLowerCase().includes(q) ||
        credito.includes(q.replace(",", "."))
      );
    });
  }, [rows, filtro, busca]);

  const selecoes = useMemo(() => {
    return Object.entries(selected).map(([grupoId, cotaId]) => {
      const row = rows.find((r) => r.grupo.id === grupoId && r.cota.id === cotaId);
      return row!;
    }).filter(Boolean);
  }, [selected, rows]);

  const totais = useMemo(() => {
    if (!selecoes.length) return null;
    return calcularTotaisGrupos(
      selecoes.map(({ grupo, cota }) => ({
        linha: {
          valorCredito: Number(cota.valor_credito),
          saldoDevedorInformado: cota.saldo_devedor,
          valorParcelaInformado: cota.valor_parcela ?? cota.parcela_com_seguro,
          quantidadeCotas: 1,
        },
        params: grupoToParametros(grupo),
      })),
    );
  }, [selecoes]);

  function toggleCota(grupoId: string, cotaId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[grupoId] === cotaId) {
        delete next[grupoId];
      } else {
        next[grupoId] = cotaId;
      }
      return next;
    });
  }

  function openModal(acao: typeof modalAcao) {
    if (!hasSelection) {
      if (acao === "simulacao") {
        setToastMsg("Selecione ao menos uma cota em um grupo para gerar a simulação.");
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
          selecoes: Object.entries(selected).map(([grupoId, cotaId]) => ({
            grupoId,
            cotaId,
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
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 text-sm text-amber-400">
            <Sparkles className="h-4 w-4" /> Simulador premium
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Nossos Grupos
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
            Escolha uma cota por grupo e monte sua simulação personalizada.
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

        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50">
          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg text-zinc-300">Nenhum grupo disponível no momento.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Volte em breve ou fale com um especialista para conhecer as opções de consórcio.
              </p>
              {isStaff ? (
                <p className="mt-4 text-sm text-amber-400/90">
                  Você está logado como equipe.{" "}
                  <Link href="/admin/grupos" className="underline hover:text-amber-300">
                    Cadastre grupos no admin
                  </Link>{" "}
                  ou use &quot;Popular grupos de teste&quot; (Master).
                </p>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400">
              Nenhum resultado para os filtros atuais. Ajuste a busca ou a modalidade.
            </div>
          ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Crédito</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Vagas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ grupo, cota }) => {
                const isSelected = selected[grupo.id] === cota.id;
                const esgotado = cota.status === "Esgotado";
                return (
                  <tr
                    key={cota.id}
                    className={cn(
                      "border-b border-zinc-800/80 transition",
                      isSelected && "bg-amber-500/10",
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-amber-400">{grupo.codigo_grupo}</td>
                    <td className="px-4 py-3">{grupo.modalidade}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(cota.valor_credito))}</td>
                    <td className="px-4 py-3">
                      {formatCurrency(Number(cota.valor_parcela ?? cota.parcela_reduzida))}
                    </td>
                    <td className="px-4 py-3">{grupo.prazo_restante ?? grupo.prazo_total ?? "—"}</td>
                    <td className="px-4 py-3">{cota.vagas_texto ?? cota.vagas_percentual ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          cota.status === "Últimas" && "bg-amber-500/20 text-amber-300",
                          cota.status === "Disponível" && "bg-emerald-500/20 text-emerald-300",
                          esgotado && "bg-zinc-700 text-zinc-400",
                        )}
                      >
                        {cota.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? "gold" : "outline"}
                        disabled={esgotado}
                        className={!isSelected ? "border-zinc-600 text-zinc-200" : undefined}
                        onClick={() => toggleCota(grupo.id, cota.id)}
                      >
                        {isSelected ? "Selecionado" : "Selecionar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        <div className="sticky bottom-4 mt-8 rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-zinc-500">Grupos</p>
              <p className="text-xl font-semibold">{Object.keys(selected).length}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Total crédito</p>
              <p className="text-xl font-semibold">{formatCurrency(totais?.somaCotas ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">1ª parcela</p>
              <p className="text-xl font-semibold">{formatCurrency(totais?.primeiraParcela ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-amber-400">Crédito líquido</p>
              <p className="text-3xl font-bold text-amber-400">
                {formatCurrency(totais?.creditoLiquido ?? 0)}
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
              className="border-zinc-600 text-zinc-100"
              disabled={!hasSelection}
              onClick={() => openModal("proposta")}
            >
              Gerar proposta
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 text-zinc-100"
              disabled={!hasSelection}
              onClick={() => openModal("especialista")}
            >
              Falar com especialista
            </Button>
          </div>
          {toastMsg ? <p className="mt-3 text-sm text-amber-300">{toastMsg}</p> : null}
          {resultMsg ? <p className="mt-3 text-sm text-emerald-400">{resultMsg}</p> : null}
          {pdfLink ? (
            <a href={pdfLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-amber-400 underline">
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
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} className="bg-zinc-950" />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="bg-zinc-950" />
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
