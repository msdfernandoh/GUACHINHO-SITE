import { hostParaResolucaoTenant, landingDoHost, landingRewritePath } from "@/lib/landings/subdominios";

/** Página de vendas para brasileiros nos EUA. */
export const EUA_LANDING_PATH = "/eua";

/** Domínio pai de `eua.<dominio>`; qualquer outro host → null. */
export function euaParentHost(rawHost: string | null | undefined): string | null {
  const landing = landingDoHost(rawHost);
  return landing?.subdominio === "eua" ? landing.parent : null;
}

export { hostParaResolucaoTenant };

/** No subdomínio EUA a raiz exibe a página de vendas; demais rotas seguem normais. */
export function euaLandingRewritePath(pathname: string): string | null {
  return landingRewritePath({ subdominio: "eua", parent: "" }, pathname);
}
