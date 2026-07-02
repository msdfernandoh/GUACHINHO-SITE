import type { IaConfig } from "@/lib/config/ia-defaults";
import type { TipoCreditoPublico } from "@/lib/leads/tipo-credito";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";
import {
  DEFAULT_SIMULADOR_AUTOMOVEL,
  DEFAULT_SIMULADOR_IMOVEL,
  type SimuladorTipoBemConfig,
} from "@/lib/config/defaults";
import { normalizarOpcoesParcela } from "@/lib/config/simulador-parcela-opcoes";
import { formatBRL } from "@/lib/formatters/money";
import { estimarCreditoConsorcioPorParcela } from "@/lib/simulador/estimar-credito-por-parcela";
import { listPrazosConsorcio } from "@/lib/simulador/simulador-shared";
import { extrairLeadDaConversa } from "./extrair-lead";
import type { IaChatMessage } from "./types";

export type GuidedIntent =
  | "quanto_credito"
  | "simular"
  | "financiamento"
  | "grupos"
  | "eventos"
  | "indicar"
  | "calculadoras"
  | "especialista"
  | "generico";

export type GuidedFlowState = {
  flow: "credit" | "expert" | "idle";
  step?: string;
  tipoCredito?: TipoCreditoPublico;
  parcelaDesejada?: number;
  prazoMeses?: number;
  percentualParcelaReduzida?: number;
  simulacao?: Record<string, unknown>;
  intencao?: string;
};

export type GuidedLeadPayload = {
  intencao: string;
  nome?: string;
  whatsapp?: string;
  tipoCredito?: string;
  valorCredito?: number;
  observacao?: string;
  dadosSimulacao?: Record<string, unknown>;
};

export type GuidedAssistantResult = {
  reply: string;
  showLeadCapture: boolean;
  prontoParaLead: boolean;
  leadPayload?: GuidedLeadPayload;
  state?: GuidedFlowState;
};

const STATE_MARKER = /<!--g:([\s\S]*?)-->/;

export function stripGuidedMarker(text: string): string {
  return text.replace(/\n<!--g:[\s\S]*?-->/, "").trim();
}

export function parseGuidedStateFromHistory(history: IaChatMessage[]): GuidedFlowState | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "assistant") continue;
    const m = history[i].content.match(STATE_MARKER);
    if (!m?.[1]) continue;
    try {
      return JSON.parse(m[1]) as GuidedFlowState;
    } catch {
      return null;
    }
  }
  return null;
}

function withState(reply: string, state: GuidedFlowState): string {
  return `${reply}\n<!--g:${JSON.stringify(state)}-->`;
}

function bemConfigForTipo(tipo: TipoCreditoPublico): SimuladorTipoBemConfig {
  if (tipo === "Imóvel" || tipo === "Serviços" || tipo === "Outro") return DEFAULT_SIMULADOR_IMOVEL;
  return DEFAULT_SIMULADOR_AUTOMOVEL;
}

function defaultPrazoMeses(bem: SimuladorTipoBemConfig): number {
  const prazos = listPrazosConsorcio(bem);
  if (prazos.includes(220)) return 220;
  return bem.prazoPadrao;
}

function defaultPercentualReduzida(bem: SimuladorTipoBemConfig): number {
  const opcoes = normalizarOpcoesParcela(bem).filter((o) => o.ativa && o.percentual < 100);
  opcoes.sort((a, b) => a.ordem - b.ordem);
  return opcoes[0]?.percentual ?? 60;
}

export function parseParcelaDesejadaFromText(text: string): number | undefined {
  const t = text.toLowerCase();
  if (!/(parcela|por mês|por mes|mensal|pagar|tenho r\$)/.test(t) && !/r\$\s*\d/.test(t)) {
    const onlyNum = t.match(/^\s*(\d{2,5})\s*$/);
    if (onlyNum) {
      const n = Number(onlyNum[1]);
      if (n >= 50 && n <= 50_000) return n;
    }
  }
  const reais = text.match(/r\$\s*([\d.]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i);
  if (reais?.[1]) {
    const n = Number(reais[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 50 && n < 500_000) return Math.round(n * 100) / 100;
  }
  const porMes = text.match(/(\d{2,5})\s*(?:reais\s*)?(?:por\s*m[eê]s|mensais?|\/\s*m[eê]s)/i);
  if (porMes?.[1]) {
    const n = Number(porMes[1]);
    if (n >= 50 && n <= 50_000) return n;
  }
  return undefined;
}

export function parseTipoCreditoFromText(text: string): TipoCreditoPublico | undefined {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const map: [RegExp, TipoCreditoPublico][] = [
    [/imovel|imóvel|casa|apartamento/, "Imóvel"],
    [/caminhao|caminhão/, "Caminhão"],
    [/maquina|máquina/, "Máquinas"],
    [/moto\b/, "Moto"],
    [/veiculo|veículo|carro|automovel/, "Veículo"],
    [/servico|serviço/, "Serviços"],
  ];
  for (const [re, tipo] of map) {
    if (re.test(t)) return tipo;
  }
  for (const tipo of TIPOS_CREDITO_PUBLICO) {
    if (t.includes(tipo.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""))) return tipo;
  }
  return undefined;
}

export function detectGuidedIntent(text: string): GuidedIntent {
  const t = text.toLowerCase();
  if (/quanto consigo|credito poss|parcela.*credito|tenho r\$\s*\d.*m[eê]s/.test(t)) return "quanto_credito";
  if (/simul|consórcio|consorcio/.test(t)) return "simular";
  if (/financi/.test(t)) return "financiamento";
  if (/grupo/.test(t)) return "grupos";
  if (/evento/.test(t)) return "eventos";
  if (/indicar|indicação|indicacao/.test(t)) return "indicar";
  if (/calculadora/.test(t)) return "calculadoras";
  if (/especialista|atend|humano|whatsapp|zap/.test(t)) return "especialista";
  return "generico";
}

function calcularCreditoGuided(
  tipo: TipoCreditoPublico,
  parcela: number,
): { result: NonNullable<ReturnType<typeof estimarCreditoConsorcioPorParcela>>; meta: Record<string, unknown> } | null {
  const bem = bemConfigForTipo(tipo);
  const prazo = defaultPrazoMeses(bem);
  const pct = defaultPercentualReduzida(bem);
  const result = estimarCreditoConsorcioPorParcela({
    parcelaDesejada: parcela,
    prazoMeses: prazo,
    percentualParcelaReduzida: pct,
    taxaAdministrativaPercentual: bem.taxaAdministrativaPadrao,
    fundoReservaPercentual: bem.fundoReservaPadrao,
    seguroPrestamistaPercentual: bem.seguroPrestamistaPadrao,
  });
  if (!result) return null;
  return {
    result,
    meta: {
      modo_assistente: "guided",
      intencao: "quanto_consigo_de_credito",
      parcela_desejada: parcela,
      prazo_meses: prazo,
      percentual_parcela_reduzida: pct,
      credito_estimado: result.creditoContratadoEstimado,
      parcela_reduzida: result.parcelaReduzida,
      parcela_integral: result.parcelaIntegral,
      saldo_devedor_estimado: result.saldoDevedorEstimado,
      tipo_credito: tipo,
    },
  };
}

function formatCreditResultMessage(
  parcela: number,
  tipo: TipoCreditoPublico,
  calc: NonNullable<ReturnType<typeof calcularCreditoGuided>>,
): string {
  const { result, meta } = calc;
  const prazo = meta.prazo_meses as number;
  const pct = meta.percentual_parcela_reduzida as number;
  return (
    `Com uma parcela aproximada de ${formatBRL(parcela)}, você pode simular um crédito estimado de ${formatBRL(result.creditoContratadoEstimado)} no consórcio (${tipo}), ` +
    `considerando parcela reduzida de ${pct}% e prazo de ${prazo} meses.\n\n` +
    `Parcela reduzida estimada: ${formatBRL(result.parcelaReduzida)} · Parcela integral: ${formatBRL(result.parcelaIntegral)}.\n\n` +
    `Quer que um especialista valide essa simulação? Me informe seu nome e WhatsApp.`
  );
}

function collectCreditInputsFromHistory(history: IaChatMessage[]): {
  tipo?: TipoCreditoPublico;
  parcela?: number;
} {
  let tipo: TipoCreditoPublico | undefined;
  let parcela: number | undefined;
  for (const m of history) {
    if (m.role !== "user") continue;
    const t = parseTipoCreditoFromText(m.content);
    if (t) tipo = t;
    const exact = TIPOS_CREDITO_PUBLICO.find((x) => x.toLowerCase() === m.content.trim().toLowerCase());
    if (exact) tipo = exact;
    const p = parseParcelaDesejadaFromText(m.content);
    if (p) parcela = p;
  }
  return { tipo, parcela };
}

function runCreditFlow(
  history: IaChatMessage[],
  config: IaConfig,
  state: GuidedFlowState | null,
  lastUser: string,
): GuidedAssistantResult {
  let flow = state?.flow === "credit" ? { ...state } : ({ flow: "credit" as const, step: "start" } satisfies GuidedFlowState);

  const intent = detectGuidedIntent(lastUser);
  const parcelaFromText = parseParcelaDesejadaFromText(lastUser);
  const tipoFromText = parseTipoCreditoFromText(lastUser);
  const collected = collectCreditInputsFromHistory(history);

  if (flow.step === "start" || !state || state.flow !== "credit") {
    flow.tipoCredito = flow.tipoCredito ?? state?.tipoCredito ?? collected.tipo;
    flow.parcelaDesejada = flow.parcelaDesejada ?? state?.parcelaDesejada ?? collected.parcela;

    if (flow.parcelaDesejada != null && flow.tipoCredito) {
      flow.step = "result";
    } else if (flow.parcelaDesejada != null) {
      flow.step = "tipo";
    } else if (flow.tipoCredito && (intent === "quanto_credito" || collected.parcela == null)) {
      flow.step = "parcela";
    } else if (parcelaFromText && tipoFromText) {
      flow.tipoCredito = tipoFromText;
      flow.parcelaDesejada = parcelaFromText;
      flow.step = "result";
    } else if (parcelaFromText) {
      flow.parcelaDesejada = parcelaFromText;
      flow.step = "tipo";
    } else if (tipoFromText && intent === "quanto_credito") {
      flow.tipoCredito = tipoFromText;
      flow.step = "parcela";
    } else {
      flow.step = "tipo";
      return {
        reply: withState(
          `Vamos estimar quanto de crédito você consegue no consórcio.\n\nQual tipo de crédito? (${TIPOS_CREDITO_PUBLICO.join(", ")})`,
          flow,
        ),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
  }

  if (flow.step === "tipo" && !flow.tipoCredito) {
    const tipo =
      tipoFromText ??
      collected.tipo ??
      (TIPOS_CREDITO_PUBLICO.find((t) => lastUser.trim().toLowerCase() === t.toLowerCase()) as
        | TipoCreditoPublico
        | undefined);
    if (!tipo) {
      return {
        reply: withState(
          `Informe o tipo de crédito: ${TIPOS_CREDITO_PUBLICO.join(", ")}.`,
          flow,
        ),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
    flow.tipoCredito = tipo;
    flow.step = flow.parcelaDesejada ? "result" : "parcela";
  }

  if (flow.step === "parcela" && flow.parcelaDesejada == null) {
    const parcela = parcelaFromText ?? collected.parcela;
    if (!parcela) {
      return {
        reply: withState("Quanto você pretende pagar por mês? (ex.: R$ 500 ou 500)", flow),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
    flow.parcelaDesejada = parcela;
    flow.step = "result";
  }

  if (flow.step === "result" && flow.tipoCredito && flow.parcelaDesejada != null && !flow.simulacao) {
    const calc = calcularCreditoGuided(flow.tipoCredito, flow.parcelaDesejada);
    if (!calc) {
      return {
        reply: withState("Não consegui calcular com esses valores. Tente outra parcela ou use o simulador completo.", flow),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
    flow.simulacao = calc.meta;
    flow.intencao = "quanto_consigo_de_credito";
    flow.step = "lead";
    return {
      reply: withState(formatCreditResultMessage(flow.parcelaDesejada, flow.tipoCredito, calc), flow),
      showLeadCapture: false,
      prontoParaLead: false,
      state: flow,
    };
  }

  if (flow.step === "lead" || flow.simulacao) {
    const extracao = extrairLeadDaConversa(history);
    const nome = extracao.dados.nome;
    const whatsapp = extracao.dados.whatsapp;
    if (!nome) {
      return {
        reply: withState("Qual é o seu nome?", flow),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
    if (!whatsapp) {
      return {
        reply: withState(`Obrigado, ${nome.split(" ")[0]}! Qual seu WhatsApp com DDD?`, flow),
        showLeadCapture: false,
        prontoParaLead: false,
        state: flow,
      };
    }
    const sim = flow.simulacao ?? {};
    return {
      reply: withState(
        config.regras.mensagemPosCadastro ||
          "Perfeito! Registrei seu interesse para um especialista validar a simulação.",
        { flow: "idle" },
      ),
      showLeadCapture: false,
      prontoParaLead: true,
      leadPayload: {
        intencao: "quanto_consigo_de_credito",
        nome,
        whatsapp,
        tipoCredito: flow.tipoCredito,
        valorCredito: (sim.credito_estimado as number) ?? undefined,
        observacao: `Simulação guiada — parcela ${formatBRL(flow.parcelaDesejada ?? 0)}`,
        dadosSimulacao: sim,
      },
      state: { flow: "idle" },
    };
  }

  return {
    reply: withState(
      `Qual tipo de crédito? (${TIPOS_CREDITO_PUBLICO.join(", ")})`,
      { flow: "credit", step: "tipo" },
    ),
    showLeadCapture: false,
    prontoParaLead: false,
  };
}

function runExpertFlow(history: IaChatMessage[], config: IaConfig, state: GuidedFlowState | null): GuidedAssistantResult {
  const flow: GuidedFlowState = state?.flow === "expert" ? { ...state } : { flow: "expert", step: "nome", intencao: "especialista" };
  const extracao = extrairLeadDaConversa(history);
  const dados = extracao.dados;

  if (!dados.nome) {
    return {
      reply: withState("Para falar com um especialista, qual é o seu nome?", flow),
      showLeadCapture: false,
      prontoParaLead: false,
      state: flow,
    };
  }
  if (!dados.whatsapp) {
    return {
      reply: withState(`Obrigado, ${dados.nome.split(" ")[0]}! Qual seu WhatsApp com DDD?`, flow),
      showLeadCapture: false,
      prontoParaLead: false,
      state: flow,
    };
  }
  if (!dados.tipoCredito) {
    return {
      reply: withState(`Qual tipo de crédito você busca? (${TIPOS_CREDITO_PUBLICO.join(", ")})`, flow),
      showLeadCapture: false,
      prontoParaLead: false,
      state: flow,
    };
  }
  if (dados.valorAproximado == null || dados.valorAproximado <= 0) {
    return {
      reply: withState("Qual valor aproximado de crédito você pretende? (ex.: 300 mil ou R$ 80.000)", flow),
      showLeadCapture: false,
      prontoParaLead: false,
      state: flow,
    };
  }

  return {
    reply: withState(
      config.regras.mensagemPosCadastro || "Registrei seus dados. Em breve um especialista pode entrar em contato.",
      { flow: "idle" },
    ),
    showLeadCapture: false,
    prontoParaLead: true,
    leadPayload: {
      intencao: "especialista",
      nome: dados.nome,
      whatsapp: dados.whatsapp,
      tipoCredito: dados.tipoCredito,
      valorCredito: dados.valorAproximado,
      observacao: dados.observacao,
      dadosSimulacao: { modo_assistente: "guided", intencao: "especialista" },
    },
    state: { flow: "idle" },
  };
}

/** Resposta determinística do assistente (sem OpenAI). */
export function buildGuidedReply(history: IaChatMessage[], config: IaConfig): GuidedAssistantResult {
  const users = history.filter((m) => m.role === "user");
  const lastUser = users.slice(-1)[0]?.content ?? "";
  const state = parseGuidedStateFromHistory(history);
  const intent = detectGuidedIntent(lastUser);

  if (state?.flow === "credit") {
    return runCreditFlow(history, config, state, lastUser);
  }
  if (state?.flow === "expert") {
    return runExpertFlow(history, config, state);
  }

  if (intent === "quanto_credito" || /verificar crédito|verificar credito/.test(lastUser.toLowerCase())) {
    return runCreditFlow(history, config, null, lastUser);
  }

  if (intent === "especialista") {
    return runExpertFlow(history, config, null);
  }

  if (intent === "eventos") {
    return {
      reply: "Confira nossos eventos em /eventos — lá você vê datas e inscrições. Quer simular crédito ou falar com especialista?",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  if (intent === "indicar") {
    return {
      reply: "Para indicar alguém, acesse /indicar e preencha o formulário. Posso ajudar com simulação de crédito também.",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  if (intent === "calculadoras") {
    return {
      reply: "Use as calculadoras em /calculadoras para estimativas de aplicação, financiamento e mais. Quer saber quanto consigo de crédito por parcela?",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  if (intent === "simular") {
    return {
      reply:
        "Para simular com mais detalhes, abra o Simulador no menu ou clique em Simular consórcio nos atalhos. Quer que eu estime quanto de crédito cabe na sua parcela mensal?",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  if (intent === "financiamento") {
    return {
      reply:
        "No simulador dá para comparar financiamento e consórcio. Use o atalho Comparar financiamento ou me diga quanto pode pagar por mês que estimo o crédito no consórcio.",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  if (intent === "grupos") {
    return {
      reply: "Grupos disponíveis estão em /grupos. Se quiser, use Quanto consigo de crédito? ou Falar com especialista.",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  const parcela = parseParcelaDesejadaFromText(lastUser);
  const tipo = parseTipoCreditoFromText(lastUser);
  if (parcela || tipo) {
    return runCreditFlow(history, config, null, lastUser);
  }

  if (users.length <= 1) {
    return {
      reply:
        config.identidade.mensagemInicial ||
        "Olá! Use os atalhos ou pergunte quanto consigo de crédito, simular consórcio ou falar com especialista.",
      showLeadCapture: false,
      prontoParaLead: false,
    };
  }

  return {
    reply:
      config.regras.mensagemCapturaLead ||
      "Posso estimar crédito pela parcela, simular consórcio ou registrar seu contato. O que prefere?",
    showLeadCapture: true,
    prontoParaLead: false,
  };
}
