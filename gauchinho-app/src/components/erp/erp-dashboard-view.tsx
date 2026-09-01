"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  BadgeDollarSign,
  WalletCards,
  Users,
  Building2,
  FileSignature,
  FileCheck2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  ChevronRight,
  Target,
  Sparkles,
  BarChart3,
  PieChart,
} from "lucide-react";
import type {
  ErpDashboardFullDTO,
  ErpDashboardPeriodFilter,
} from "@/lib/gestao/dashboards-service";

interface ErpDashboardViewProps {
  initialData?: ErpDashboardFullDTO | null;
}

export function ErpDashboardView({ initialData }: ErpDashboardViewProps) {
  const [data, setData] = useState<ErpDashboardFullDTO | null>(initialData || null);
  const [periodo, setPeriodo] = useState<ErpDashboardPeriodFilter>("mes_atual");
  const [administradoraId, setAdministradoraId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!initialData);

  const fetchData = async (p: ErpDashboardPeriodFilter, adm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("periodo", p);
      if (adm) params.set("administradoraId", adm);
      const res = await fetch(`/api/admin/gestao/dashboard?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Erro ao carregar Dashboard ERP:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchData(periodo, administradoraId);
    }
  }, []);

  const handlePeriodoChange = (newPeriodo: ErpDashboardPeriodFilter) => {
    setPeriodo(newPeriodo);
    startTransition(() => {
      fetchData(newPeriodo, administradoraId);
    });
  };

  const handleAdmChange = (newAdm: string) => {
    setAdministradoraId(newAdm);
    startTransition(() => {
      fetchData(periodo, newAdm);
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-slate-200 rounded-2xl w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
        <h3 className="mt-3 text-base font-bold text-slate-900">Não foi possível carregar o Dashboard</h3>
        <p className="mt-1 text-xs text-slate-500">Verifique sua conexão ou tente novamente.</p>
        <button
          onClick={() => fetchData(periodo, administradoraId)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const {
    empresa,
    modulosLiberados = [],
    vendas,
    comissaoFranquia,
    comissaoParticipantes,
    caixa,
    comercial,
    clientesCotas,
    metas,
    alertas,
    proximasAssembleias,
    administradorasDisponiveis = [],
  } = data;

  const hasModulo = (mod: string) => modulosLiberados.includes(mod);

  // Determinar altura máxima para gráfico de barras
  const maxCreditoVenda = Math.max(...vendas.historicoMensal.map((h) => h.credito), 1000);
  const maxComissao = Math.max(...comissaoFranquia.historicoMensal.map((h) => Math.max(h.gerada, h.recebida)), 100);

  return (
    <div className="space-y-7">
      {/* ───────────────────────────────────────────────────────────
          1. CABEÇALHO EXECUTIVO E FILTROS
      ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              ERP Sistema • Visão Operacional
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
              {empresa.planoNome || "Plano Ativo"}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {empresa.nomeFantasia}
          </h1>
          <p className="text-xs text-slate-500">
            Painel consolidado em tempo real com fontes canônicas de vendas, comissões, caixa e alertas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Período */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800">
            {(
              [
                { id: "mes_atual", label: "Mês Atual" },
                { id: "mes_anterior", label: "Mês Anterior" },
                { id: "ultimos_3_meses", label: "3 Meses" },
                { id: "ultimos_6_meses", label: "6 Meses" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePeriodoChange(opt.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  periodo === opt.id
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filtro de Administradora */}
          {administradorasDisponiveis.length > 0 && (
            <select
              value={administradoraId}
              onChange={(e) => handleAdmChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            >
              <option value="">Todas Administradoras</option>
              {administradorasDisponiveis.map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.nome}
                </option>
              ))}
            </select>
          )}

          {/* Botão Atualizar */}
          <button
            type="button"
            onClick={() => fetchData(periodo, administradoraId)}
            disabled={isPending || loading}
            title="Atualizar dados do Dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────
          2. LINHA 1: CARDS PRINCIPAIS (4 COLUNAS)
      ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Vendas no Mês */}
        <Link href="/erp/vendas" className="relative block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendas no Período</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-slate-900 dark:text-white block">
              {formatCurrency(vendas.creditoVendidoMes)}
            </strong>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
              <span>{vendas.cotasVendidasMes} cota(s) vendida(s)</span>
              <span>•</span>
              <span>Ticket: {formatCurrency(vendas.ticketMedio)}</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Comparado ao anterior:</span>
            {vendas.variacaoCreditoPercentual !== null ? (
              <span
                className={`font-black flex items-center gap-0.5 ${
                  vendas.variacaoCreditoPercentual >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {vendas.variacaoCreditoPercentual >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {vendas.variacaoCreditoPercentual >= 0 ? "+" : ""}
                {vendas.variacaoCreditoPercentual}%
              </span>
            ) : (
              <span className="text-slate-400 font-bold">Sem base anterior</span>
            )}
          </div>
        </Link>

        {/* Card 2: Comissão da Franquia */}
        <Link href="/erp/comissoes" className="relative block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissão da Franquia</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">
              {formatCurrency(comissaoFranquia.recebida)}
            </strong>
            <p className="mt-1 text-xs text-slate-500">
              Efetivamente recebida e liquidada
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Gerada: </span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(comissaoFranquia.gerada)}</span>
            </div>
            <div>
              <span className="text-slate-400">Pendente: </span>
              <span className="font-bold text-amber-600">{formatCurrency(comissaoFranquia.pendente)}</span>
            </div>
          </div>
        </Link>

        {/* Card 3: Comissão dos Participantes */}
        <Link href="/erp/minhas-comissoes" className="relative block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissão Participantes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <BadgeDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-purple-600 dark:text-purple-400 block">
              {formatCurrency(comissaoParticipantes.paga)}
            </strong>
            <p className="mt-1 text-xs text-slate-500">
              Repasses liquidados aos parceiros
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">A Pagar: </span>
              <span className="font-bold text-amber-600">{formatCurrency(comissaoParticipantes.pendente)}</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {comissaoParticipantes.participantesComPendenciaCount} com saldo
            </span>
          </div>
        </Link>

        {/* Card 4: Caixa & Saldo Disponível */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Caixa Operacional</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400">
              <WalletCards className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong
              className={`text-2xl font-black block ${
                caixa.saldoDisponivel >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600"
              }`}
            >
              {formatCurrency(caixa.saldoDisponivel)}
            </strong>
            <p className="mt-1 text-xs text-slate-500">
              Saldo real disponível em conta
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-bold">+{formatCurrency(caixa.entradasMes)}</span>
            <span className="text-rose-600 font-bold">-{formatCurrency(caixa.saidasMes)}</span>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          3. LINHA 2: CARDS OPERACIONAIS (COMERCIAL, CLIENTES, FINANCEIRO, METAS)
      ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Comercial & Funil */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              Comercial & Funil
            </h3>
            <Link href="/admin/leads" className="text-[11px] font-bold text-blue-600 hover:underline">
              Ver CRM
            </Link>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Leads Novos:</span>
              <strong className="text-slate-900 dark:text-white">{comercial.leadsNovos}</strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Leads Sem Contato:</span>
              <strong className={comercial.leadsSemContato > 0 ? "text-amber-600 font-bold" : "text-slate-900"}>
                {comercial.leadsSemContato}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Propostas Ativas:</span>
              <strong className="text-slate-900 dark:text-white">{comercial.propostasEmAndamento}</strong>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Contratos Assinados:</span>
              <strong className="text-emerald-600 font-bold">{comercial.contratosAssinadosFormalizacao}</strong>
            </div>
          </div>
        </div>

        {/* Clientes & Cotas */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              Clientes & Cotas
            </h3>
            <Link href="/erp/clientes" className="text-[11px] font-bold text-indigo-600 hover:underline">
              Ver Clientes
            </Link>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Clientes Ativos:</span>
              <strong className="text-slate-900 dark:text-white">{clientesCotas.clientesAtivos}</strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Novos no Período:</span>
              <strong className="text-slate-900 dark:text-white">{clientesCotas.clientesNovosMes}</strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Cotas Ativas:</span>
              <strong className="text-slate-900 dark:text-white">{clientesCotas.cotasAtivas}</strong>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Cotas Formalizadas:</span>
              <strong className="text-emerald-600 font-bold">{clientesCotas.cotasAtivas}</strong>
            </div>
          </div>
        </div>

        {/* Financeiro / Contas a Pagar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <WalletCards className="h-3.5 w-3.5 text-rose-600" />
              Contas a Pagar
            </h3>
            <Link href="/erp/contas-pagar" className="text-[11px] font-bold text-rose-600 hover:underline">
              Ver Contas
            </Link>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Vencidas:</span>
              <strong className={caixa.contasPagarVencidas > 0 ? "text-rose-600 font-black" : "text-slate-900"}>
                {formatCurrency(caixa.contasPagarVencidas)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Abertas no Mês:</span>
              <strong className="text-slate-900 dark:text-white">{formatCurrency(caixa.contasPagarMes)}</strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Total de Títulos:</span>
              <strong className="text-slate-900 dark:text-white">{caixa.contasPagarCount}</strong>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Status Operacional:</span>
              <strong className={caixa.contasPagarVencidas > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                {caixa.contasPagarVencidas > 0 ? "Atenção" : "Em Dia"}
              </strong>
            </div>
          </div>
        </div>

        {/* Metas Comerciais (se disponível no Plano/Override) */}
        {metas && metas.disponivel ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-cyan-600" />
                Meta do Mês
              </h3>
              <span className="text-xs font-black text-cyan-700 dark:text-cyan-400">
                {metas.atingimentoPercentual}%
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Meta de Crédito:</span>
                <strong className="text-slate-900 dark:text-white">{formatCurrency(metas.metaCredito)}</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Realizado:</span>
                <strong className="text-emerald-600 font-bold">{formatCurrency(metas.creditoRealizado)}</strong>
              </div>
              <div className="pt-2">
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, metas.atingimentoPercentual))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4.5 flex flex-col justify-center items-center text-center dark:border-slate-800 dark:bg-slate-850">
            <Target className="h-6 w-6 text-slate-400 mb-1" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Módulo de Metas</p>
            <p className="text-[11px] text-slate-400">Não incluso no plano contratado.</p>
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────
          4. GRÁFICOS OPERACIONAIS (EVOLUÇÃO DE VENDAS & COMISSÕES)
      ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico 1: Produção Mensal (Crédito & Cotas) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Evolução de Vendas de Crédito (Últimos 6 Meses)
              </h3>
              <p className="text-xs text-slate-500">Volume monetário e cotas comercializadas mês a mês.</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-6 gap-2 h-44 items-end pb-6 border-b border-slate-100 dark:border-slate-800">
              {vendas.historicoMensal.map((item) => {
                const alturaPercent = maxCreditoVenda > 0 ? (item.credito / maxCreditoVenda) * 100 : 0;
                return (
                  <div key={item.mes} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.cotas} cotas
                    </div>
                    <div
                      style={{ height: `${Math.max(8, alturaPercent)}%` }}
                      className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-700 group-hover:to-blue-500 transition-all shadow-xs"
                      title={`${item.label}: ${formatCurrency(item.credito)} (${item.cotas} cotas)`}
                    />
                    <span className="mt-2 text-[11px] font-bold text-slate-500">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-2 text-[11px] text-slate-500">
              <span>Total no semestre: {formatCurrency(vendas.historicoMensal.reduce((a, b) => a + b.credito, 0))}</span>
              <span>Total cotas: {vendas.historicoMensal.reduce((a, b) => a + b.cotas, 0)}</span>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Comissões da Franquia (Gerada vs Recebida) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                Comissões da Franquia (Gerada vs Recebida)
              </h3>
              <p className="text-xs text-slate-500">Comparação entre direito adquirido e liquidações efetivas.</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-6 gap-2 h-44 items-end pb-6 border-b border-slate-100 dark:border-slate-800">
              {comissaoFranquia.historicoMensal.map((item) => {
                const altGerada = maxComissao > 0 ? (item.gerada / maxComissao) * 100 : 0;
                const altRecebida = maxComissao > 0 ? (item.recebida / maxComissao) * 100 : 0;
                return (
                  <div key={item.mes} className="flex flex-col items-center h-full justify-end group">
                    <div className="flex gap-1 items-end h-full w-full justify-center">
                      <div
                        style={{ height: `${Math.max(6, altGerada)}%` }}
                        className="w-3 rounded-t-md bg-blue-300 dark:bg-blue-800"
                        title={`Gerada: ${formatCurrency(item.gerada)}`}
                      />
                      <div
                        style={{ height: `${Math.max(6, altRecebida)}%` }}
                        className="w-3 rounded-t-md bg-emerald-500 shadow-xs"
                        title={`Recebida: ${formatCurrency(item.recebida)}`}
                      />
                    </div>
                    <span className="mt-2 text-[11px] font-bold text-slate-500">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-300" /> Gerada
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Recebida
                </span>
              </div>
              <Link href="/erp/repasse-franquia" className="font-bold text-blue-600 hover:underline">
                Ver Repasses
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          5. SEÇÃO: ATENÇÃO NECESSÁRIA / ALERTAS OPERACIONAIS
      ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Atenção Necessária • Pendências Operacionais ({alertas.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">Priorizadas por criticidade de negócio</span>
        </div>

        {alertas.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-xs font-bold">
              Tudo em ordem! Nenhuma pendência crítica de formalização, contas vencidas ou repasses bloqueados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {alertas.map((alerta) => (
              <div key={alerta.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                      alerta.prioridade === "alta"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : alerta.prioridade === "media"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {alerta.prioridade}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{alerta.titulo}</h4>
                    <p className="text-[11px] text-slate-500">{alerta.descricao}</p>
                  </div>
                </div>
                <Link
                  href={alerta.href}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>Resolver</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────
          6. PRÓXIMAS ASSEMBLEIAS DOS GRUPOS
      ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Próximas Assembleias dos Grupos
            </h3>
            <Link href="/erp/assembleias" className="text-xs font-bold text-blue-600 hover:underline">
              Ver Todas
            </Link>
          </div>

          {proximasAssembleias.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhuma assembleia agendada para os próximos dias.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {proximasAssembleias.map((a) => (
                <div key={a.grupoId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-slate-900 dark:text-white block font-bold">
                      Grupo {a.codigoGrupo} • {a.administradoraNome}
                    </strong>
                    <span className="text-[11px] text-slate-500">{a.vagasDisponiveis} cotas disponíveis</span>
                  </div>
                  <div className="text-right">
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {new Date(a.dataAssembleia).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            7. ATALHOS OPERACIONAIS RÁPIDOS
        ─────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Atalhos Rápidos
          </h3>
          <p className="text-xs text-slate-500">Ações frequentes disponíveis para o seu perfil.</p>

          <div className="grid gap-2">
            <Link
              href="/admin/leads/novo"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-blue-600" />
                + Novo Lead
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </Link>

            <Link
              href="/admin/propostas/nova"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-indigo-600" />
                + Nova Proposta
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </Link>

            <Link
              href="/erp/contratacoes"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-emerald-600" />
                + Formalizar Contrato
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </Link>

            <Link
              href="/erp/contas-pagar"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-rose-600" />
                + Contas a Pagar
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
