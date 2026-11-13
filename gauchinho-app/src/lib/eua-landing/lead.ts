import type { UpsertLeadPayload } from "@/lib/crm/upsert-lead";

export const EUA_LEAD_ORIGEM = "landing_eua";

export const EUA_LEAD_ACOES = ["plano", "reuniao", "oportunidade", "contratar"] as const;
export type EuaLeadAcao = (typeof EUA_LEAD_ACOES)[number];

export const EUA_CANAIS_REUNIAO = ["WhatsApp", "Google Meet", "Zoom"] as const;

export type EuaLeadBody = {
  acao: EuaLeadAcao;
  nome: string;
  /** "+<DDI> <número>" — gravado com o DDI para não ser confundido com DDD brasileiro. */
  whatsapp: string;
  email?: string | null;
  cidade?: string | null;
  idioma?: "pt" | "en";
  conjuge?: boolean;
  plano?: {
    objetivo?: string;
    tipoBem?: string;
    urgencia?: string;
    usdMensal?: number;
    cambio?: number;
    creditoTotal?: number;
    parcelaReduzida?: number;
    quantidadeCotas?: number;
    grupo?: string;
  } | null;
  reuniao?: { inicioIso?: string; fuso?: string; canal?: string } | null;
  oportunidade?: { tipo?: string; id?: string | null; titulo?: string | null; valor?: number | null } | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
};

export type EuaLeadParsed = { ok: true; payload: UpsertLeadPayload } | { ok: false; error: string };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function texto(v: unknown, max = 160): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Aceita somente número internacional com DDI explícito. */
export function normalizarWhatsappInternacional(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 11 || digits.length > 15) return null;
  if (digits.startsWith("1")) return `+1 ${digits.slice(1)}`;
  if (digits.startsWith("55")) return `+55 ${digits.slice(2)}`;
  return `+${digits}`;
}

function formatarReuniao(inicioIso: string, fuso: string | null): string | null {
  const data = new Date(inicioIso);
  if (Number.isNaN(data.getTime())) return null;
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data);
  let cliente = "";
  if (fuso) {
    try {
      cliente = ` (cliente: ${fmt(fuso)} ${fuso})`;
    } catch {
      cliente = "";
    }
  }
  return `${fmt("America/Cuiaba")} horário de Sinop${cliente}`;
}

export function parseEuaLeadBody(body: unknown): EuaLeadParsed {
  const b = (body ?? {}) as Partial<EuaLeadBody>;
  if (!b.acao || !EUA_LEAD_ACOES.includes(b.acao)) return { ok: false, error: "Ação inválida." };
  const nome = texto(b.nome, 120);
  if (!nome) return { ok: false, error: "Informe seu nome." };
  const whatsapp = normalizarWhatsappInternacional(b.whatsapp);
  if (!whatsapp) return { ok: false, error: "Informe o WhatsApp com o código do país (ex.: +1)." };

  const email = texto(b.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };

  const plano = b.plano ?? null;
  const tipoBem = plano?.tipoBem === "veiculo" ? "veiculo" : "imovel";
  const credito = numero(plano?.creditoTotal);
  const parcela = numero(plano?.parcelaReduzida);
  const usd = numero(plano?.usdMensal);
  const cambio = numero(plano?.cambio);

  let quandoAtendimento: string | null = null;
  let preferencia: string | null = null;
  if (b.acao === "reuniao") {
    const canal = texto(b.reuniao?.canal, 30);
    preferencia = canal && (EUA_CANAIS_REUNIAO as readonly string[]).includes(canal) ? `Reunião online — ${canal}` : "Reunião online";
    const inicio = texto(b.reuniao?.inicioIso, 40);
    quandoAtendimento = inicio ? formatarReuniao(inicio, texto(b.reuniao?.fuso, 60)) : null;
    if (!quandoAtendimento) return { ok: false, error: "Escolha um horário para a reunião." };
  }

  const linhas: string[] = ["Página EUA (brasileiros nos Estados Unidos)."];
  linhas.push(`Ação: ${b.acao}. Idioma: ${b.idioma === "en" ? "inglês" : "português"}.`);
  if (plano) {
    linhas.push(
      `Plano: objetivo ${texto(plano.objetivo, 30) ?? "-"}, urgência ${texto(plano.urgencia, 20) ?? "-"}, ` +
        `${usd ? `US$ ${usd.toFixed(0)}/mês` : "-"}${cambio ? ` (câmbio ${cambio.toFixed(2)})` : ""}, ` +
        `crédito ${credito ? BRL.format(credito) : "-"}${plano.quantidadeCotas && plano.quantidadeCotas > 1 ? ` em ${plano.quantidadeCotas} cotas` : ""}, ` +
        `parcela reduzida ${parcela ? BRL.format(parcela) : "-"}, grupo ${texto(plano.grupo, 20) ?? "-"}.`,
    );
  }
  if (b.oportunidade) {
    const o = b.oportunidade;
    linhas.push(
      `Oportunidade: ${texto(o.tipo, 30) ?? "-"} — ${texto(o.titulo, 140) ?? "lista de imóveis novos e devolvidos"}` +
        `${numero(o.valor) ? ` (${BRL.format(numero(o.valor)!)})` : ""}${texto(o.id, 40) ? ` [id ${texto(o.id, 40)}]` : ""}.`,
    );
  }
  if (b.conjuge) linhas.push("Pediu para o cônjuge também receber o plano.");

  const detalhe = `eua_${b.acao}`;
  return {
    ok: true,
    payload: {
      nome,
      whatsapp,
      email,
      cidade: texto(b.cidade, 80),
      origem: EUA_LEAD_ORIGEM,
      origem_detalhe: detalhe,
      tipo_interesse: b.acao === "oportunidade" ? "imovel" : tipoBem,
      tipo_credito: tipoBem,
      valor_credito: credito,
      valor_estimado: credito,
      valor_simulado: credito,
      valor_parcela: parcela,
      capacidade_mensal: usd ? `US$ ${usd.toFixed(0)}/mês${cambio ? ` (≈ ${BRL.format(usd * cambio)})` : ""}` : null,
      prazo_utilizacao_credito: texto(plano?.urgencia, 20),
      preferencia_atendimento: preferencia,
      quando_atendimento: quandoAtendimento,
      dados_simulacao: plano ? { ...plano, origem: "landing_eua" } : null,
      resultado_resumido: credito ? `Crédito ${BRL.format(credito)} via página EUA` : null,
      observacoes: linhas.join("\n"),
      utm_source: texto(b.utm?.source, 80),
      utm_medium: texto(b.utm?.medium, 80),
      utm_campaign: texto(b.utm?.campaign, 120),
    },
  };
}
