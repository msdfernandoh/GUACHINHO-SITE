"use client";

import { useState, useMemo } from "react";
import {
  X,
  Trophy,
  DollarSign,
  Calendar,
  User,
  Search,
  ExternalLink,
  Phone,
  Layers,
  Sparkles,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import type { CrmVendaFechadaItem } from "@/lib/crm/dashboard-query";

interface CrmVendasFechadasModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendas: CrmVendaFechadaItem[];
  metaMensal?: number;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function CrmVendasFechadasModal({
  isOpen,
  onClose,
  vendas,
  metaMensal = 2000000,
}: CrmVendasFechadasModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVendas = useMemo(() => {
    if (!searchTerm.trim()) return vendas;
    const term = searchTerm.toLowerCase();
    return vendas.filter(
      (v) =>
        v.clienteNome.toLowerCase().includes(term) ||
        (v.clienteTelefone && v.clienteTelefone.includes(term)) ||
        (v.clienteCpfCnpj && v.clienteCpfCnpj.includes(term)) ||
        v.responsavelNome.toLowerCase().includes(term) ||
        (v.grupoCodigo && v.grupoCodigo.toLowerCase().includes(term))
    );
  }, [vendas, searchTerm]);

  const totalCredito = useMemo(
    () => vendas.reduce((acc, v) => acc + (v.valorCredito || 0), 0),
    [vendas]
  );

  const totalParcelas = useMemo(
    () => vendas.reduce((acc, v) => acc + (v.valorParcela || 0), 0),
    [vendas]
  );

  const ticketMedio = vendas.length > 0 ? totalCredito / vendas.length : 0;
  const percMeta = metaMensal > 0 ? (totalCredito / metaMensal) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-vendas-fechadas-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-emerald-500/30 bg-zinc-950 shadow-2xl shadow-emerald-950/40">
        {/* CABEÇALHO COM GRADIENTE E CONTADOR */}
        <div className="relative flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-zinc-950 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 shadow-md shadow-emerald-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="modal-vendas-fechadas-title"
                  className="text-lg font-bold tracking-tight text-white sm:text-xl"
                >
                  Vendas Fechadas do Mês
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {vendas.length} {vendas.length === 1 ? "venda" : "vendas"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Auditoria e reconciliação em tempo real entre Contratos ERP, Cotas e Pipeline CRM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CARDS DE RESUMO FINANCEIRO (KPIs DE FECHAMENTO) */}
        <div className="grid grid-cols-2 gap-3 border-b border-zinc-800/80 bg-zinc-900/40 p-4 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
              Crédito Fechado Total
            </span>
            <p className="mt-1 text-xl font-extrabold text-emerald-400">
              {formatCurrency(totalCredito)}
            </p>
            <p className="text-[10px] text-emerald-500/80">Produção real consolidada</p>
          </div>

          <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-teal-300">
              Parcelas Mensais
            </span>
            <p className="mt-1 text-xl font-extrabold text-teal-300">
              {formatCurrency(totalParcelas)}
            </p>
            <p className="text-[10px] text-teal-400/80">Receita recorrente ativada</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Ticket Médio
            </span>
            <p className="mt-1 text-xl font-extrabold text-zinc-200">
              {formatCurrency(ticketMedio)}
            </p>
            <p className="text-[10px] text-zinc-500">Por negociação fechada</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Meta Mensal
              </span>
              <span className="text-[10px] font-semibold text-indigo-400">
                {percMeta.toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 text-xl font-extrabold text-indigo-300">
              {percMeta >= 100 ? "Superada! 🚀" : `${percMeta.toFixed(0)}%`}
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, percMeta)}%` }}
              />
            </div>
          </div>
        </div>

        {/* BARRA DE FILTRO E BUSCA */}
        <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, consultor ou telefone..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Mostrando {filteredVendas.length} de {vendas.length} negócios
            </span>
          </div>
        </div>

        {/* LISTAGEM / TABELA DAS VENDAS FECHADAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredVendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-12 w-12 text-zinc-700" />
              <p className="mt-3 text-sm font-medium text-zinc-300">
                Nenhuma venda encontrada com o filtro informado.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Altere o termo de pesquisa ou limpe a busca para visualizar todas as vendas do mês.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVendas.map((venda, idx) => (
                <div
                  key={venda.id || idx}
                  className="group relative flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all duration-200 hover:border-emerald-500/40 hover:bg-zinc-900/90 sm:flex-row sm:items-center"
                >
                  {/* Informações do Cliente e Negócio */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white transition group-hover:text-emerald-300">
                        {venda.clienteNome}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Confirmada
                      </span>
                      <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                        {venda.origem}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                      {venda.clienteTelefone && (
                        <a
                          href={`https://wa.me/55${venda.clienteTelefone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-400/90 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {venda.clienteTelefone}
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-zinc-500" />
                        Resp: <strong className="text-zinc-200">{venda.responsavelNome}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-zinc-500" />
                        {formatDate(venda.dataVenda)}
                      </span>
                      {venda.grupoCodigo && (
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-zinc-500" />
                          Grupo: {venda.grupoCodigo}
                          {venda.cotaNumero ? ` • Cota: ${venda.cotaNumero}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Valores e Botões de Ação */}
                  <div className="flex flex-row items-center justify-between gap-4 border-t border-zinc-800/80 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-base font-extrabold text-emerald-400 sm:text-lg">
                        {formatCurrency(venda.valorCredito)}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Parcela:{" "}
                        <strong className="text-zinc-200">
                          {formatCurrency(venda.valorParcela)}
                        </strong>
                        {venda.prazo > 0 ? ` (${venda.prazo}m)` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/admin/vendas"
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-white"
                        title="Abrir detalhes no módulo de Vendas do ERP"
                      >
                        Contrato ERP
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="/admin/crm/pipeline?etapa=venda_fechada"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-900/50"
                        title="Ver lead na coluna de Venda Fechada do Pipeline"
                      >
                        Pipeline CRM
                        <TrendingUp className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE NAVEGAÇÃO RÁPIDA */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/80 px-6 py-4 sm:flex-row">
          <p className="text-xs text-zinc-500">
            * Todas as vendas confirmadas no ERP e leads ganhos do mês corrente são consolidados automaticamente.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Fechar
            </button>
            <a
              href="/admin/vendas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 transition hover:bg-emerald-500"
            >
              <DollarSign className="h-4 w-4" />
              Gestão Geral de Vendas
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
