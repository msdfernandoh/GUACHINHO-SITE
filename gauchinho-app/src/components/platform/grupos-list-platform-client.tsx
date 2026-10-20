"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type GrupoRecord,
  formatBRL,
  formatPercent,
  formatDateBR,
  computeGrupoMetrics,
  validateGrupoProntidao,
} from "@/lib/platform/grupos-prontidao";
import { obterStatusReajusteAnual } from "@/lib/grupos/reajuste-anual";
import {
  marcarGrupoJaReajustadoPlatformAction,
  setVisibilidadeFranquiaLotePlatformAction,
  marcarReajusteLotePlatformAction,
} from "@/app/platform/grupos-actions";
import { GrupoReajusteAnualModal } from "@/components/platform/grupo-reajuste-anual-modal";
import { GrupoVagasEmLoteModal } from "@/components/platform/grupo-vagas-lote-modal";

export function GruposListPlatformClient({ grupos }: { grupos: GrupoRecord[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Estado para o modal de reajuste
  const [grupoParaReajuste, setGrupoParaReajuste] = useState<GrupoRecord | null>(null);

  // Estado para o modal de atualização de vagas em lote
  const [showVagasModal, setShowVagasModal] = useState(false);

  // Filtros rápidos
  const [filtroReajuste, setFiltroReajuste] = useState<"TODOS" | "PENDENTE" | "REAJUSTADO">("TODOS");
  const [filtroFranquia, setFiltroFranquia] = useState<"TODOS" | "ENVIADO" | "AUSENTE">("TODOS");

  // Seleção múltipla em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  function handleMarcarJaReajustado(grupo: GrupoRecord) {
    const status = obterStatusReajusteAnual(grupo);
    if (
      !confirm(
        `Marcar o Grupo ${grupo.codigo_grupo} como já reajustado no ano de ${status.anoAtual}?\n\nEsta ação removerá a tag de atenção na listagem sem alterar os valores das cotas.`,
      )
    ) {
      return;
    }

    setPendingId(grupo.id);
    startTransition(async () => {
      try {
        const res = await marcarGrupoJaReajustadoPlatformAction(grupo.id, status.anoAtual);
        if (!res.ok) {
          alert(`Erro: ${res.error}`);
        } else {
          router.refresh();
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  // Filtragem dos grupos
  const gruposFiltrados = grupos.filter((g) => {
    if (filtroReajuste === "PENDENTE") {
      const st = obterStatusReajusteAnual(g);
      if (!st.precisaReajuste) return false;
    }
    if (filtroReajuste === "REAJUSTADO") {
      const st = obterStatusReajusteAnual(g);
      if (!st.jaReajustadoAnoAtual) return false;
    }
    if (filtroFranquia === "ENVIADO" && g.visivel_franquia === false) return false;
    if (filtroFranquia === "AUSENTE" && g.visivel_franquia !== false) return false;
    return true;
  });

  const totalPendentes = grupos.filter((g) => obterStatusReajusteAnual(g).precisaReajuste).length;
  const totalEnviadosFranquia = grupos.filter((g) => g.visivel_franquia !== false).length;
  const totalAusentesFranquia = grupos.filter((g) => g.visivel_franquia === false).length;

  const isAllSelected =
    gruposFiltrados.length > 0 && gruposFiltrados.every((g) => selectedIds.has(g.id));

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      for (const g of gruposFiltrados) {
        next.add(g.id);
      }
      setSelectedIds(next);
    }
  }

  function handleToggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function handleSetVisibilidadeLote(visivel: boolean) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const acaoLabel = visivel
      ? `Liberar e enviar ${ids.length} grupo(s) selecionado(s) para a Franquia (ERP)?`
      : `Bloquear e DEIXAR AUSENTE da Franquia (ERP) os ${ids.length} grupo(s) selecionado(s)?\n\nEstes grupos não serão mais exibidos para os consultores e vendas da franquia.`;

    if (!confirm(acaoLabel)) return;

    setIsBatchProcessing(true);
    try {
      const res = await setVisibilidadeFranquiaLotePlatformAction(ids, visivel);
      if (!res.ok) {
        alert(`Erro ao alterar visibilidade: ${res.error}`);
      } else {
        setSelectedIds(new Set());
        router.refresh();
      }
    } finally {
      setIsBatchProcessing(false);
    }
  }

  async function handleMarcarReajusteLote() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const anoAtual = new Date().getFullYear();
    if (
      !confirm(
        `Marcar ${ids.length} grupo(s) selecionado(s) como com REAJUSTE CONCLUÍDO no ano de ${anoAtual}?\n\nEsta ação dará o valor como atualizado e removerá os alertas de reajuste pendente.`,
      )
    ) {
      return;
    }

    setIsBatchProcessing(true);
    try {
      const res = await marcarReajusteLotePlatformAction(ids, anoAtual);
      if (!res.ok) {
        alert(`Erro ao marcar reajuste: ${res.error}`);
      } else {
        setSelectedIds(new Set());
        router.refresh();
      }
    } finally {
      setIsBatchProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Abas / Filtro rápido de reajuste, Franquia e Botão de Vagas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros de Reajuste */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFiltroReajuste("TODOS")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroReajuste === "TODOS"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Todos ({grupos.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroReajuste("PENDENTE")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroReajuste === "PENDENTE"
                  ? "bg-amber-500 text-slate-950"
                  : "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
              }`}
            >
              <span>⚠ Reajuste Pendente</span>
              {totalPendentes > 0 ? (
                <span className="rounded-full bg-amber-950/20 px-1.5 py-0.2 text-[10px] font-black text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
                  {totalPendentes}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setFiltroReajuste("REAJUSTADO")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroReajuste === "REAJUSTADO"
                  ? "bg-emerald-700 text-white"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              }`}
            >
              ✓ Já Reajustados
            </button>
          </div>

          {/* Filtros de Franquia */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFiltroFranquia("TODOS")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroFranquia === "TODOS"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Status Franquia: Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroFranquia("ENVIADO")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroFranquia === "ENVIADO"
                  ? "bg-emerald-600 text-white"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
              }`}
              title="Filtrar grupos liberados e enviados à franquia"
            >
              <span>✓ Enviados</span>
              <span className="rounded-full bg-emerald-950/20 px-1.5 py-0.2 text-[10px] font-black">
                {totalEnviadosFranquia}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroFranquia("AUSENTE")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filtroFranquia === "AUSENTE"
                  ? "bg-slate-700 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
              }`}
              title="Filtrar grupos que não foram enviados e estão ausentes da franquia"
            >
              <span>🚫 Ausentes</span>
              <span className="rounded-full bg-slate-950/20 px-1.5 py-0.2 text-[10px] font-black">
                {totalAusentesFranquia}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowVagasModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-3.5 py-2 text-xs font-bold text-white shadow transition hover:bg-cyan-800"
            title="Abrir painel para incluir ou retirar vagas de múltiplos grupos simultaneamente"
          >
            <span>⚡</span>
            <span>Atualizar Vagas em Lote</span>
          </button>
          <p className="text-xs text-slate-500">
            Mostrando <strong>{gruposFiltrados.length}</strong> de <strong>{grupos.length}</strong> grupos
          </p>
        </div>
      </div>

      {/* BARRA DE AÇÃO EM LOTE (Aparece quando há seleção) */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50/90 p-4 shadow-md backdrop-blur-sm dark:border-cyan-400 dark:bg-cyan-950/80">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-700 font-mono text-sm font-black text-white">
              {selectedIds.size}
            </span>
            <div>
              <p className="text-sm font-extrabold text-cyan-950 dark:text-cyan-100">
                {selectedIds.size === 1
                  ? "1 grupo selecionado"
                  : `${selectedIds.size} grupos selecionados`}
              </p>
              <p className="text-xs text-cyan-800 dark:text-cyan-300">
                Aplique ações em massa diretamente nos grupos selecionados abaixo:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Deixar Ausente da Franquia */}
            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={() => handleSetVisibilidadeLote(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-black text-red-700 shadow-sm transition hover:bg-red-50 hover:border-red-400 disabled:opacity-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300"
              title="Ocultar grupos selecionados e não enviar para o ERP da franquia"
            >
              <span>🚫</span>
              <span>Não Enviar / Deixar Ausente da Franquia</span>
            </button>

            {/* Botão Liberar para Franquia */}
            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={() => handleSetVisibilidadeLote(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              title="Liberar grupos selecionados para visualização e vendas na franquia"
            >
              <span>✓</span>
              <span>Liberar / Enviar para Franquia</span>
            </button>

            {/* Botão Marcar Reajuste Concluído */}
            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={handleMarcarReajusteLote}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-50"
              title="Marcar o valor das cotas como já atualizado no ano atual"
            >
              <span>⚡</span>
              <span>Marcar Valor / Reajuste Atualizado</span>
            </button>

            {/* Limpar seleção */}
            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={handleClearSelection}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Desmarcar todos
            </button>
          </div>
        </div>
      ) : null}

      {/* Tabela de Grupos */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    title="Selecionar todos os grupos filtrados"
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                </th>
                <th className="px-3 py-3">Grupo</th>
                <th className="px-3 py-3 text-center">Franquia</th>
                <th className="px-3 py-3">Administradora</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3 text-center">Prazo</th>
                <th className="px-3 py-3 text-center">1ª Assembleia</th>
                <th className="px-3 py-3 text-center">Reajuste Anual</th>
                <th className="px-3 py-3 text-right">Taxa Adm</th>
                <th className="px-3 py-3 text-right">Taxa Total</th>
                <th className="px-3 py-3 text-right">Cota Mín.</th>
                <th className="px-3 py-3 text-right">Cota Máx.</th>
                <th className="px-3 py-3 text-center">Vagas</th>
                <th className="px-3 py-3 text-center">Prontidão</th>
                <th className="px-3 py-3 text-center min-w-[200px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gruposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-8 text-center text-sm text-slate-400">
                    Nenhum grupo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                gruposFiltrados.map((grupo) => {
                  const metrics = computeGrupoMetrics(grupo);
                  const prontidao = validateGrupoProntidao(grupo);
                  const statusReajuste = obterStatusReajusteAnual(grupo);

                  const adminNome =
                    typeof grupo.administradora === "object"
                      ? grupo.administradora?.nome
                      : grupo.administradora || "—";
                  const tipoNome = grupo.tipo?.nome || grupo.modalidade || "—";
                  const isProcessing = pendingId === grupo.id;
                  const isSelected = selectedIds.has(grupo.id);
                  const isVisivelFranquia = grupo.visivel_franquia !== false;

                  return (
                    <tr
                      key={grupo.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                        isSelected ? "bg-cyan-50/60 dark:bg-cyan-950/40" : ""
                      } ${
                        statusReajuste.precisaReajuste
                          ? "bg-amber-500/5 dark:bg-amber-500/10"
                          : ""
                      }`}
                    >
                      {/* Checkbox de seleção */}
                      <td className="w-10 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(grupo.id)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        <Link
                          href={`/platform/grupos/${grupo.id}`}
                          className="text-cyan-700 hover:underline dark:text-cyan-400 font-mono"
                        >
                          {grupo.codigo_grupo}
                        </Link>
                      </td>

                      {/* Coluna Visibilidade Franquia */}
                      <td className="px-3 py-3 text-center">
                        {isVisivelFranquia ? (
                          <span
                            title="Grupo liberado para a Master Franquia e consultores no ERP"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            ✓ Enviado
                          </span>
                        ) : (
                          <span
                            title="Grupo AUSENTE da Franquia (bloqueado / não enviado ao ERP)"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            🚫 Ausente
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {adminNome}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs">
                        <div className="flex flex-col">
                          <span>{tipoNome}</span>
                          {grupo.tipo_reajuste_anual ? (
                            <span className="text-[10px] font-semibold text-slate-400">
                              {grupo.tipo_reajuste_anual === "FIXO"
                                ? `${grupo.reajuste_anual_percentual}% fixo`
                                : grupo.reajuste_anual_indice || "Variável"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-900 dark:text-white text-xs">
                        <span title={metrics.temporal.legenda} className="cursor-help">
                          {metrics.temporal.resumoPrazo}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
                        {formatDateBR(grupo.data_primeira_assembleia)}
                      </td>

                      {/* Coluna Reajuste Anual com Tag de Atenção */}
                      <td className="px-3 py-3 text-center">
                        {statusReajuste.precisaReajuste ? (
                          <span
                            title={`Grupo completou 1 ano ou mais da primeira assembleia em ${statusReajuste.nomeMesAniversario}. Reajuste pendente no ano atual.`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black text-slate-950 shadow-xs animate-pulse"
                          >
                            ⚠ Reajuste: Mês de {statusReajuste.nomeMesAniversario}
                          </span>
                        ) : statusReajuste.jaReajustadoAnoAtual ? (
                          <span
                            title={`Reajuste do ano ${statusReajuste.anoAtual} já aplicado ou dispensado.`}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            ✓ Reajustado ({statusReajuste.anoAtual})
                          </span>
                        ) : statusReajuste.deuUmAno ? (
                          <span
                            title={`Aniversário anual será em ${statusReajuste.nomeMesAniversario}.`}
                            className="text-xs text-slate-500"
                          >
                            Aniversário: {statusReajuste.nomeMesAniversario}
                          </span>
                        ) : statusReajuste.temPrimeiraAssembleia ? (
                          <span className="text-xs text-slate-400">Novo (&lt; 1 ano)</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-medium text-xs">
                        {formatPercent(grupo.taxa_administrativa_percentual)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white text-xs">
                        {formatPercent(metrics.taxaTotal)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {formatBRL(metrics.cotaMinima)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {formatBRL(metrics.cotaMaxima)}
                      </td>

                      {/* Coluna Vagas */}
                      <td className="px-3 py-3 text-center text-xs font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => setShowVagasModal(true)}
                          className="group inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Clique para gerenciar vagas rapidamente"
                        >
                          {(grupo.vagas_disponiveis ?? 0) > 0 ? (
                            <span>{grupo.vagas_disponiveis}</span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                              Aguardando novas vagas
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                            ✏
                          </span>
                        </button>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            prontidao.ready
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {prontidao.ready ? "Pronto" : `${prontidao.issues.length} pendência(s)`}
                        </span>
                      </td>

                      {/* Coluna de Ações com Aplicar Reajuste e Já Reajustado */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/platform/grupos/${grupo.id}`}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Abrir
                          </Link>

                          {/* Botão Aplicar Reajuste */}
                          <button
                            type="button"
                            onClick={() => setGrupoParaReajuste(grupo)}
                            className="rounded border border-cyan-700 bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-200"
                            title="Abrir tela de reajuste anual de créditos deste grupo"
                          >
                            Reajustar
                          </button>

                          {/* Botão Já Reajustado individual */}
                          {statusReajuste.precisaReajuste ? (
                            <button
                              type="button"
                              onClick={() => handleMarcarJaReajustado(grupo)}
                              disabled={isProcessing}
                              className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-extrabold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                              title="Tirar a tag de atenção marcando o grupo como já reajustado no ano atual"
                            >
                              {isProcessing ? "…" : "Já Reajustado"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Interativo de Reajuste */}
      {grupoParaReajuste ? (
        <GrupoReajusteAnualModal
          grupo={grupoParaReajuste}
          cotas={grupoParaReajuste.produtos ?? []}
          onClose={() => setGrupoParaReajuste(null)}
        />
      ) : null}

      {/* Modal de Atualização Rápida de Vagas em Lote */}
      {showVagasModal ? (
        <GrupoVagasEmLoteModal
          grupos={grupos}
          onClose={() => setShowVagasModal(false)}
        />
      ) : null}
    </div>
  );
}
