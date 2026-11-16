import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ModeloVendedor } from "./types";

/** Letra curta do modelo no link de convite. */
const LETRA: Record<ModeloVendedor, string> = { PROPRIO: "p", GERADOR_NEGOCIOS: "n", GERADOR_OPORTUNIDADES: "o" };
const DA_LETRA: Record<string, ModeloVendedor> = { p: "PROPRIO", n: "GERADOR_NEGOCIOS", o: "GERADOR_OPORTUNIDADES" };

/** Assinatura do link de convite por modelo: o vendedor não consegue trocar o modelo pelo endereço. */
function assinatura(tokenPainel: string, codigo: string, letra: string) {
  return createHmac("sha256", tokenPainel).update(`${codigo}:${letra}`).digest("base64url").slice(0, 8);
}

export function parametrosConviteModelo(tokenPainel: string, codigo: string, modelo: ModeloVendedor) {
  const letra = LETRA[modelo];
  return `m=${letra}&s=${assinatura(tokenPainel, codigo, letra)}`;
}

export function modeloDoConvite(tokenPainel: string, codigo: string, m: unknown, s: unknown): ModeloVendedor | null {
  const letra = String(m ?? "");
  const sig = String(s ?? "");
  if (!DA_LETRA[letra] || sig.length !== 8) return null;
  const esperado = Buffer.from(assinatura(tokenPainel, codigo, letra));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? DA_LETRA[letra] : null;
}
