import type { IaConfig } from "@/lib/config/ia-defaults";
import type { IaChatMessage } from "./types";
import { extrairLeadDaConversa } from "./extrair-lead";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";

export const FALLBACK_WELCOME_NO_AI =
  "Posso te ajudar pelos atalhos abaixo ou te direcionar para um especialista. Para atendimento personalizado, clique em Falar com especialista ou me conte seu objetivo (consórcio, financiamento, imóvel, veículo).";

export const FALLBACK_PROVIDER_ERROR =
  "Não consegui responder automaticamente agora, mas posso registrar seu interesse para um especialista te chamar.";

function intentReply(text: string): string | null {
  const t = text.toLowerCase();
  if (/simul|consórcio|consorcio/.test(t)) {
    return "Para uma simulação orientativa, use o Simulador no site — você informa valor e prazo e vê parcelas estimadas. Quer que eu anote seu contato para um especialista validar?";
  }
  if (/financi/.test(t)) {
    return "Financiamento depende de análise de crédito; no simulador dá para comparar estimativas com consórcio. Posso registrar seu WhatsApp para um especialista continuar?";
  }
  if (/grupo/.test(t)) {
    return "Os grupos disponíveis estão em Grupos no menu. Se quiser, me diga seu nome, WhatsApp, tipo de crédito e valor aproximado que registro seu interesse.";
  }
  if (/carta|contempl/.test(t)) {
    return "Cartas contempladas variam conforme estoque — veja Contempladas no site. Para avisar quando houver oportunidade, preciso do seu nome e WhatsApp.";
  }
  if (/imóvel|imovel|oportunidade/.test(t)) {
    return "Temos oportunidades imobiliárias na vitrine Imóveis. Me conte nome, WhatsApp e valor aproximado se quiser retorno de um especialista.";
  }
  if (/calculadora|invest|aplic/.test(t)) {
    return "As calculadoras geram estimativas (sem garantia de rentabilidade). Use Calculadoras no menu ou me passe nome e WhatsApp para orientação personalizada.";
  }
  if (/especialista|atend|humano|whatsapp|zap/.test(t)) {
    return "Clique em Falar com especialista nos atalhos ou informe: nome, WhatsApp, tipo de crédito (Imóvel, Veículo, etc.) e valor aproximado do crédito.";
  }
  return null;
}

/** Respostas guiadas quando não há provider OpenAI ou após falha. */
export function buildFallbackReply(
  history: IaChatMessage[],
  config: IaConfig,
): { reply: string; showLeadCapture: boolean } {
  const intent = intentReply(history.filter((m) => m.role === "user").slice(-1)[0]?.content ?? "");
  const { dados, prontoParaLead } = extrairLeadDaConversa(history);

  if (prontoParaLead) {
    return {
      reply:
        config.regras.mensagemPosCadastro ||
        "Perfeito! Com esses dados já consigo registrar seu interesse para um especialista entrar em contato. Confirme se está tudo certo ou use o formulário abaixo.",
      showLeadCapture: false,
    };
  }

  if (intent && history.filter((m) => m.role === "user").length <= 2) {
    return { reply: intent, showLeadCapture: false };
  }

  if (!dados.nome) {
    return {
      reply: "Para continuar, qual é o seu nome?",
      showLeadCapture: false,
    };
  }
  if (!dados.whatsapp) {
    return {
      reply: `Obrigado, ${dados.nome.split(" ")[0]}! Qual seu WhatsApp com DDD?`,
      showLeadCapture: false,
    };
  }
  if (!dados.tipoCredito) {
    return {
      reply: `Qual tipo de crédito você busca? (${TIPOS_CREDITO_PUBLICO.join(", ")})`,
      showLeadCapture: false,
    };
  }
  if (dados.valorAproximado == null || dados.valorAproximado <= 0) {
    return {
      reply: "Qual valor aproximado de crédito você pretende? (ex.: 300 mil ou R$ 80.000)",
      showLeadCapture: false,
    };
  }

  return {
    reply: config.regras.mensagemCapturaLead || FALLBACK_WELCOME_NO_AI,
    showLeadCapture: true,
  };
}

export function isOpenAiConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const provider = (process.env.IA_PROVIDER ?? "openai").toLowerCase();
  return Boolean(apiKey && provider === "openai");
}

export function logIaDiagnostics(context: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const provider = process.env.IA_PROVIDER ?? "openai";
  const model = process.env.IA_MODEL?.trim() || "gpt-4o-mini";
  if (!apiKey) console.warn(`[ia/chat] ${context}: OPENAI_API_KEY ausente`);
  else if (provider.toLowerCase() !== "openai") {
    console.warn(`[ia/chat] ${context}: IA_PROVIDER=${provider} (suportado: openai)`);
  } else {
    console.info(`[ia/chat] ${context}: provider=openai model=${model}`);
  }
}
