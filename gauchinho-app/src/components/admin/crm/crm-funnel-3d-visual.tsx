"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { CrmDashboardData, CrmFunilMacroTier, CrmFunilEtapaStats } from "@/lib/crm/dashboard-query";
import {
  Eye,
  Mail,
  Magnet,
  Handshake,
  Trophy,
  Sparkles,
  ArrowRight,
  Layers,
  Flame,
  CalendarCheck,
  TrendingDown,
  RotateCcw,
  Zap,
} from "lucide-react";

export function CrmFunnel3dVisual({ data }: { data: CrmDashboardData }) {
  const { macroFunil, funil, totaisGerais } = data;
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [modoVisao, setModoVisao] = useState<"macro" | "detalhado">("macro");

  // Paleta e ícones para cada nível macro
  const tierIconMap = {
    eye: Eye,
    mail: Mail,
    magnet: Magnet,
    handshake: Handshake,
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/95 via-zinc-950/90 to-black p-6 shadow-2xl backdrop-blur-md sm:p-8">
      {/* Luzes decorativas de fundo (ambient glows) */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-cyan-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-950/50 px-3 py-1 text-xs font-semibold text-purple-300 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Módulo Executivo • Funil Dimensional
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400">Pipeline de Vendas & Conversão</span>
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Funil Comercial de Alta Performance
          </h2>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Distribuição em tempo real de <strong className="text-zinc-200">Valor de Crédito</strong>, <strong className="text-emerald-400">Valor de Parcela Mensal</strong> e <strong className="text-blue-400">Volume de Leads</strong> em cada nível da esteira
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Modo */}
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setModoVisao("macro")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                modoVisao === "macro"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Visão Macro 3D (4 Fases)
            </button>
            <button
              type="button"
              onClick={() => setModoVisao("detalhado")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                modoVisao === "detalhado"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Visão Detalhada (12 Etapas)
            </button>
          </div>

          <Link
            href="/admin/crm/pipeline"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-bold text-zinc-200 shadow transition hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
          >
            Abrir Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. BARRA DE TOTALIZADORES GLOBAIS (3 GRANDES NÚMEROS) */}
      <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {/* Crédito Total em Trânsito */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 shadow-sm backdrop-blur-xs">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            Crédito Total em Trânsito
          </p>
          <p className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {formatCurrency(totaisGerais.totalCredito)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Montante negociado nas 12 etapas
          </p>
        </div>

        {/* Parcela Mensal Recorrente */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 shadow-sm backdrop-blur-xs">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            Parcelas Mensais Estimadas
          </p>
          <p className="mt-2 text-xl font-extrabold tracking-tight text-emerald-300 sm:text-2xl">
            {formatCurrency(totaisGerais.totalParcelaMensal)}
            <span className="text-xs font-normal text-emerald-400/80"> /mês</span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Capacidade e parcelas da carteira
          </p>
        </div>

        {/* Total de Leads Ativos */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 shadow-sm backdrop-blur-xs">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Total de Oportunidades
          </p>
          <p className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {totaisGerais.totalLeads} <span className="text-sm font-normal text-zinc-400">leads</span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Ticket médio: {formatCurrency(totaisGerais.ticketMedioCredito)}
          </p>
        </div>

        {/* Vendas Fechadas e Conversão */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 shadow-sm backdrop-blur-xs">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            Conversão do Funil
          </p>
          <p className="mt-2 text-xl font-extrabold tracking-tight text-amber-300 sm:text-2xl">
            {data.kpis.taxaConversao.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Fundo do funil: {formatCurrency(data.kpis.vendasFechadasMesValor)}
          </p>
        </div>
      </div>

      {/* 3. VISÃO MACRO 3D (4 FASES COM VISUAL AGRESSIVO DE FUNIL E RIBBONS) */}
      {modoVisao === "macro" ? (
        <div className="relative z-10 mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* LADO ESQUERDO: O GRÁFICO DO FUNIL GEOMÉTRICO 3D (SVG) */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative w-full max-w-sm">
              <svg
                viewBox="0 0 400 480"
                className="w-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] filter transition-all duration-300"
              >
                <defs>
                  {/* Gradiente Nível 1 - Roxo / Indigo */}
                  <linearGradient id="grad-tier-1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="60%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient id="grad-tier-1-top" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>

                  {/* Gradiente Nível 2 - Ciano / Turquesa */}
                  <linearGradient id="grad-tier-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="60%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#0e7490" />
                  </linearGradient>

                  {/* Gradiente Nível 3 - Rose / Coral */}
                  <linearGradient id="grad-tier-3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="60%" stopColor="#e11d48" />
                    <stop offset="100%" stopColor="#be123c" />
                  </linearGradient>

                  {/* Gradiente Nível 4 - Dourado / Ouro / Esmeralda */}
                  <linearGradient id="grad-tier-4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="60%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>

                  {/* Efeito de iluminação 3D lateral esquerda */}
                  <linearGradient id="facet-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
                    <stop offset="30%" stopColor="#fff" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* CAMADA 1 — TOPO DO FUNIL */}
                <g
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setActiveTierId("nivel-1-topo")}
                  onMouseLeave={() => setActiveTierId(null)}
                  style={{
                    transform: activeTierId === "nivel-1-topo" ? "scale(1.02) translateY(-2px)" : "scale(1)",
                    transformOrigin: "center top",
                  }}
                >
                  {/* Topo Elíptico 3D da Boca do Funil */}
                  <ellipse cx="200" cy="30" rx="190" ry="24" fill="url(#grad-tier-1-top)" stroke="#c4b5fd" strokeWidth="1.5" />
                  {/* Corpo Trapezoidal */}
                  <polygon points="10,30 390,30 325,130 75,130" fill="url(#grad-tier-1)" />
                  <polygon points="10,30 390,30 325,130 75,130" fill="url(#facet-shadow)" />
                  <ellipse cx="200" cy="130" rx="125" ry="12" fill="#4c1d95" opacity="0.6" />
                  
                  {/* Textos internos */}
                  <text x="200" y="70" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="15" letterSpacing="1">
                    TOPO FUNIL
                  </text>
                  <text x="200" y="92" textAnchor="middle" fill="#e0e7ff" fontWeight="600" fontSize="12">
                    {macroFunil[0]?.totalLeads ?? 0} leads • {formatCurrency(macroFunil[0]?.valorCreditoTotal ?? 0)}
                  </text>
                </g>

                {/* CONECTOR TAXA DE PASSAGEM 1 -> 2 */}
                <g transform="translate(200, 138)">
                  <rect x="-42" y="-9" width="84" height="18" rx="9" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <text x="0" y="3.5" textAnchor="middle" fill="#a1a1aa" fontWeight="700" fontSize="9">
                    ↓ {macroFunil[1]?.taxaPassagem ?? 0}% avanço
                  </text>
                </g>

                {/* CAMADA 2 — MEIO SUPERIOR (QUALIFICAÇÃO) */}
                <g
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setActiveTierId("nivel-2-meio-sup")}
                  onMouseLeave={() => setActiveTierId(null)}
                  style={{
                    transform: activeTierId === "nivel-2-meio-sup" ? "scale(1.02) translateY(-2px)" : "scale(1)",
                    transformOrigin: "center",
                  }}
                >
                  <polygon points="75,142 325,142 265,242 135,242" fill="url(#grad-tier-2)" />
                  <polygon points="75,142 325,142 265,242 135,242" fill="url(#facet-shadow)" />
                  <ellipse cx="200" cy="242" rx="65" ry="8" fill="#155e75" opacity="0.6" />

                  <text x="200" y="185" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="14" letterSpacing="1">
                    TOPO-MEIO
                  </text>
                  <text x="200" y="205" textAnchor="middle" fill="#cffafe" fontWeight="600" fontSize="12">
                    {macroFunil[1]?.totalLeads ?? 0} leads • {formatCurrency(macroFunil[1]?.valorCreditoTotal ?? 0)}
                  </text>
                </g>

                {/* CONECTOR TAXA DE PASSAGEM 2 -> 3 */}
                <g transform="translate(200, 250)">
                  <rect x="-42" y="-9" width="84" height="18" rx="9" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <text x="0" y="3.5" textAnchor="middle" fill="#a1a1aa" fontWeight="700" fontSize="9">
                    ↓ {macroFunil[2]?.taxaPassagem ?? 0}% avanço
                  </text>
                </g>

                {/* CAMADA 3 — MEIO INFERIOR (OPORTUNIDADE) */}
                <g
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setActiveTierId("nivel-3-meio-inf")}
                  onMouseLeave={() => setActiveTierId(null)}
                  style={{
                    transform: activeTierId === "nivel-3-meio-inf" ? "scale(1.02) translateY(-2px)" : "scale(1)",
                    transformOrigin: "center",
                  }}
                >
                  <polygon points="135,254 265,254 220,354 180,354" fill="url(#grad-tier-3)" />
                  <polygon points="135,254 265,254 220,354 180,354" fill="url(#facet-shadow)" />
                  <ellipse cx="200" cy="354" rx="20" ry="5" fill="#881337" opacity="0.6" />

                  <text x="200" y="295" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="13" letterSpacing="0.8">
                    MEIO FUNIL
                  </text>
                  <text x="200" y="315" textAnchor="middle" fill="#ffe4e6" fontWeight="600" fontSize="11">
                    {macroFunil[2]?.totalLeads ?? 0} leads • {formatCurrency(macroFunil[2]?.valorCreditoTotal ?? 0)}
                  </text>
                </g>

                {/* CONECTOR TAXA DE PASSAGEM 3 -> 4 */}
                <g transform="translate(200, 362)">
                  <rect x="-42" y="-9" width="84" height="18" rx="9" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                  <text x="0" y="3.5" textAnchor="middle" fill="#a1a1aa" fontWeight="700" fontSize="9">
                    ↓ {macroFunil[3]?.taxaPassagem ?? 0}% fecham
                  </text>
                </g>

                {/* CAMADA 4 — FUNDO DO FUNIL (PONTA DE CONVERSÃO / VENDA) */}
                <g
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setActiveTierId("nivel-4-fundo")}
                  onMouseLeave={() => setActiveTierId(null)}
                  style={{
                    transform: activeTierId === "nivel-4-fundo" ? "scale(1.04) translateY(-2px)" : "scale(1)",
                    transformOrigin: "center bottom",
                  }}
                >
                  {/* Ponta cônica do funil */}
                  <polygon points="180,366 220,366 200,455" fill="url(#grad-tier-4)" />
                  <polygon points="180,366 220,366 200,455" fill="url(#facet-shadow)" />
                  <circle cx="200" cy="455" r="5" fill="#10b981" />

                  <text x="200" y="398" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="11" letterSpacing="0.5">
                    FUNDO
                  </text>
                  <text x="200" y="415" textAnchor="middle" fill="#fef3c7" fontWeight="700" fontSize="10">
                    {macroFunil[3]?.totalLeads ?? 0} vendas
                  </text>
                </g>
              </svg>
            </div>
            <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Taxa Global de Conversão: <strong className="text-amber-400">{data.kpis.taxaConversao.toFixed(1)}%</strong>
            </p>
          </div>

          {/* LADO DIREITO: AS 4 LEGENDAS / RIBBONS CONECTADAS (ESTILO PUZZLE DA IMAGEM) */}
          <div className="space-y-4 lg:col-span-7">
            {macroFunil.map((tier) => {
              const isHovered = activeTierId === tier.id;
              const IconComponent = tierIconMap[tier.icone] || Sparkles;

              // Cores dinâmicas dos ribbons
              const borderClasses = {
                "nivel-1-topo": "border-purple-500/40 hover:border-purple-400 bg-purple-950/15",
                "nivel-2-meio-sup": "border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/15",
                "nivel-3-meio-inf": "border-rose-500/40 hover:border-rose-400 bg-rose-950/15",
                "nivel-4-fundo": "border-amber-500/50 hover:border-amber-400 bg-amber-950/20",
              }[tier.id];

              const badgeColors = {
                "nivel-1-topo": "bg-purple-500/20 text-purple-300 border-purple-500/30",
                "nivel-2-meio-sup": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                "nivel-3-meio-inf": "bg-rose-500/20 text-rose-300 border-rose-500/30",
                "nivel-4-fundo": "bg-amber-500/25 text-amber-300 border-amber-500/40",
              }[tier.id];

              const iconBgColors = {
                "nivel-1-topo": "bg-purple-600 text-white shadow-purple-500/40",
                "nivel-2-meio-sup": "bg-cyan-600 text-white shadow-cyan-500/40",
                "nivel-3-meio-inf": "bg-rose-600 text-white shadow-rose-500/40",
                "nivel-4-fundo": "bg-amber-500 text-zinc-950 shadow-amber-500/40",
              }[tier.id];

              return (
                <div
                  key={tier.id}
                  onMouseEnter={() => setActiveTierId(tier.id)}
                  onMouseLeave={() => setActiveTierId(null)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-lg transition-all duration-300 sm:flex-row sm:items-center ${borderClasses} ${
                    isHovered ? "scale-[1.01] shadow-2xl ring-1 ring-zinc-700" : ""
                  }`}
                >
                  {/* Conector puzzle / aba lateral esquerda */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 transition-all"
                    style={{ backgroundColor: tier.corHex }}
                  />

                  {/* Informações da Etapa / Conceito */}
                  <div className="pl-3 sm:max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeColors}`}>
                        {tier.nomeNivel}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-300">
                        {tier.categoria}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {tier.subtitulo}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Etapas: {tier.etapasNomes.join(" • ")}
                    </p>
                  </div>

                  {/* AS 3 INFORMAÇÕES FUNDAMENTAIS (CRÉDITO, PARCELA E LEADS) */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 pl-3 sm:mt-0 sm:pl-0">
                    {/* 1. Valor de Crédito */}
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Valor Crédito
                      </p>
                      <p className="text-sm font-extrabold text-zinc-100 sm:text-base">
                        {formatCurrency(tier.valorCreditoTotal)}
                      </p>
                    </div>

                    {/* 2. Valor da Parcela */}
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Valor Parcela
                      </p>
                      <p className="text-sm font-extrabold text-emerald-300 sm:text-base">
                        {formatCurrency(tier.valorParcelaTotal)}
                        <span className="text-[10px] font-normal text-emerald-400/80">/mês</span>
                      </p>
                    </div>

                    {/* 3. Número de Leads */}
                    <div className="flex flex-col items-start sm:items-end">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        Oportunidades
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-white sm:text-base">
                        {tier.totalLeads}
                        <span className="text-[11px] font-normal text-zinc-400">
                          ({tier.percentualTotal.toFixed(1)}%)
                        </span>
                      </span>
                    </div>

                    {/* Ícone Redondo Conectado da Ponta (Referência Visual) */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md transition-all group-hover:scale-110 ${iconBgColors}`}
                    >
                      <IconComponent className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 4. VISÃO DETALHADA (12 ETAPAS COMPLETAS COM CRÉDITO, PARCELA E LEADS) */
        <div className="relative z-10 mt-8 space-y-2.5">
          <p className="text-xs font-semibold text-zinc-400">
            Detalhamento analítico de cada uma das 12 fases do CRM com Crédito, Parcela Estimada e Volume de Oportunidades:
          </p>

          {funil.map((etapa, idx) => {
            const widthPct = Math.max(3, Math.min(100, etapa.percentual));
            return (
              <div
                key={etapa.id}
                className="group flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 transition hover:border-zinc-700 hover:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Nome e ordem */}
                <div className="flex items-center gap-3 sm:w-60 shrink-0">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white shadow-sm"
                    style={{ backgroundColor: etapa.cor }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <Link
                      href={`/admin/crm/pipeline?etapa_id=${etapa.id}`}
                      className="text-xs font-bold text-zinc-200 transition hover:text-white group-hover:underline"
                    >
                      {etapa.nome}
                    </Link>
                    <p className="text-[10px] text-zinc-500">
                      {etapa.totalLeads} {etapa.totalLeads === 1 ? "oportunidade" : "oportunidades"}
                    </p>
                  </div>
                </div>

                {/* Barra proporcional visual */}
                <div className="relative flex-1 px-2">
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: etapa.cor,
                      }}
                    />
                  </div>
                </div>

                {/* As 3 Informações fundamentais por etapa */}
                <div className="flex flex-wrap items-center justify-end gap-5 shrink-0 text-right">
                  {/* Crédito */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                      Crédito
                    </span>
                    <span className="text-xs font-bold text-zinc-100">
                      {formatCurrency(etapa.valorTotal)}
                    </span>
                  </div>

                  {/* Parcela */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Parcela
                    </span>
                    <span className="text-xs font-bold text-emerald-300">
                      {formatCurrency(etapa.valorParcelaTotal)}
                    </span>
                  </div>

                  {/* Leads */}
                  <div className="w-16">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 block">
                      Volume
                    </span>
                    <span className="text-xs font-bold text-white">
                      {etapa.totalLeads} ({etapa.percentual.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. RODAPÉ EXECUTIVO DE RECUPERAÇÃO E POTENCIAL */}
      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          {/* Leads Perdidos */}
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-zinc-400">Leads Perdidos / Desqualificados:</span>
            <strong className="text-red-300">
              {totaisGerais.leadsPerdidos} ({formatCurrency(totaisGerais.creditoPerdido)})
            </strong>
          </div>

          {/* Stand-by / Futuro */}
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
            <span className="text-zinc-400">Oportunidades em Stand-by:</span>
            <strong className="text-purple-300">
              {totaisGerais.leadsStandby} ({formatCurrency(totaisGerais.creditoStandby)})
            </strong>
          </div>
        </div>

        <Link
          href="/admin/crm/pipeline?perdidos=1"
          className="inline-flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300 hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reaquecer Oportunidades no Pipeline →
        </Link>
      </div>
    </div>
  );
}
