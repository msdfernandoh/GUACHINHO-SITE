import "server-only";

/**
 * Configuração global da integração WhatsApp Cloud API (app único da Meta,
 * multiempresa via Embedded Signup). Valores sensíveis só no servidor.
 */
export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
export const WHATSAPP_GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;

export function getMetaAppId(): string {
  const v = process.env.WHATSAPP_APP_ID;
  if (!v) throw new Error("WHATSAPP_APP_ID não configurado");
  return v;
}

export function getMetaAppSecret(): string {
  const v = process.env.WHATSAPP_APP_SECRET;
  if (!v) throw new Error("WHATSAPP_APP_SECRET não configurado");
  return v;
}

export function getEmbeddedSignupConfigId(): string {
  const v = process.env.WHATSAPP_CONFIG_ID;
  if (!v) throw new Error("WHATSAPP_CONFIG_ID não configurado");
  return v;
}

/** Token de verificação do webhook (GET hub.verify_token). Global p/ a plataforma. */
export function getWebhookVerifyToken(): string {
  const v = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!v) throw new Error("WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado");
  return v;
}

/** Valores públicos (client component do Embedded Signup). */
export const WHATSAPP_PUBLIC = {
  graphVersion: WHATSAPP_GRAPH_VERSION,
};
