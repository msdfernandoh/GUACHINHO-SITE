import { normalizeHost } from "@/lib/tenant/dominio";

/**
 * Páginas de vendas servidas em subdomínio próprio do domínio de um site
 * (ex.: eua.raconsinop.com.br, filhos.raconsinop.com.br). O subdomínio herda o
 * tenant do domínio pai: não precisa de cadastro em empresa_dominios nem em
 * parceiro_site_dominios.
 *
 * `rotas` mapeia caminhos curtos do subdomínio para a rota real da página.
 */
export const LANDING_SUBDOMINIOS = {
  eua: { base: "/eua", rotas: { "/": "/eua" } },
  filhos: { base: "/filhos", rotas: { "/": "/filhos", "/evento": "/filhos/evento", "/qr": "/filhos/qr" } },
} as const satisfies Record<string, { base: string; rotas: Record<string, string> }>;

export type LandingSubdominio = keyof typeof LANDING_SUBDOMINIOS;

export type LandingDoHost = { subdominio: LandingSubdominio; parent: string };

/** Identifica `<landing>.<domínio pai>`; qualquer outro host → null. */
export function landingDoHost(rawHost: string | null | undefined): LandingDoHost | null {
  const host = normalizeHost(rawHost);
  const ponto = host.indexOf(".");
  if (ponto <= 0) return null;
  const prefixo = host.slice(0, ponto);
  const parent = host.slice(ponto + 1);
  if (!(prefixo in LANDING_SUBDOMINIOS) || !parent.includes(".")) return null;
  return { subdominio: prefixo as LandingSubdominio, parent };
}

/** Rota real para um caminho curto do subdomínio; demais caminhos seguem sem reescrita. */
export function landingRewritePath(landing: LandingDoHost, pathname: string): string | null {
  const rotas: Record<string, string> = LANDING_SUBDOMINIOS[landing.subdominio].rotas;
  const chave = pathname === "" ? "/" : pathname.replace(/\/+$/, "") || "/";
  return rotas[chave] ?? null;
}

/** Host usado para resolver o tenant: o subdomínio de landing vale como o domínio pai. */
export function hostParaResolucaoTenant(rawHost: string | null): string | null {
  return landingDoHost(rawHost)?.parent ?? rawHost;
}

/** Bases das landings, liberadas no domínio principal sem reescrita para a home do parceiro. */
export const LANDING_BASES: string[] = Object.values(LANDING_SUBDOMINIOS).map((l) => l.base);
