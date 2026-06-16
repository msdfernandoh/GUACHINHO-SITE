import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Car,
  Bike,
  Truck,
  Container,
  Sparkles,
  Landmark,
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
};

export const DREAM_CARDS: DreamCard[] = [
  {
    id: "imovel",
    title: "Imóvel",
    description: "Casa, apartamento ou terreno com consórcio orientado.",
    href: buildSimuladorUrl({ tipo: "imovel", solucao: "consorcio" }),
    icon: Home,
    accent: "from-amber-500/20 to-amber-600/5",
  },
  {
    id: "automovel",
    title: "Automóvel",
    description: "Carro novo ou seminovo com parcelas que cabem no bolso.",
    href: buildSimuladorUrl({ tipo: "automovel", solucao: "consorcio" }),
    icon: Car,
    accent: "from-sky-500/15 to-zinc-900/40",
  },
  {
    id: "moto",
    title: "Moto",
    description: "Mobilidade com crédito planejado.",
    href: buildSimuladorUrl({ tipo: "automovel", solucao: "consorcio", origem: "home_moto" }),
    icon: Bike,
    accent: "from-emerald-500/15 to-zinc-900/40",
  },
  {
    id: "caminhonete",
    title: "Caminhonete",
    description: "Utilitários para trabalho e lazer.",
    href: buildSimuladorUrl({ tipo: "automovel", solucao: "consorcio", origem: "home_caminhonete" }),
    icon: Truck,
    accent: "from-orange-500/15 to-zinc-900/40",
  },
  {
    id: "caminhao",
    title: "Caminhão / Carreta",
    description: "Frota e transporte com consultoria especializada.",
    href: buildSimuladorUrl({ tipo: "automovel", solucao: "consorcio", origem: "home_caminhao" }),
    icon: Container,
    accent: "from-violet-500/15 to-zinc-900/40",
  },
  {
    id: "carta",
    title: "Carta contemplada",
    description: "Oportunidades prontas para acelerar sua compra.",
    href: "/cartas-contempladas",
    icon: Sparkles,
    accent: "from-amber-400/25 to-zinc-900/30",
  },
  {
    id: "financiamento",
    title: "Financiamento",
    description: "Compare prazos, entrada e custo total com orientação.",
    href: buildSimuladorUrl({ solucao: "financiamento" }),
    icon: Landmark,
    accent: "from-rose-500/10 to-zinc-900/40",
  },
  {
    id: "imoveis",
    title: "Oportunidades imobiliárias",
    description: "Imóveis selecionados com imobiliárias parceiras.",
    href: "/oportunidades-imobiliarias",
    icon: Building2,
    accent: "from-teal-500/15 to-zinc-900/40",
  },
  {
    id: "grupos",
    title: "Grupos disponíveis",
    description: "Simule cotas reais como na planilha comercial.",
    href: "/grupos",
    icon: Layers,
    accent: "from-amber-500/15 to-zinc-800/50",
  },
];

export const SOLUTION_CARDS = [
  {
    title: "Consórcio",
    text: "Crédito com taxas competitivas e estratégia de lance.",
    href: buildSimuladorUrl({ solucao: "consorcio", tipo: "imovel" }),
    cta: "Simular consórcio",
  },
  {
    title: "Financiamento",
    text: "Análise de entrada, prazo e comparativo com consórcio.",
    href: buildSimuladorUrl({ solucao: "financiamento" }),
    cta: "Simular financiamento",
  },
  {
    title: "Cartas contempladas",
    text: "Cartas ativas com entrada e parcela transparentes.",
    href: "/cartas-contempladas",
    cta: "Ver cartas",
  },
  {
    title: "Oportunidades imobiliárias",
    text: "Imóveis parceiros com interesse direto e simulação.",
    href: "/oportunidades-imobiliarias",
    cta: "Explorar imóveis",
  },
  {
    title: "Grupos disponíveis",
    text: "Tabela funcional alinhada ao comercial.",
    href: "/grupos",
    cta: "Ver grupos",
  },
  {
    title: "Planejamento financeiro",
    text: "Consultoria para escolher o melhor caminho ao seu sonho.",
    href: "#contato",
    cta: "Agendar consultoria",
  },
] as const;

export const PARCEIROS_FIXOS = [
  { nome: "Racon", tag: "Administradora" },
  { nome: "Creditas", tag: "Crédito" },
  { nome: "Tutors", tag: "Educação financeira" },
] as const;
