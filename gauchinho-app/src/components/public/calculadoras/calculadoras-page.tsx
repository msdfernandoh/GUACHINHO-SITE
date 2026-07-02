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
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="mb-8 sm:mb-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400/90">
              Gauchinho · Ferramentas
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              Calculadoras Gauchinho
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              Compare cenários e descubra qual estratégia combina melhor com seu objetivo — antes de
              financiar, investir ou fechar negócio.
            </p>
          </div>
        </header>

        <nav
          className="-mx-1 mb-8 flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin sm:justify-center sm:overflow-x-visible sm:flex-wrap"
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
              {activeMeta.id === "aplicacao_mensal" ? (
                <div className="mb-6 rounded-2xl border border-amber-500/20 bg-slate-900/40 px-5 py-5 sm:px-7 sm:py-6">
                  <h2 className="text-xl font-bold text-white sm:text-2xl">
                    Aplicação mensal × Consórcio
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
                    Veja quanto você pode acumular investindo mês a mês e compare com o poder de compra
                    de um consórcio programado.
                  </p>
                </div>
              ) : (
                <p className="mb-5 text-base text-slate-400">{activeMeta.question}</p>
              )}
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
            <section
              className={sectionCardClass(
                "mt-8 overflow-hidden border-amber-500/35 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-amber-950/20 p-6 sm:p-8",
              )}
            >
              <p className="text-center text-lg font-bold text-white sm:text-xl">
                {config.textoCtaAposResultado ||
                  "Quer uma análise personalizada para o seu objetivo?"}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-slate-400">
                Um especialista pode comparar os cenários com seus dados reais e montar uma estratégia
                mais segura.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="gold"
                  className="min-h-12 flex-1 text-base font-bold shadow-lg shadow-amber-900/30 sm:max-w-xs sm:flex-none sm:px-8"
                  onClick={() => openLead("analise")}
                >
                  Receber análise completa
                </Button>
                <Button
                  type="button"
                  variant="outlineGold"
                  className="min-h-12 flex-1 border-slate-600 bg-slate-950/80 text-base font-semibold text-white hover:bg-slate-800 sm:max-w-xs sm:flex-none sm:px-8"
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
