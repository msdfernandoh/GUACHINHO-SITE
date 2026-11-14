import type { UpsertLeadPayload } from "@/lib/crm/upsert-lead";
import { normalizarIdadesFilhos, resumoFilhos } from "@/lib/comercial-eventos/filhos";
import { HERANCA_CREDITO_INICIAL, HERANCA_PARCELA_INICIAL } from "./projecao";

export const HERANCA_LEAD_ORIGEM = "landing_heranca";
export const HERANCA_EVENTO_SLUG = "heranca-inteligente";

export type HerancaLeadParsed = { ok: true; payload: UpsertLeadPayload } | { ok: false; error: string };

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** Telefone brasileiro com DDD (10 ou 11 dígitos), aceitando +55 na frente. */
export function telefoneBrValido(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return Number(d.slice(0, 2)) >= 11 ? d : null;
}

export function parseHerancaLeadBody(body: unknown): HerancaLeadParsed {
  const b = (body ?? {}) as Record<string, unknown>;
  const nome = texto(b.nome, 120);
  if (!nome) return { ok: false, error: "Informe seu nome." };
  const whatsapp = telefoneBrValido(b.whatsapp);
  if (!whatsapp) return { ok: false, error: "Informe o WhatsApp com DDD." };
  let idades: number[] | null;
  try {
    idades = normalizarIdadesFilhos(b.filhosIdades);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Idades inválidas." };
  }
  if (!idades) return { ok: false, error: "Informe quantos filhos e a idade de cada um." };

  const filhos = resumoFilhos(idades);
  return {
    ok: true,
    payload: {
      nome,
      whatsapp,
      origem: HERANCA_LEAD_ORIGEM,
      origem_detalhe: "heranca_informacoes",
      tipo_interesse: "imovel",
      tipo_credito: "imovel",
      produto_interesse: "Método Herança Inteligente",
      valor_credito: HERANCA_CREDITO_INICIAL,
      valor_estimado: HERANCA_CREDITO_INICIAL,
      valor_parcela: HERANCA_PARCELA_INICIAL,
      dados_simulacao: { origem: HERANCA_LEAD_ORIGEM, quantidade_filhos: idades.length, idades_filhos: idades },
      resultado_resumido: `Herança Inteligente — carta de R$ 100 mil (R$ 375/mês) · ${filhos}`,
      observacoes: `Página Herança Inteligente: quer receber informações.\nFilhos: ${filhos}.`,
      utm_source: texto((b.utm as Record<string, unknown> | undefined)?.source, 80),
      utm_medium: texto((b.utm as Record<string, unknown> | undefined)?.medium, 80),
      utm_campaign: texto((b.utm as Record<string, unknown> | undefined)?.campaign, 120),
    },
  };
}
