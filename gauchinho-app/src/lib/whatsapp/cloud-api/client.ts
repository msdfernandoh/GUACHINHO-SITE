import "server-only";
import { WHATSAPP_GRAPH_BASE, getMetaAppId, getMetaAppSecret } from "./config";

function soDigitos(v: string): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Troca o `code` do Embedded Signup por um token de usuário do sistema.
 * Retorna { access_token, expires_in? }.
 */
export async function trocarCodePorToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${WHATSAPP_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", getMetaAppId());
  url.searchParams.set("client_secret", getMetaAppSecret());
  url.searchParams.set("code", code);
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(`Falha ao trocar code por token: ${JSON.stringify(json?.error ?? json)}`);
  }
  return { access_token: json.access_token, expires_in: json.expires_in };
}

type GraphSendResult = {
  ok: boolean;
  waMessageId?: string;
  raw: unknown;
  error?: string;
};

async function postMensagem(
  phoneNumberId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<GraphSendResult> {
  const res = await fetch(`${WHATSAPP_GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, raw: json, error: JSON.stringify(json?.error ?? json) };
  }
  const waMessageId = json?.messages?.[0]?.id as string | undefined;
  return { ok: true, waMessageId, raw: json };
}

/** Atendimento 1:1 — texto livre (dentro da janela de 24h). */
export async function enviarTexto(params: {
  phoneNumberId: string;
  token: string;
  para: string;
  texto: string;
  previewUrl?: boolean;
}): Promise<GraphSendResult> {
  return postMensagem(params.phoneNumberId, params.token, {
    to: soDigitos(params.para),
    type: "text",
    text: { preview_url: params.previewUrl ?? false, body: params.texto },
  });
}

/** Campanhas — template aprovado. components opcional (variáveis/botões). */
export async function enviarTemplate(params: {
  phoneNumberId: string;
  token: string;
  para: string;
  templateNome: string;
  idiomaCodigo?: string;
  components?: unknown[];
}): Promise<GraphSendResult> {
  return postMensagem(params.phoneNumberId, params.token, {
    to: soDigitos(params.para),
    type: "template",
    template: {
      name: params.templateNome,
      language: { code: params.idiomaCodigo ?? "pt_BR" },
      ...(params.components ? { components: params.components } : {}),
    },
  });
}

/** Lista os templates aprovados de uma WABA (para a tela de campanhas). */
export async function listarTemplates(params: {
  wabaId: string;
  token: string;
}): Promise<Array<{ name: string; language: string; status: string; category: string }>> {
  const url = new URL(`${WHATSAPP_GRAPH_BASE}/${params.wabaId}/message_templates`);
  url.searchParams.set("fields", "name,language,status,category");
  url.searchParams.set("limit", "200");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Falha ao listar templates: ${JSON.stringify(json?.error ?? json)}`);
  return (json?.data ?? []).map((t: Record<string, unknown>) => ({
    name: String(t.name),
    language: String(t.language),
    status: String(t.status),
    category: String(t.category ?? ""),
  }));
}
