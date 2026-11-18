import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { caminhoPortfolio } from "./links";

function assinaturaDashboard(tokenPainel: string, vendedorId: string) {
  return createHmac("sha256", tokenPainel).update(`spl-dashboard-vendedor:${vendedorId}`).digest("base64url");
}

export function caminhoDashboardVendedor(nome: string, codigo: string, vendedorId: string, tokenPainel: string) {
  return `${caminhoPortfolio(nome, codigo)}/dashboard?acesso=${assinaturaDashboard(tokenPainel, vendedorId)}`;
}

export function acessoDashboardVendedorValido(tokenPainel: string, vendedorId: string, acesso: unknown) {
  if (typeof acesso !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(acesso)) return false;
  return timingSafeEqual(Buffer.from(acesso), Buffer.from(assinaturaDashboard(tokenPainel, vendedorId)));
}
