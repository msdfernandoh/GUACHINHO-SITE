import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Car,
  Bike,
  Truck,
  Container,
  Sparkles,
  Home,
  Layers,
} from "lucide-react";
import { buildSimuladorUrl } from "./build-simulador-url";

export type DreamCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
};

export const DREAM_CARDS: DreamCard[] = [
  {
    id: "imovel",
    title: "Imóveis",
    description: "Casa, apartamento ou terreno com planejamento e consórcio orientado.",
    href: buildSimuladorUrl({ tipo: "imovel", solucao: "consorcio" }),
    icon: Home,
    accent: "from-amber-500/25 via-zinc-900/20 to-zinc-950",
    ring: "group-hover:shadow-amber-500/20",
  },
  {
    id: "veiculos",
    title: "Veículos",
    description: "Carro novo ou seminovo com parcelas alinhadas ao seu orçamento.",
    href: buildSimuladorUrl({ tipo: "automovel", solucao: "consorcio" }),
    icon: Car,
    accent: "from-sky-500/20 via-zinc-900/30 to-zinc-950",
    ring: "group-hover:shadow-sky-500/15",
  },
  {
    id: "moto",
    title: "Motos",
    description: "Mobilidade com crédito planejado e consultoria de lance.",
    href: "/simulador?tipo=moto&solucao=consorcio",
    icon: Bike,
    accent: "from-emerald-500/20 via-zinc-900/30 to-zinc-950",
    ring: "group-hover:shadow-emerald-500/15",
  },
  {
    id: "caminhonete",
    title: "Caminhonetes",
    description: "Utilitários para trabalho e lazer com estratégia comercial.",
    href: "/simulador?tipo=caminhonete&solucao=consorcio",
    icon: Truck,
    accent: "from-orange-500/20 via-zinc-900/30 to-zinc-950",
    ring: "group-hover:shadow-orange-500/15",
  },
  {
    id: "caminhao",
    title: "Caminhões",
    description: "Frota e transporte com análise patrimonial e comparativo.",
    href: "/simulador?tipo=caminhonete&solucao=consorcio&origem=home_caminhao",
    icon: Container,
    accent: "from-violet-500/20 via-zinc-900/30 to-zinc-950",
    ring: "group-hover:shadow-violet-500/15",
  },
  {
    id: "carta",
    title: "Carta contemplada",
    description: "Oportunidades prontas para acelerar sua conquista.",
    href: "/cartas-contempladas",
    icon: Sparkles,
    accent: "from-amber-400/30 via-amber-950/20 to-zinc-950",
    ring: "group-hover:shadow-amber-400/25",
  },
  {
    id: "imoveis-op",
    title: "Oportunidades imobiliárias",
    description: "Imóveis selecionados com imobiliárias parceiras de confiança.",
    href: "/oportunidades-imobiliarias",
    icon: Building2,
    accent: "from-teal-500/20 via-zinc-900/30 to-zinc-950",
    ring: "group-hover:shadow-teal-500/15",
  },
  {
    id: "grupos",
    title: "Grupos disponíveis",
    description: "Cotas reais, parcelas e prazos como na mesa comercial.",
    href: "/grupos",
    icon: Layers,
    accent: "from-amber-600/20 via-zinc-900/40 to-zinc-950",
    ring: "group-hover:shadow-amber-500/20",
  },
];

export const AUTHORITY_ITEMS = [
  {
    title: "Atendimento consultivo",
    text: "Especialistas que traduzem números em decisões claras para o seu momento.",
  },
  {
    title: "Estratégias de lance",
    text: "Cenários de lance embutido e livre para você enxergar risco e oportunidade.",
  },
  {
    title: "Consórcio × financiamento",
    text: "Comparativo financeiro lado a lado, sem jargão e sem promessa vazia.",
  },
  {
    title: "Parceiros de mercado",
    text: "Administradoras, crédito e imobiliárias que sustentam a operação.",
  },
  {
    title: "Propostas em PDF",
    text: "Material profissional para compartilhar com família, sócios ou contador.",
  },
  {
    title: "Visão patrimonial",
    text: "Simulações que consideram prazo, fluxo e objetivo de longo prazo.",
  },
] as const;

export const SOLUTION_CARDS = [
  {
    title: "Consórcio",
    text: "Crédito com taxas competitivas e estratégia de lance.",
    href: buildSimuladorUrl({ solucao: "consorcio", tipo: "imovel" }),
    cta: "Simular consórcio",
    gradient: "from-amber-500/15 to-zinc-950",
  },
  {
    title: "Financiamento",
    text: "Análise de entrada, prazo e comparativo com consórcio.",
    href: buildSimuladorUrl({ solucao: "financiamento" }),
    cta: "Simular financiamento",
    gradient: "from-rose-500/10 to-zinc-950",
  },
  {
    title: "Cartas contempladas",
    text: "Cartas ativas com entrada e parcela transparentes.",
    href: "/cartas-contempladas",
    cta: "Ver cartas",
    gradient: "from-amber-400/20 to-zinc-950",
  },
  {
    title: "Oportunidades imobiliárias",
    text: "Imóveis parceiros com interesse direto e simulação.",
    href: "/oportunidades-imobiliarias",
    cta: "Explorar imóveis",
    gradient: "from-teal-500/15 to-zinc-950",
  },
  {
    title: "Grupos disponíveis",
    text: "Tabela funcional alinhada ao comercial.",
    href: "/grupos",
    cta: "Ver grupos",
    gradient: "from-sky-500/10 to-zinc-950",
  },
  {
    title: "Planejamento financeiro",
    text: "Consultoria para escolher o melhor caminho ao seu sonho.",
    href: "#contato",
    cta: "Agendar consultoria",
    gradient: "from-violet-500/10 to-zinc-950",
  },
] as const;

export const PARCEIROS_FIXOS = [
  { nome: "Racon", tag: "Administradora" },
  { nome: "Creditas", tag: "Crédito" },
  { nome: "Tutors", tag: "Educação financeira" },
] as const;
