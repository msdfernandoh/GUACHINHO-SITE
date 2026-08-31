"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RaconInspiredHeader, RaconInspiredFooter } from "./racon-inspired-chrome";
import { RACON_LOGO, blockImage, pageAppearanceCss, normalizePageAppearance, visualDefaults, type SitePagesAppearance } from "@/lib/tenant/site-appearance";
import {
  Home,
  Car,
  TrendingUp,
  Truck,
  CheckCircle2,
  ShieldCheck,
  Percent,
  Clock,
  ArrowRight,
  Phone,
  MessageCircle,
  Award,
  Users,
  Building2,
  Lock,
  ChevronRight,
  HelpCircle,
  Sparkles,
  MapPin,
  Briefcase,
  Layers,
} from "lucide-react";

export type ImageObjectFit = "cover" | "contain";
export type ImageObjectPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "left-top";

export type ImagensBanners = {
  hero_banner_url?: string;
  hero_banner_mobile_url?: string;
  hero_object_fit?: ImageObjectFit;
  hero_object_position?: ImageObjectPosition;
  hero_badge?: string;
  hero_titulo?: string;
  hero_subtitulo?: string;
  hero_cta_label?: string;
  hero_cta_url?: string;

  card_veiculos_url?: string;
  card_veiculos_titulo?: string;
  card_veiculos_subtitulo?: string;
  card_veiculos_cta_label?: string;
  card_veiculos_cta_url?: string;
  card_veiculos_object_fit?: ImageObjectFit;
  card_veiculos_object_position?: ImageObjectPosition;
  card_veiculos_ativo?: boolean;

  card_imoveis_url?: string;
  card_imoveis_titulo?: string;
  card_imoveis_subtitulo?: string;
  card_imoveis_cta_label?: string;
  card_imoveis_cta_url?: string;
  card_imoveis_object_fit?: ImageObjectFit;
  card_imoveis_object_position?: ImageObjectPosition;
  card_imoveis_ativo?: boolean;

  card_patrimonio_url?: string;
  card_patrimonio_titulo?: string;
  card_patrimonio_subtitulo?: string;
  card_patrimonio_cta_label?: string;
  card_patrimonio_cta_url?: string;
  card_patrimonio_object_fit?: ImageObjectFit;
  card_patrimonio_object_position?: ImageObjectPosition;
  card_patrimonio_ativo?: boolean;

  banner_filiais_url?: string;
  banner_filiais_titulo?: string;
  banner_filiais_subtitulo?: string;
  banner_filiais_cta_label?: string;
  banner_filiais_cta_url?: string;
  banner_filiais_object_fit?: ImageObjectFit;
  banner_filiais_object_position?: ImageObjectPosition;

  embaixador_stats_url?: string;
  embaixador_stats_titulo?: string;
  embaixador_stats_subtitulo?: string;
  embaixador_stats_object_fit?: ImageObjectFit;
  embaixador_stats_object_position?: ImageObjectPosition;
};

export type RaconTemplateIdentidade = {
  cor_primaria?: string;
  cor_secundaria?: string;
  cor_destaque?: string;
  cor_fundo?: string;
  cor_texto?: string;
  fonte_familia?: string;
  border_radius?: string;
  estilo_botoes?: string;
  estilo_cards?: string;
  imagens_banners?: ImagensBanners;
  paginas_blocos?: SitePagesAppearance;
};

export type RaconTemplateMenu = {
  id: string;
  label: string;
  rota: string;
  ativo_padrao?: boolean;
  ativo?: boolean;
  obrigatorio?: boolean;
};

export type RaconTemplateSecao = {
  id: string;
  tipo: string;
  titulo: string;
  ordem: number;
  habilitada: boolean;
};

export type RaconInspiredHomeProps = {
  empresaNome?: string;
  logoUrl?: string | null;
  identidade?: RaconTemplateIdentidade;
  menus?: RaconTemplateMenu[];
  secoes?: RaconTemplateSecao[];
  footerCopyright?: string;
  telefoneContato?: string;
  whatsappContato?: string;
  isInteractive?: boolean;
  showChrome?: boolean;
};

export function RaconInspiredHome({
  empresaNome = "Racon Consórcios",
  logoUrl = RACON_LOGO,
  identidade = {},
  menus = [],
  secoes = [],
  footerCopyright = "Todos os direitos reservados. Administradora autorizada e fiscalizada pelo Banco Central do Brasil.",
  telefoneContato = "0800 645 4500",
  whatsappContato = "(41) 99999-9999",
  isInteractive = true,
  showChrome = true,
}: RaconInspiredHomeProps) {
  // Cores canônicas da identidade Racon
  const primary = identidade.cor_primaria || "#0099dd"; // Sky Blue Racon
  const secondary = identidade.cor_secundaria || "#0c2340"; // Navy Escuro
  const accent = identidade.cor_destaque || "#ffb800"; // Amarelo Destaque Racon
  const bg = identidade.cor_fundo || "#ffffff";
  const text = identidade.cor_texto || "#0f172a";
  const borderRadius = identidade.border_radius || "16px";

  // Imagens dinâmicas de banners e propaganda
  const banners = identidade.imagens_banners || {};
  const heroBannerImg = blockImage(identidade, "/", "hero", banners.hero_banner_url || "/racon/racon-rubinho-hero.png");
  const cardVeiculoImg = blockImage(identidade, "/", "card_veiculos", banners.card_veiculos_url || "/racon/racon-card-veiculo.png");
  const cardImovelImg = blockImage(identidade, "/", "card_imoveis", banners.card_imoveis_url || "/racon/racon-card-imovel.png");
  const cardPatrimonioImg = blockImage(identidade, "/", "card_patrimonio", banners.card_patrimonio_url || "/racon/racon-card-patrimonio.png");
  const bannerFiliaisImg = blockImage(identidade, "/", "filiais", banners.banner_filiais_url || "/racon/racon-rubinho-conquiste.png");
  const embaixadorStatsImg = blockImage(identidade, "/", "estatisticas", banners.embaixador_stats_url || "/racon/racon-rubinho-apontando.png");


  const appearance = normalizePageAppearance(identidade.paginas_blocos)["/"] || {};
  const imageStyle = (id: string) => ({
    ...(appearance[id]?.imagem_ajuste ? { objectFit: appearance[id].imagem_ajuste } : {}),
    ...(appearance[id]?.imagem_posicao ? { objectPosition: appearance[id].imagem_posicao.replace("-", " ") } : {}),
  });

  // Estado do Simulador Racon no Hero
  const [tipoObjetivo, setTipoObjetivo] = useState<"veiculo" | "casa" | "patrimonio">("casa");
  const [modoSimulacao, setModoSimulacao] = useState<"credito" | "parcela">("credito");
  const [valorSlider, setValorSlider] = useState(250000);

  // Mapeamento dos 3 Objetivos principais Racon
  const objetivosConfig = {
    veiculo: {
      label: "Comprar um veículo?",
      icon: Car,
      min: 40000,
      max: 300000,
      step: 10000,
      prazo: 100,
      fator: 0.0118,
      taxaReduzida: 0.6,
    },
    casa: {
      label: "Comprar uma casa?",
      icon: Home,
      min: 100000,
      max: 1200000,
      step: 25000,
      prazo: 220,
      fator: 0.0055,
      taxaReduzida: 0.5,
    },
    patrimonio: {
      label: "Aumentar patrimônio?",
      icon: TrendingUp,
      min: 200000,
      max: 2000000,
      step: 50000,
      prazo: 180,
      fator: 0.0065,
      taxaReduzida: 0.5,
    },
  };

  const currentObj = objetivosConfig[tipoObjetivo];
  const valorSimulado = Math.max(currentObj.min, Math.min(currentObj.max, valorSlider));
  const parcelaEstimada = valorSimulado * currentObj.fator;
  const parcelaReduzida = parcelaEstimada * currentObj.taxaReduzida;

  // Menus ativos
  const activeMenus =
    menus.length > 0
      ? menus.filter((m) => m.ativo !== false)
      : [
          { id: "sobre", label: "A Racon Consórcios", rota: "/#sobre" },
          { id: "unidades", label: "Unidades", rota: "/#unidades" },
          { id: "como_funciona", label: "Como Funciona", rota: "/#como-funciona" },
          { id: "tipos", label: "Tipos de Consórcio", rota: "/consorcio" },
          { id: "contato", label: "Fale Conosco", rota: "/#contato" },
        ];

  return (
    <div
      data-site-page="/" style={{
        ...visualDefaults(identidade),
        backgroundColor: bg,
        color: text,
        fontFamily: identidade.fonte_familia || "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="site-appearance racon-home min-h-screen w-full selection:bg-cyan-500 selection:text-white text-slate-900"
    >
      <style>{pageAppearanceCss(identidade, "/")}</style>
      {/* ───────────────────────────────────────────────────────────
          1. TOPBAR DISCRETA (PADRÃO RACON: Televendas 0800...)
      ─────────────────────────────────────────────────────────── */}
      {showChrome ? <RaconInspiredHeader empresaNome={empresaNome} logoUrl={logoUrl} identidade={identidade} menus={activeMenus} telefoneContato={telefoneContato} /> : null}

      {/* ───────────────────────────────────────────────────────────
          3. HERO PRINCIPAL: BANNER DO GAROTO PROPAGANDA (RUBINHO) + SIMULADOR RACON
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="hero" data-site-tone="inverse" className="relative overflow-hidden bg-gradient-to-r from-[#0099dd] via-[#00a3e0] to-[#00b2f0] text-white pt-6 pb-12 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            
            {/* Lado Esquerdo: Garoto Propaganda Rubinho + CONQUISTE */}
            <div className="relative flex flex-col justify-end lg:col-span-7 min-h-[320px] lg:min-h-[420px] rounded-3xl overflow-hidden shadow-xl border border-white/20">
              {/* Imagem Real do Rubinho / Banner Racon */}
              <div className="absolute inset-0 bg-[#008fd5]">
                <Image
                  src={heroBannerImg} unoptimized={heroBannerImg.startsWith("https:")}
                  alt="Banner Principal — Embaixador / Garoto Propaganda"
                  fill
                  priority
                  style={{
                    objectFit: banners.hero_object_fit || "cover",
                    objectPosition: banners.hero_object_position || "left top",
                    ...imageStyle("hero"),
                  }}
                />
              </div>

              {/* Overlay de gradiente sutil para legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#008fd5]/90 via-transparent to-transparent" />

              {/* Tipografia de Destaque no Rodapé do Banner */}
              <div className="relative p-6 sm:p-8 space-y-2 z-10">
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-md">
                  {banners.hero_badge || "Campanha Oficial • Realize suas Conquistas"}
                </span>
                <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white drop-shadow-md">
                  {banners.hero_titulo || "CONQUISTE"}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-white/95 max-w-md drop-shadow">
                  {banners.hero_subtitulo ||
                    "Acelere suas metas com planos sob medida, contemplações por sorteio e lances livres ou fixos."}
                </p>
              </div>
            </div>


            {/* Lado Direito: SIMULADOR FLUTUANTE RACON */}
            <div className="lg:col-span-5">
              <div data-site-block="simulador_home" data-site-tone="light" className="rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-slate-100 space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 text-center">
                    O que você deseja realizar?
                  </h3>
                </div>

                {/* 3 Opções de Objetivos (Carro / Casa / Patrimônio) */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      { id: "veiculo", label: "Comprar um veículo?", icon: Car },
                      { id: "casa", label: "Comprar uma casa?", icon: Home },
                      { id: "patrimonio", label: "Aumentar patrimônio?", icon: TrendingUp },
                    ] as const
                  ).map((opt) => {
                    const isSelected = tipoObjetivo === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setTipoObjetivo(opt.id);
                          setValorSlider(objetivosConfig[opt.id].min * 2);
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? "border-[#008fd5] bg-sky-50/70 text-[#008fd5] shadow-xs ring-2 ring-[#008fd5]/30 font-black"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isSelected ? "text-[#008fd5]" : "text-slate-500"}`} />
                        <span className="mt-1 text-[10px] leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Alternador: Simular por Crédito ou Parcela */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-700">Simular o plano</span>
                  <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setModoSimulacao("credito")}
                      className={`rounded-full px-3 py-1 transition-all ${
                        modoSimulacao === "credito" ? "bg-[#008fd5] text-white shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoSimulacao("parcela")}
                      className={`rounded-full px-3 py-1 transition-all ${
                        modoSimulacao === "parcela" ? "bg-[#008fd5] text-white shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Parcela
                    </button>
                  </div>
                </div>

                {/* Slider Interativo */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>R$ {(currentObj.min / 1000).toFixed(0)} mil</span>
                    <span className="text-sm font-black text-[#008fd5]">
                      R$ {valorSimulado.toLocaleString("pt-BR")},00
                    </span>
                    <span>R$ {(currentObj.max / 1000).toFixed(0)} mil</span>
                  </div>
                  <input
                    type="range"
                    min={currentObj.min}
                    max={currentObj.max}
                    step={currentObj.step}
                    value={valorSimulado}
                    onChange={(e) => setValorSlider(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#008fd5]"
                  />
                </div>

                {/* Estimativa de Parcela */}
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-emerald-700">
                      ⚡ Parcela Reduzida
                    </span>
                    <strong className="text-base font-black text-emerald-700">
                      R$ {parcelaReduzida.toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">
                      Prazo Médio
                    </span>
                    <strong className="text-sm font-black text-slate-800">
                      até {currentObj.prazo} meses
                    </strong>
                  </div>
                </div>

                {/* Botão Amarelo de Ação Racon */}
                <Link
                  href={`/simulador?objetivo=${tipoObjetivo}&credito=${valorSimulado}`}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffb800] py-3.5 text-xs font-black text-slate-950 shadow-md hover:bg-[#f5aa00] transition-colors text-center"
                >
                  <span>Simular Agora</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          4. BLOCO RACON: "A RACON TEM O CONSÓRCIO PERFEITO PARA VOCÊ"
             3 CARDS FOTOGRÁFICOS DE PRODUTOS COM BOTÃO "CONQUISTE AGORA"
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="produtos" className="py-14 sm:py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              A Racon tem <span className="text-[#008fd5]">o consórcio perfeito</span> para você contemplar suas conquistas!
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {/* Card 1: Veículos */}
            {banners.card_veiculos_ativo !== false && (
              <div data-site-block="card_veiculos" data-site-tone="inverse" className="group relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-900 text-white min-h-[300px] flex flex-col justify-between p-6">
                <Image
                  src={cardVeiculoImg} unoptimized={cardVeiculoImg.startsWith("https:")}
                  alt={banners.card_veiculos_titulo || "Dirija rumo à sua independência"}
                  fill
                  style={{
                    objectFit: banners.card_veiculos_object_fit || "cover",
                    objectPosition: banners.card_veiculos_object_position || "center",
                    ...imageStyle("card_veiculos"),
                  }}
                  className="group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="relative z-10 space-y-1">
                  <h3 className="text-lg font-black text-white">
                    {banners.card_veiculos_titulo || "Dirija rumo à sua independência"}
                  </h3>
                  <p className="text-xs text-slate-200">
                    {banners.card_veiculos_subtitulo ||
                      "Conte com um consórcio de veículos seguro e até 120 meses para pagar."}
                  </p>
                </div>

                <div className="relative z-10 pt-6">
                  <Link
                    href={banners.card_veiculos_cta_url || "/consorcio/carro-sem-entrada"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00a3e0] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#008fd5] transition-colors"
                  >
                    <span>{banners.card_veiculos_cta_label || "Conquiste agora"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Card 2: Imóveis */}
            {banners.card_imoveis_ativo !== false && (
              <div data-site-block="card_imoveis" data-site-tone="inverse" className="group relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-900 text-white min-h-[300px] flex flex-col justify-between p-6">
                <Image
                  src={cardImovelImg} unoptimized={cardImovelImg.startsWith("https:")}
                  alt={banners.card_imoveis_titulo || "Conquiste a casa própria"}
                  fill
                  style={{
                    objectFit: banners.card_imoveis_object_fit || "cover",
                    objectPosition: banners.card_imoveis_object_position || "center",
                    ...imageStyle("card_imoveis"),
                  }}
                  className="group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="relative z-10 space-y-1">
                  <h3 className="text-lg font-black text-white">
                    {banners.card_imoveis_titulo || "Conquiste a casa própria"}
                  </h3>
                  <p className="text-xs text-slate-200">
                    {banners.card_imoveis_subtitulo ||
                      "Invista no seu futuro com um consórcio de imóveis que cabe perfeitamente no seu bolso."}
                  </p>
                </div>

                <div className="relative z-10 pt-6">
                  <Link
                    href={banners.card_imoveis_cta_url || "/consorcio/imovel-parcela-reduzida"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00a3e0] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#008fd5] transition-colors"
                  >
                    <span>{banners.card_imoveis_cta_label || "Conquiste agora"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Card 3: Patrimônio */}
            {banners.card_patrimonio_ativo !== false && (
              <div data-site-block="card_patrimonio" data-site-tone="inverse" className="group relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-900 text-white min-h-[300px] flex flex-col justify-between p-6">
                <Image
                  src={cardPatrimonioImg} unoptimized={cardPatrimonioImg.startsWith("https:")}
                  alt={banners.card_patrimonio_titulo || "Amplie seu patrimônio"}
                  fill
                  style={{
                    objectFit: banners.card_patrimonio_object_fit || "cover",
                    objectPosition: banners.card_patrimonio_object_position || "center",
                    ...imageStyle("card_patrimonio"),
                  }}
                  className="group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="relative z-10 space-y-1">
                  <h3 className="text-lg font-black text-white">
                    {banners.card_patrimonio_titulo || "Amplie seu patrimônio"}
                  </h3>
                  <p className="text-xs text-slate-200">
                    {banners.card_patrimonio_subtitulo ||
                      "Faça um investimento financeiro inteligente de forma planejada, rentável e sem juros bancários."}
                  </p>
                </div>

                <div className="relative z-10 pt-6">
                  <Link
                    href={banners.card_patrimonio_cta_url || "/simulador"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00a3e0] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#008fd5] transition-colors"
                  >
                    <span>{banners.card_patrimonio_cta_label || "Conquiste agora"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          5. BLOCO: AFINAL, O QUE É CONSÓRCIO? & VANTAGENS
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="educacao" id="como-funciona" className="py-14 sm:py-20 bg-slate-50 border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-16">
          
          {/* Parte Superior: Afinal o que é consórcio? */}
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#008fd5]">
                Educação Financeira
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                Afinal, o que é <span className="text-[#008fd5]">consórcio</span>?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                O consórcio é uma forma de autofinanciamento inteligente onde pessoas com o mesmo objetivo se unem em grupo para poupar juntas e conquistar bens sem pagar taxas de juros bancários.
              </p>
              <div className="pt-2">
                <Link
                  href="/simulador"
                  className="inline-flex items-center gap-2 rounded-full bg-[#008fd5] px-6 py-3 text-xs font-black text-white shadow-md hover:bg-[#007cb8] transition-colors"
                >
                  <span>Saiba mais</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
                <h4 className="text-xs font-black text-slate-900">Como funciona na prática?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Todo mês ocorrem assembleias onde cotistas são contemplados por sorteio ou por lances livres e fixos.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
                <h4 className="text-xs font-black text-slate-900">O que é possível comprar?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Imóveis novos ou usados, terrenos, construção, reformas, carros, caminhões, maquinários agrícolas e serviços.
                </p>
              </div>
            </div>
          </div>

          {/* Parte Inferior: Vantagens de ter um Consórcio Racon */}
          <div className="space-y-8">
            <div className="text-center space-y-1">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Vantagens de ter um <span className="text-[#008fd5]">Consórcio Racon</span>
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Percent,
                  title: "Sem Juros",
                  desc: "Apenas taxa de administração diluída ao longo de todo o plano.",
                },
                {
                  icon: ShieldCheck,
                  title: "Planejamento Financeiro",
                  desc: "Parcelas planejadas que respeitam e protegem seu orçamento.",
                },
                {
                  icon: Clock,
                  title: "Flexibilidade de Pagamento",
                  desc: "Possibilidade de parcelas reduzidas e prazos sob medida.",
                },
                {
                  icon: Award,
                  title: "Lances e Sorteio",
                  desc: "Múltiplas opções de contemplação mensalmente nas assembleias.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs text-center space-y-2 hover:border-[#008fd5] transition-colors"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#008fd5]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center pt-2">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 rounded-full bg-[#008fd5] px-8 py-3 text-xs font-black text-white shadow-md hover:bg-[#007cb8] transition-colors"
              >
                <span>Simule seu Consórcio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          6. BLOCO: ENCONTRE A RACON MAIS PRÓXIMA DE VOCÊ (BANNER RUBINHO)
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="filiais" id="unidades" className="py-14 sm:py-18 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid sm:grid-cols-12 gap-8 items-center rounded-3xl bg-slate-50 p-6 sm:p-10 border border-slate-200">
            {/* Banner Quadrado Rubinho Conquiste */}
            <div className="sm:col-span-5 relative h-56 w-full rounded-2xl overflow-hidden shadow-md">
              <Image
                src={bannerFiliaisImg} unoptimized={bannerFiliaisImg.startsWith("https:")}
                alt={banners.banner_filiais_titulo || "Encontre as Unidades e Filiais"}
                fill
                style={{
                  objectFit: banners.banner_filiais_object_fit || "cover",
                  objectPosition: banners.banner_filiais_object_position || "center",
                    ...imageStyle("filiais"),
                }}
              />
            </div>

            {/* Texto e CTA */}
            <div className="sm:col-span-7 space-y-4">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">
                {banners.banner_filiais_titulo || (
                  <>
                    Encontre a <span className="text-[#008fd5]">Racon Consórcios</span> mais próxima de você
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {banners.banner_filiais_subtitulo ||
                  "A Racon está presente em diversas regiões do país com atendimento especializado para você planejar seu investimento com segurança e transparência."}
              </p>
              <div className="pt-2">
                <Link
                  href={banners.banner_filiais_cta_url || "/#unidades"}
                  className="inline-flex items-center gap-2 rounded-full bg-[#008fd5] px-6 py-3 text-xs font-black text-white shadow-sm hover:bg-[#007cb8] transition-colors"
                >
                  <span>{banners.banner_filiais_cta_label || "Acesse as filiais"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          7. BLOCO: CONQUISTE COM A RACON (STATS + RUBINHO APONTANDO)
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="estatisticas" data-site-tone="inverse" id="sobre" className="scroll-mt-24 relative overflow-hidden bg-[#0c2340] text-white py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            
            {/* Estatísticas */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {banners.embaixador_stats_titulo || (
                  <>
                    Conquiste com a <span className="text-[#00a3e0]">Racon Consórcios</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
                {banners.embaixador_stats_subtitulo ||
                  "Mais de três décadas de solidez, realizando sonhos e construindo patrimônios sólidos em todo o Brasil."}
              </p>

              {/* Grid 4 KPIs */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
                  <strong className="block text-2xl font-black text-amber-300">+500</strong>
                  <span className="text-[11px] text-slate-300 font-medium">pontos de venda</span>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
                  <strong className="block text-2xl font-black text-white">+ R$ 6 BI</strong>
                  <span className="text-[11px] text-slate-300 font-medium">em créditos disponibilizados</span>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
                  <strong className="block text-2xl font-black text-white">19</strong>
                  <span className="text-[11px] text-slate-300 font-medium">estados com presença física</span>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
                  <strong className="block text-2xl font-black text-emerald-300">+120 mil</strong>
                  <span className="text-[11px] text-slate-300 font-medium">cotas comercializadas</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/simulador"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00a3e0] px-8 py-3 text-xs font-black text-white shadow-md hover:bg-[#008fd5] transition-colors"
                >
                  <span>Simular agora</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Imagem Rubinho Apontando */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative h-72 w-72 sm:h-80 sm:w-80 rounded-full overflow-hidden border-4 border-[#00a3e0]/40 shadow-2xl bg-[#008fd5]">
                <Image
                  src={embaixadorStatsImg} unoptimized={embaixadorStatsImg.startsWith("https:")}
                  alt="Garoto Propaganda / Embaixador Oficial"
                  fill
                  style={{
                    objectFit: banners.embaixador_stats_object_fit || "cover",
                    objectPosition: banners.embaixador_stats_object_position || "top",
                    ...imageStyle("estatisticas"),
                  }}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          8. BLOCO: SEJA UM FRANQUEADO
      ─────────────────────────────────────────────────────────── */}
      <section data-site-block="franquia" id="seja-franqueado" className="py-14 sm:py-20 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Seja um <span className="text-[#008fd5]">Franqueado</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Faça parte de uma das maiores e mais rentáveis redes de consórcios do Brasil.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Marca Forte",
                desc: "Associação direta com uma das marcas mais admiradas e consolidadas do setor financeiro.",
              },
              {
                title: "Treinamento Especializado",
                desc: "Capacitação contínua para sua equipe comercial com metodologia comprovada.",
              },
              {
                title: "Suporte ao Parceiro",
                desc: "Assessoria operacional, jurídica e comercial com atendimento dedicado.",
              },
              {
                title: "Incentivo às Vendas",
                desc: "Campanhas oficiais, premiações e suporte publicitário de alcance nacional.",
              },
              {
                title: "Alta Margem",
                desc: "Estrutura de comissionamento agressiva com recebimento pontual e seguro.",
              },
              {
                title: "Rentabilidade",
                desc: "Retorno consistente e escalabilidade para o seu negócio de assessoria financeira.",
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-slate-50 p-5 border border-slate-200 space-y-2"
              >
                <h4 className="text-xs font-black text-slate-900">{card.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/simulador"
              className="inline-flex items-center gap-2 rounded-full bg-[#008fd5] px-8 py-3 text-xs font-black text-white shadow-md hover:bg-[#007cb8] transition-colors"
            >
              <span>Saiba mais</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          9. FOOTER INSTITUCIONAL CORPORATIVO COM BACEN
      ─────────────────────────────────────────────────────────── */}
      {showChrome ? <RaconInspiredFooter empresaNome={empresaNome} identidade={identidade} menus={activeMenus} telefoneContato={telefoneContato} whatsappContato={whatsappContato} footerCopyright={footerCopyright} /> : null}
    </div>
  );
}
