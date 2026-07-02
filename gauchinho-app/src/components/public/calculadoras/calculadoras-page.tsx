"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { CalculadorasFinanceirasConfig } from "@/lib/config/defaults";
import type { CalculadoraId } from "@/lib/calculadoras/types";
import { calculadorasAtivas, type CalculadoraMeta } from "@/lib/calculadoras/meta";
import { mensagemWhatsappCalculadora } from "@/lib/calculadoras/whatsapp-messages";
import type { WhatsappOrigemRow } from "@/lib/whatsapp/resolve-origem";
import { simuladorShell, sectionCardClass } from "@/components/simulador/simulador-ui";
import { Button } from "@/components/ui/form-primitives";
import { CalculadoraCard } from "./calculadora-card";
import { CalculatorLeadModal, type AcaoCalculadoraLead } from "./calculator-lead-modal";
import { AplicacaoMensalCalculator } from "./aplicacao-mensal-calculator";
import { ValorFuturoCalculator } from "./valor-futuro-calculator";
import { FinanciamentoCalculator } from "./financiamento-calculator";
import { CorrecaoValoresCalculator } from "./correcao-valores-calculator";
import { JurosRealCalculator } from "./juros-real-calculator";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";

import type { IndicePublico } from "@/lib/indices-financeiros/types";

type SimSnapshot = {
  id: CalculadoraId;
  inputs: Record<string, unknown>;
  resultado: Record<string, unknown>;
};

type Props = {
  config: CalculadorasFinanceirasConfig;
  initialCalc?: CalculadoraId;
  indices: IndicePublico[];
  aplicacaoPrefill?: { aporte: number; prazoMeses: number };
};

export function CalculadorasPage({ config, initialCalc, indices, aplicacaoPrefill }: Props) {
  const ativas = useMemo(() => calculadorasAtivas(config), [config]);
  const [activeId, setActiveId] = useState<CalculadoraId | null>(() => {
    if (initialCalc && ativas.some((a) => a.id === initialCalc)) return initialCalc;
    return ativas[0]?.id ?? null;
  });
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [acao, setAcao] = useState<AcaoCalculadoraLead>("analise");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [leadMsg, setLeadMsg] = useState<string | null>(null);

  const activeMeta = ativas.find((m) => m.id === activeId);

  const onResult = useCallback(
    (id: CalculadoraId, inputs: Record<string, unknown>, resultado: Record<string, unknown>) => {
      setSnapshot({ id, inputs, resultado });
      setWaLink(null);
      setLeadMsg(null);
      void fetch("/api/public/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_evento: "calculadora_utilizada",
          origem: "calculadora_financeira",
          entidade_tipo: id,
        }),
      });
      if (id === "correcao") {
        void fetch("/api/public/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo_evento: "calculadora_aluguel_utilizada",
            origem: "calculadora_financeira",
          }),
        });
      }
      if (id === "aplicacao_mensal") {
        void fetch("/api/public/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo_evento: "calculadora_aplicacao_comparativo_utilizada",
            origem: "calculadora_financeira",
          }),
        });
      }
    },
    [],
  );

  function openLead(nextAcao: AcaoCalculadoraLead) {
    if (!snapshot || snapshot.id !== activeId) return;
    setAcao(nextAcao);
    setModalOpen(true);
    setLeadMsg(null);
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot || !activeId) return;
    setLoading(true);
    setLeadMsg(null);
    setWaLink(null);
    try {
      const res = await fetch("/api/public/calculadoras/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          cidade,
          email,
          calculadoraId: activeId,
          acao,
          inputs: snapshot.inputs,
          resultado: snapshot.resultado,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        whatsappOrigem?: WhatsappOrigemRow | null;
      };
      if (!res.ok || !data.ok) {
        setLeadMsg(data.error ?? "Não foi possível salvar.");
        return;
      }
      setModalOpen(false);
      setLeadMsg("Lead registrado. Você pode falar com nosso time agora.");

      const wa = data.whatsappOrigem;
      if (wa?.whatsapp_destino && wa.exibir_botao_apos_lead !== false) {
        const text = mensagemWhatsappCalculadora(activeId, nome);
        setWaLink(
          `https://wa.me/${wa.whatsapp_destino.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function onWaClick() {
    void fetch("/api/public/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: "clique_whatsapp_pos_lead",
        origem: "calculadora_financeira",
        entidade_tipo: activeId ?? undefined,
      }),
    });
  }

  if (ativas.length === 0) {
    return (
      <div className={simuladorShell}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-300">
          <p>Calculadoras temporariamente indisponíveis.</p>
          <Link href="/" className="mt-4 inline-block text-amber-400 underline">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-14">
        <header className="mb-8 text-center sm:mb-10">
          <div className="mx-auto flex max-w-2xl items-start justify-center gap-3 text-left sm:text-center">
            <MascoteGauchinho variant="compact" className="mt-1 shrink-0 sm:mt-2" />
            <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">Gauchinho</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Calculadoras Financeiras
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Planeje melhor suas decisões antes de contratar consórcio, financiamento ou investimento.
          </p>
            </div>
          </div>
        </header>

        <nav
          className="-mx-1 mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
          aria-label="Calculadoras"
        >
          {ativas.map((meta) => (
            <CalculadoraCard
              key={meta.id}
              variant="tab"
              meta={meta}
              selected={meta.id === activeId}
              onSelect={() => {
                setActiveId(meta.id);
                setSnapshot(null);
                setWaLink(null);
                setLeadMsg(null);
              }}
            />
          ))}
        </nav>

        <div className="min-w-0">
          {activeMeta ? (
            <>
              <p className="mb-4 text-sm text-slate-400">{activeMeta.question}</p>
              <CalculatorPanel
                meta={activeMeta}
                config={config}
                indices={indices}
                aplicacaoPrefill={aplicacaoPrefill}
                onResult={(inputs, resultado) => onResult(activeMeta.id, inputs, resultado)}
              />
            </>
          ) : null}

          {snapshot && snapshot.id === activeId ? (
            <section className={sectionCardClass("mt-4 border-amber-500/25 py-4")}>
              <p className="text-center text-sm font-semibold text-white">
                {config.textoCtaAposResultado ||
                  "Quer uma análise personalizada para seu objetivo?"}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="gold"
                  className="min-h-11 flex-1 sm:flex-none sm:px-6"
                  onClick={() => openLead("analise")}
                >
                  Receber análise completa
                </Button>
                <Button
                  type="button"
                  variant="outlineGold"
                  className="min-h-11 flex-1 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 sm:flex-none sm:px-6"
                  onClick={() => openLead("especialista")}
                >
                  Falar com especialista
                </Button>
              </div>
              {leadMsg ? <p className="mt-2 text-center text-sm text-emerald-400">{leadMsg}</p> : null}
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onWaClick}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <MessageCircle className="h-5 w-5" />
                  Chamar no WhatsApp
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <CalculatorLeadModal
        open={modalOpen}
        acao={acao}
        nome={nome}
        whatsapp={whatsapp}
        cidade={cidade}
        email={email}
        loading={loading}
        onClose={() => setModalOpen(false)}
        onSubmit={submitLead}
        onNome={setNome}
        onWhatsapp={setWhatsapp}
        onCidade={setCidade}
        onEmail={setEmail}
      />
    </div>
  );
}

function CalculatorPanel({
  meta,
  config,
  indices,
  aplicacaoPrefill,
  onResult,
}: {
  meta: CalculadoraMeta;
  config: CalculadorasFinanceirasConfig;
  indices: IndicePublico[];
  aplicacaoPrefill?: { aporte: number; prazoMeses: number };
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
}) {
  switch (meta.id) {
    case "aplicacao_mensal":
      return (
        <AplicacaoMensalCalculator
          indices={indices}
          taxaPadrao={config.rentabilidadeMensalPadrao}
          prefill={aplicacaoPrefill}
          onResult={onResult}
        />
      );
    case "valor_futuro":
      return <ValorFuturoCalculator taxaPadrao={config.rentabilidadeMensalPadrao} onResult={onResult} />;
    case "financiamento":
      return (
        <FinanciamentoCalculator taxaPadrao={config.taxaFinanciamentoPadrao} onResult={onResult} />
      );
    case "correcao":
      return <CorrecaoValoresCalculator indices={indices} onResult={onResult} />;
    case "juros_real":
      return <JurosRealCalculator onResult={onResult} />;
  }
}
