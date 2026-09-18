"use client";

import { useState } from "react";
import {
  BookOpen,
  Copy,
  Check,
  FileText,
  Video,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Users,
  Calendar,
} from "lucide-react";

interface ScriptItem {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  texto: string;
}

const SCRIPTS_PADRAO: ScriptItem[] = [
  {
    id: "network_terca",
    categoria: "Convite para Evento",
    titulo: "Convite — Network de Negócios (Terça 19h)",
    descricao: "Para convidar empresários e investidores para o encontro semanal online",
    texto: `Olá [Nome], tudo bem?

Passando para te convidar para o nosso encontro exclusivo de Network de Negócios que acontece toda terça-feira às 19h!

É uma oportunidade excelente para empresários e investidores compartilharem estratégias sobre planejamento patrimonial, expansão e uso inteligente de consórcio como alavancagem financeira.

Posso confirmar sua vaga para esta terça?`,
  },
  {
    id: "primeiro_contato_lead",
    categoria: "Primeiro Contato",
    titulo: "Primeiro Contato — Lead Novo do Site / Simulador",
    descricao: "Para iniciar a conversa assim que o lead simula no site",
    texto: `Olá [Nome], tudo bem? Aqui é [Seu Nome] da Gauchinho Consórcios | Racon.

Recebi sua simulação sobre consórcio de [Imóvel/Veículo] no valor de [R$ Valor]. 

Vi que você tem interesse em um planejamento inteligente para essa conquista. Você teria 5 minutinhos hoje para eu te mostrar as melhores opções de parcelas e lances da nossa tabela vigente?`,
  },
  {
    id: "objecao_parcela",
    categoria: "Tratamento de Objeções",
    titulo: "Objeção — 'Achei a parcela alta'",
    descricao: "Para negociar prazo, meia parcela ou modalidade reduzida Racon",
    texto: `Entendo perfeitamente, [Nome]. Uma grande vantagem da Racon é que temos modalidades com parcela reduzida até a contemplação (ou em até 50%), o que reduz muito o desembolso mensal enquanto você planeja a contemplação.

Podemos recalcular na modalidade reduzida para encaixar certinho no seu fluxo de caixa mensal?`,
  },
  {
    id: "objecao_demora",
    categoria: "Tratamento de Objeções",
    titulo: "Objeção — 'Consórcio demora para contemplar'",
    descricao: "Explicar estratégias de lance embutido, lance livre e sorteio",
    texto: `Excelente ponto, [Nome]! Muitos acreditam que dependem apenas do sorteio, mas com nossa assessoria nós montamos uma estratégia de lances estatísticos (inclusive usando até 30% da própria carta como lance embutido, sem tirar do bolso).

Isso antecipa a contemplação logo nos primeiros meses para quem tem urgência. Posso te apresentar o histórico de médias de lance desse grupo?`,
  },
  {
    id: "convite_parceiro",
    categoria: "Parcerias",
    titulo: "Abordagem para Geradores de Negócios & Indicadores",
    descricao: "Para atrair corretores, contadores e corretores para o programa de parceiros",
    texto: `Olá [Nome], tudo bem?

Acompanho seu trabalho de destaque no mercado. Nós da Gauchinho Consórcios | Racon temos um Programa de Parceiros estruturado para profissionais que atendem clientes com demanda de compra de imóveis, frotas e investimentos.

Você indica clientes qualificados da sua carteira e recebe remunerações atrativas de repasse sobre cada cota formalizada, com suporte comercial completo da nossa equipe.

Topa um café ou alinhamento rápido de 10 minutos para conhecer o modelo?`,
  },
];

export function CrmMateriaisLibrary() {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");

  const categorias = ["Todas", "Primeiro Contato", "Convite para Evento", "Tratamento de Objeções", "Parcerias"];

  const filtrados =
    categoriaAtiva === "Todas"
      ? SCRIPTS_PADRAO
      : SCRIPTS_PADRAO.filter((s) => s.categoria === categoriaAtiva);

  function copyText(id: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  }

  return (
    <div className="space-y-6">
      {/* 1. SELEÇÃO DE CATEGORIAS */}
      <div className="flex flex-wrap gap-2">
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaAtiva(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoriaAtiva === cat
                ? "bg-blue-600 text-white shadow"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 2. GRID DE SCRIPTS DE WHATSAPP / ABORDAGEM */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtrados.map((script) => (
          <div
            key={script.id}
            className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm transition hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                  {script.categoria}
                </span>
                <button
                  onClick={() => copyText(script.id, script.texto)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 active:scale-95"
                >
                  {copiadoId === script.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Copiar Script</span>
                    </>
                  )}
                </button>
              </div>

              <h3 className="mt-2 text-sm font-bold text-zinc-100">{script.titulo}</h3>
              <p className="mt-0.5 text-xs text-zinc-400">{script.descricao}</p>

              <div className="mt-3 rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-300">
                  {script.texto}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. BLOCO DE MATERIAIS INSTITUCIONAIS & EVENTO DE TERÇA */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-400">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Evento Fixo Semanal</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-zinc-100">
              Network de Negócios — Toda Terça-feira às 19h
            </h3>
            <p className="text-xs text-zinc-400">
              Encontro online de relacionamento e apresentação de soluções para parceiros e investidores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const s = SCRIPTS_PADRAO.find((i) => i.id === "network_terca");
                if (s) copyText("network_terca_cta", s.texto);
              }}
              className="rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-purple-500"
            >
              Copiar Convite Rápido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
