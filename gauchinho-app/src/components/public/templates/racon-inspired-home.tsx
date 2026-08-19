"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Home,
  Car,
  Truck,
  Tractor,
  CheckCircle2,
  ShieldCheck,
  Percent,
  Clock,
  TrendingUp,
  ArrowRight,
  Phone,
  MessageCircle,
  HelpCircle,
  Award,
  Users,
  Building2,
  Lock,
} from "lucide-react";

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
};

export type RaconTemplateMenu = {
  id: string;
  label: string;
  rota: string;
  ativo_padrao?: boolean;
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
};

export function RaconInspiredHome({
  empresaNome = "Gauchinho Consórcios",
  logoUrl,
  identidade = {},
  menus = [],
  secoes = [],
  footerCopyright = "Todos os direitos reservados. Administradora autorizada e fiscalizada pelo Banco Central do Brasil.",
  telefoneContato = "(41) 3000-0000",
  whatsappContato = "(41) 99999-9999",
  isInteractive = true,
}: RaconInspiredHomeProps) {
  // Tokens de cor com fallback para o padrão canônico Racon
  const primary = identidade.cor_primaria || "#0066cc"; // Royal Blue Racon
  const secondary = identidade.cor_secundaria || "#0c2340"; // Navy Escuro Racon
  const accent = identidade.cor_destaque || "#ffb800"; // Amarelo Destaque Racon
  const bg = identidade.cor_fundo || "#ffffff";
  const text = identidade.cor_texto || "#0f172a";
  const borderRadius = identidade.border_radius || "16px";

  // Estado do Simulador no Hero
  const [segmentoSimulador, setSegmentoSimulador] = useState<"imovel" | "auto" | "pesados" | "agro">("imovel");
  const [creditoSelecionado, setCreditoSelecionado] = useState(250000);

  // Mapeamento de faixas e estimativas por segmento
  const opcoesSegmento = {
    imovel: {
      label: "Imóveis",
      icon: Home,
      valores: [150000, 250000, 400000, 600000, 1000000],
      prazo: 220,
      taxaReduzida: 0.5,
      fatorIntegral: 0.0055,
      descricao: "Casas, apartamentos, terrenos, construção e reformas.",
    },
    auto: {
      label: "Veículos",
      icon: Car,
      valores: [45000, 75000, 120000, 180000, 250000],
      prazo: 100,
      taxaReduzida: 0.6,
      fatorIntegral: 0.0118,
      descricao: "Carros novos e seminovos nacionais e importados.",
    },
    pesados: {
      label: "Pesados & Frotas",
      icon: Truck,
      valores: [200000, 350000, 500000, 800000, 1200000],
      prazo: 120,
      taxaReduzida: 0.6,
      fatorIntegral: 0.0098,
      descricao: "Caminhões, cavalos mecânicos, carretas e vans.",
    },
    agro: {
      label: "Agro & Máquinas",
      icon: Tractor,
      valores: [180000, 300000, 500000, 900000, 1500000],
      prazo: 144,
      taxaReduzida: 0.6,
      fatorIntegral: 0.0084,
      descricao: "Tratores, colheitadeiras e implementos agrícolas.",
    },
  };

  const currentOpcao = opcoesSegmento[segmentoSimulador];
  const parcelaIntegral = creditoSelecionado * currentOpcao.fatorIntegral;
  const parcelaReduzida = parcelaIntegral * currentOpcao.taxaReduzida;

  // Filtrar seções habilitadas ordenadas
  const secoesMap = new Map(secoes.map((s) => [s.id, s.habilitada]));
  const isSecaoHabilitada = (id: string, defaultVal = true) =>
    secoesMap.has(id) ? (secoesMap.get(id) ?? false) : defaultVal;

  const activeMenus = menus.length > 0 ? menus.filter((m) => m.ativo_padrao !== false) : [
    { id: "imoveis", label: "Imóveis", rota: "/consorcio/imoveis" },
    { id: "veiculos", label: "Veículos", rota: "/consorcio/veiculos" },
    { id: "pesados", label: "Pesados", rota: "/consorcio/pesados" },
    { id: "grupos", label: "Grupos & Cotas", rota: "/grupos" },
    { id: "como_funciona", label: "Como Funciona", rota: "/#como-funciona" },
    { id: "sobre", label: "Sobre Nós", rota: "/#sobre" },
  ];

  return (
    <div
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: identidade.fonte_familia || "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="min-h-screen w-full selection:bg-cyan-500 selection:text-white"
    >
      {/* ───────────────────────────────────────────────────────────
          1. TOPBAR UTILITÁRIA DISCRETA (ESTILO RACON)
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("topbar") && (
        <div
          style={{ backgroundColor: secondary }}
          className="w-full border-b border-white/10 px-4 py-2 text-white text-[11px] transition-colors"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Phone className="h-3.5 w-3.5 text-amber-400" />
                <span>Atendimento: {telefoneContato}</span>
              </span>
              <span className="hidden sm:flex items-center gap-1.5 font-medium text-slate-300">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span>WhatsApp: {whatsappContato}</span>
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-300 font-medium">
              <Link href="/area-parceiro" className="hover:text-amber-300 transition-colors">
                Área do Parceiro
              </Link>
              <span className="text-slate-600">•</span>
              <Link href="/login" className="flex items-center gap-1 hover:text-white transition-colors">
                <Lock className="h-3 w-3 text-amber-400" />
                <span>Login Seguro</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          2. HEADER PRINCIPAL BRANCO / CLEAN COM LOGO E CTAS
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("header") && (
        <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white shadow-xs">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            {/* Logo da Empresa */}
            <Link href="/" className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative h-10 w-44">
                  <Image src={logoUrl} alt={empresaNome} fill className="object-contain object-left" />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: primary }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-white text-base shadow-sm"
                  >
                    {empresaNome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                      {empresaNome}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Consórcios & Soluções
                    </span>
                  </div>
                </div>
              )}
            </Link>

            {/* Menu de Navegação Horizontal */}
            <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-700">
              {activeMenus.map((m) => (
                <Link
                  key={m.id}
                  href={m.rota}
                  className="transition-colors hover:text-[#0066cc] py-1 border-b-2 border-transparent hover:border-[#0066cc]"
                >
                  {m.label}
                </Link>
              ))}
            </nav>

            {/* Botão de Destaque CTA Topo */}
            <div className="flex items-center gap-3">
              <Link
                href="/simulador"
                style={{
                  backgroundColor: accent,
                  borderRadius: borderRadius,
                  color: "#0f172a",
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold shadow-md hover:brightness-105 transition-all"
              >
                <span>Simular Agora</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* ───────────────────────────────────────────────────────────
          3. HERO PRINCIPAL & SIMULADOR EM DESTAQUE COM IMAGEM FORTE
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("hero") && (
        <section
          style={{
            background: `linear-gradient(135deg, ${secondary} 0%, #0a2540 50%, #004080 100%)`,
          }}
          className="relative overflow-hidden text-white pt-10 pb-16 lg:pt-14 lg:pb-20"
        >
          {/* Efeito sutil de background decorativo */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              {/* Coluna Esquerda: Headline & Proposta de Valor Racon */}
              <div className="space-y-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-amber-300 backdrop-blur-md border border-white/15">
                  <Award className="h-3.5 w-3.5 text-amber-400" />
                  <span>Consórcio Inteligente • Sem Juros • Taxas Reduzidas</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] text-white">
                  O consórcio que transforma seus planos em conquistas reais.
                </h1>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium max-w-xl">
                  Planeje a compra do seu imóvel, veículo novo ou máquinas com parcelas acessíveis, poder de compra à vista e a segurança de grupos homologados.
                </p>

                {/* Bullets de Benefícios */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Zero taxa de juros abusiva</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Poder de compra à vista</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Parcela Reduzida até 50%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Lances livres, fixos e embutidos</span>
                  </div>
                </div>

                {/* Imagem de Destaque / Prova Visual */}
                <div className="pt-4 flex items-center gap-4">
                  <div className="flex -space-x-2 overflow-hidden">
                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-200" />
                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-cyan-700" />
                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-amber-500" />
                  </div>
                  <div className="text-xs">
                    <strong className="block text-white font-bold">+12.000 Clientes Atendidos</strong>
                    <span className="text-slate-300 text-[11px]">Milhões em créditos já contemplados</span>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: SIMULADOR EM CARD ARREDONDADO (HERO SIMULATOR) */}
              <div className="lg:col-span-6">
                <div
                  style={{ borderRadius: borderRadius }}
                  className="bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-slate-100"
                >
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066cc]">
                      Simulação Online Instantânea
                    </span>
                    <h2 className="mt-0.5 text-xl font-black text-slate-900">
                      Quanto você deseja planejar?
                    </h2>
                  </div>

                  {/* Seleção de Segmento */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: "imovel", label: "Imóvel", icon: Home },
                        { id: "auto", label: "Veículo", icon: Car },
                        { id: "pesados", label: "Pesados", icon: Truck },
                        { id: "agro", label: "Agro", icon: Tractor },
                      ] as const
                    ).map((seg) => {
                      const isSelected = segmentoSimulador === seg.id;
                      const Icon = seg.icon;
                      return (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => {
                            setSegmentoSimulador(seg.id);
                            setCreditoSelecionado(opcoesSegmento[seg.id].valores[1]);
                          }}
                          style={{
                            borderRadius: "10px",
                            backgroundColor: isSelected ? "#0c2340" : "#f8fafc",
                            color: isSelected ? "#ffffff" : "#475569",
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 text-center transition-all ${
                            isSelected ? "shadow-sm" : "hover:bg-slate-100"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isSelected ? "text-amber-400" : "text-slate-500"}`} />
                          <span className="mt-1 text-[11px] font-bold">{seg.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Seletores Rápidos de Crédito */}
                  <div className="mt-5 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Selecione o valor do crédito desejado:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {currentOpcao.valores.map((val) => {
                        const isValSelected = creditoSelecionado === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCreditoSelecionado(val)}
                            className={`rounded-lg py-2 px-1 text-center text-xs font-bold transition-all ${
                              isValSelected
                                ? "bg-[#0066cc] text-white shadow-sm ring-2 ring-[#0066cc]"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            R$ {(val / 1000).toFixed(0)}k
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Box de Resultado da Estimativa */}
                  <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Crédito Simulado:</span>
                      <strong className="text-base font-black text-slate-900">
                        R$ {creditoSelecionado.toLocaleString("pt-BR")},00
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-emerald-700">
                          ⚡ Parcela Reduzida
                        </span>
                        <strong className="text-base sm:text-lg font-black text-emerald-700">
                          R$ {parcelaReduzida.toFixed(2).replace(".", ",")}
                        </strong>
                        <span className="block text-[10px] text-slate-500">até a contemplação</span>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">
                          Parcela Integral
                        </span>
                        <strong className="text-base sm:text-lg font-black text-slate-800">
                          R$ {parcelaIntegral.toFixed(2).replace(".", ",")}
                        </strong>
                        <span className="block text-[10px] text-slate-500">em até {currentOpcao.prazo}x</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Principal do Simulador */}
                  <div className="mt-5">
                    <Link
                      href={`/simulador?segmento=${segmentoSimulador}&credito=${creditoSelecionado}`}
                      style={{
                        backgroundColor: accent,
                        borderRadius: borderRadius,
                        color: "#0f172a",
                      }}
                      className="flex w-full items-center justify-center gap-2 py-3.5 text-xs font-black shadow-lg hover:brightness-105 transition-all text-center"
                    >
                      <span>Quero Ver Grupos e Prazos Disponíveis</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="mt-2 text-center text-[10px] text-slate-400 font-medium">
                      Simulação gratuita e sem compromisso com especialista certificado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          4. CARDS COMERCIAIS DE CATEGORIAS / OBJETIVOS
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("produtos") && (
        <section className="py-14 sm:py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                Nossos Segmentos Oficiais
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                O que você deseja conquistar hoje?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Escolha a solução financeira ideal para seu projeto de vida ou crescimento empresarial.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  id: "imoveis",
                  title: "Consórcio de Imóveis",
                  desc: "Compre, construa, reforme ou quite seu financiamento imobiliário.",
                  img: "/foto/Casa.png",
                  badge: "Prazos até 220 meses",
                  cta: "Ver Planos de Imóveis",
                  href: "/consorcio/imoveis",
                },
                {
                  id: "veiculos",
                  title: "Consórcio de Automóveis",
                  desc: "Carros novos, seminovos e frotas sem pagar juros de banco.",
                  img: "/foto/Carros.png",
                  badge: "Prazos até 100 meses",
                  cta: "Ver Planos de Veículos",
                  href: "/consorcio/veiculos",
                },
                {
                  id: "pesados",
                  title: "Pesados e Caminhões",
                  desc: "Amplie e renove sua frota com custos operacionais previsíveis.",
                  img: "/foto/Caminhoes-e-Frota.png",
                  badge: "Prazos até 120 meses",
                  cta: "Ver Planos Pesados",
                  href: "/consorcio/pesados",
                },
                {
                  id: "agro",
                  title: "Máquinas e Agro",
                  desc: "Tratores e equipamentos de alta produtividade para o agronegócio.",
                  img: "/foto/Maquinas-Agricolas.png",
                  badge: "Prazos até 144 meses",
                  cta: "Ver Planos Agro",
                  href: "/consorcio/agro",
                },
              ].map((card) => (
                <div
                  key={card.id}
                  style={{ borderRadius: borderRadius }}
                  className="group flex flex-col justify-between overflow-hidden border border-slate-200 bg-white shadow-xs transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <Image
                      src={card.img}
                      alt={card.title}
                      fill
                      className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 rounded-full bg-[#0c2340] px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300 shadow-sm">
                      {card.badge}
                    </span>
                  </div>

                  <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900">{card.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                    </div>

                    <Link
                      href={card.href}
                      className="inline-flex items-center gap-1.5 text-xs font-black text-[#0066cc] group-hover:text-cyan-700 transition-colors"
                    >
                      <span>{card.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          5. POR QUE ESCOLHER CONSÓRCIO / PILARES (ESTILO RACON)
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("beneficios") && (
        <section className="py-14 sm:py-20 bg-slate-50 border-y border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                  Vantagens Reais
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                  Por que o consórcio é a escolha mais inteligente?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Diferente do financiamento tradicional onde você paga o dobro do valor em juros bancários, o consórcio é autofinanciamento planejado com regras transparentes.
                </p>
                <div className="pt-2">
                  <Link
                    href="/simulador"
                    style={{
                      backgroundColor: primary,
                      borderRadius: borderRadius,
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs font-extrabold text-white shadow-md hover:brightness-110 transition-all"
                  >
                    <span>Comparar com Financiamento</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
                {[
                  {
                    num: "01",
                    icon: Percent,
                    title: "Sem Juros Abusivos",
                    desc: "Apenas taxa de administração fixa e diluída ao longo do plano, gerando economia expressiva.",
                  },
                  {
                    num: "02",
                    icon: TrendingUp,
                    title: "Poder de Compra à Vista",
                    desc: "Com a carta contemplada em mãos, você negocia excelentes descontos na compra do seu bem.",
                  },
                  {
                    num: "03",
                    icon: Clock,
                    title: "Parcela Reduzida",
                    desc: "Opção de pagar parcelas menores até a contemplação para proteger seu fluxo de caixa mensal.",
                  },
                  {
                    num: "04",
                    icon: ShieldCheck,
                    title: "Segurança e Solidez",
                    desc: "Sistema 100% fiscalizado pelo Banco Central com assembleias e contemplações auditadas.",
                  },
                ].map((item) => (
                  <div
                    key={item.num}
                    style={{ borderRadius: borderRadius }}
                    className="bg-white p-5 border border-slate-200/80 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0066cc]">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs font-black text-slate-300">{item.num}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          6. COMO FUNCIONA / PASSO A PASSO DA CONTEMPLAÇÃO
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("como_funciona") && (
        <section id="como-funciona" className="py-14 sm:py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                Etapas Simples
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Como funciona o seu consórcio?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Do primeiro planejamento até a entrega das chaves ou do veículo.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "1. Escolha o seu Plano",
                  desc: "Defina o valor do crédito que você precisa e a parcela que cabe confortavelmente no seu orçamento.",
                },
                {
                  step: "2",
                  title: "2. Participe das Assembleias",
                  desc: "Todos os meses você concorre por sorteio e pode ofertar lances livres ou fixos para antecipar sua carta.",
                },
                {
                  step: "3",
                  title: "3. Conquiste seu Bem",
                  desc: "Após a contemplação, utilize seu crédito para adquirir o imóvel, carro ou equipamento que sempre sonhou.",
                },
              ].map((st) => (
                <div
                  key={st.step}
                  style={{ borderRadius: borderRadius }}
                  className="relative bg-slate-50 p-6 border border-slate-200/80 text-left space-y-3"
                >
                  <div
                    style={{ backgroundColor: secondary }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-amber-300 text-base shadow-sm"
                  >
                    {st.step}
                  </div>
                  <h3 className="text-base font-black text-slate-900">{st.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{st.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          7. ESTATÍSTICAS E CREDIBILIDADE DA PLATAFORMA
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("estatisticas") && (
        <section
          style={{ backgroundColor: secondary }}
          className="py-12 text-white border-y border-white/10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 text-center">
              <div className="space-y-1">
                <strong className="block text-2xl sm:text-4xl font-black text-amber-300">+15 Anos</strong>
                <span className="text-xs text-slate-300 font-medium">de Tradição no Mercado</span>
              </div>
              <div className="space-y-1">
                <strong className="block text-2xl sm:text-4xl font-black text-white">R$ 800M+</strong>
                <span className="text-xs text-slate-300 font-medium">em Créditos Comercializados</span>
              </div>
              <div className="space-y-1">
                <strong className="block text-2xl sm:text-4xl font-black text-white">+12.000</strong>
                <span className="text-xs text-slate-300 font-medium">Clientes e Famílias Atendidas</span>
              </div>
              <div className="space-y-1">
                <strong className="block text-2xl sm:text-4xl font-black text-emerald-400">100%</strong>
                <span className="text-xs text-slate-300 font-medium">Regulamentado pelo Banco Central</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          8. CTA INTERMEDIÁRIO DE ALTA CONVERSÃO
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("cta") && (
        <section className="py-14 sm:py-16 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              style={{
                borderRadius: borderRadius,
                background: `linear-gradient(135deg, ${primary} 0%, #004080 100%)`,
              }}
              className="p-8 sm:p-12 text-white shadow-xl text-center space-y-6"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-white max-w-xl mx-auto">
                Pronto para dar o primeiro passo rumo à sua próxima conquista?
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 max-w-lg mx-auto leading-relaxed">
                Nossa equipe de consultores especializados está pronta para montar o plano com a maior probabilidade de contemplação para você.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <Link
                  href="/simulador"
                  style={{
                    backgroundColor: accent,
                    borderRadius: borderRadius,
                    color: "#0f172a",
                  }}
                  className="px-6 py-3 text-xs font-black shadow-md hover:brightness-105 transition-all"
                >
                  Simular Meu Consórcio Agora
                </Link>
                <a
                  href={`https://wa.me/55${whatsappContato.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-300" />
                  <span>Falar no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
          9. FOOTER ESTRUTURADO INSTITUCIONAL & REGULATÓRIO
      ─────────────────────────────────────────────────────────── */}
      {isSecaoHabilitada("footer") && (
        <footer
          style={{ backgroundColor: secondary }}
          className="border-t border-slate-800 text-slate-400 text-xs pt-12 pb-8"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Coluna 1: Empresa */}
              <div className="space-y-3">
                <span className="text-sm font-black text-white tracking-tight">{empresaNome}</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Soluções completas em consórcios imobiliários, automotivos, frotas e agronegócio com consultoria especializada e atendimento personalizado.
                </p>
                <div className="text-[11px] text-slate-400 pt-1 space-y-1">
                  <p>Telefone: {telefoneContato}</p>
                  <p>WhatsApp: {whatsappContato}</p>
                </div>
              </div>

              {/* Coluna 2: Segmentos */}
              <div className="space-y-2.5">
                <strong className="block text-xs font-bold uppercase tracking-wider text-white">
                  Segmentos
                </strong>
                <ul className="space-y-1.5 text-[11px]">
                  <li>
                    <Link href="/consorcio/imoveis" className="hover:text-white transition-colors">
                      Consórcio Imobiliário
                    </Link>
                  </li>
                  <li>
                    <Link href="/consorcio/veiculos" className="hover:text-white transition-colors">
                      Consórcio de Automóveis
                    </Link>
                  </li>
                  <li>
                    <Link href="/consorcio/pesados" className="hover:text-white transition-colors">
                      Pesados & Frotas
                    </Link>
                  </li>
                  <li>
                    <Link href="/consorcio/agro" className="hover:text-white transition-colors">
                      Máquinas e Agronegócio
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Coluna 3: Links Úteis */}
              <div className="space-y-2.5">
                <strong className="block text-xs font-bold uppercase tracking-wider text-white">
                  Links Úteis
                </strong>
                <ul className="space-y-1.5 text-[11px]">
                  <li>
                    <Link href="/simulador" className="hover:text-white transition-colors">
                      Simulador Online
                    </Link>
                  </li>
                  <li>
                    <Link href="/grupos" className="hover:text-white transition-colors">
                      Grupos e Assembleias
                    </Link>
                  </li>
                  <li>
                    <Link href="/area-parceiro" className="hover:text-white transition-colors">
                      Portal do Parceiro
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-colors">
                      Área Restrita
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Coluna 4: Governança & Segurança */}
              <div className="space-y-2.5">
                <strong className="block text-xs font-bold uppercase tracking-wider text-white">
                  Regulatório
                </strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  As administradoras de consórcios têm suas atividades autorizadas e fiscalizadas pelo <strong>Banco Central do Brasil</strong>.
                </p>
                <div className="inline-flex items-center gap-1.5 rounded bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Ambiente 100% Criptografado</span>
                </div>
              </div>
            </div>

            {/* Linha de Copyright */}
            <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
              <p>{footerCopyright}</p>
              <p>Plataforma SaaS Multi-Tenant Gauchinho Consórcios</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
