"use client";

import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { normalizePageAppearance, pageAppearanceCss, visualDefaults, type SiteVisualIdentity } from "@/lib/tenant/site-appearance";

export function SiteAppearance({ identity, children }: { identity: SiteVisualIdentity; children: ReactNode }) {
  const path = usePathname();
  const page = path.replace(/\/$/, "") || "/";
  const config = normalizePageAppearance(identity.paginas_blocos)[page]?.pagina;
  // As landings do programa possuem tokens próprios para superfícies claras,
  // hero azul e CTAs. A camada "tenant-operational" foi criada para telas
  // administrativas legadas e sobrescrevia cores de links/botões dessas
  // páginas, deixando alguns elementos sem contraste.
  const isPartnerLanding = page === "/parceiros" || page.startsWith("/parceiros/");
  const usesOperationalAppearance = !["/", "/simulador", "/grupos"].includes(page) && !isPartnerLanding;
  return <div className={`tenant-racon-content ${usesOperationalAppearance ? "tenant-operational site-appearance" : ""}`} data-site-page={page} style={visualDefaults(identity) as CSSProperties}>
    {usesOperationalAppearance && <style>{pageAppearanceCss(identity, page)}</style>}
    {usesOperationalAppearance && config?.imagem_url && <img src={config.imagem_url} alt="" className="site-page-banner" style={{ objectFit: config.imagem_ajuste || "cover", objectPosition: (config.imagem_posicao || "center").replace("-", " ") } as CSSProperties} />}
    {usesOperationalAppearance ? <div data-site-block="conteudo">{children}</div> : children}
  </div>;
}
