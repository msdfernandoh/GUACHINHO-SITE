"use client";

import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { normalizePageAppearance, pageAppearanceCss, visualDefaults, type SiteVisualIdentity } from "@/lib/tenant/site-appearance";

export function SiteAppearance({ identity, children }: { identity: SiteVisualIdentity; children: ReactNode }) {
  const path = usePathname();
  const page = path.replace(/\/$/, "") || "/";
  const config = normalizePageAppearance(identity.paginas_blocos)[page]?.pagina;
  // As landings do programa possuem tokens próprios para superfícies claras,
  // hero azul e CTAs. As telas públicas operacionais — inclusive simulador e
  // tabela de grupos — usam controles legados e precisam da camada que os
  // converte para a paleta clara e configurável do tenant Racon.
  const isPartnerLanding = page === "/parceiros" || page.startsWith("/parceiros/");
  // O telão de sorteio é uma peça de palco intencionalmente escura; não deve
  // receber a conversão de contraste destinada a páginas de navegação.
  const isStageDisplay = /^\/eventos\/[^/]+\/telao$/.test(page);
  const usesOperationalAppearance = page !== "/" && !isPartnerLanding && !isStageDisplay;
  return <div className={`tenant-racon-content ${usesOperationalAppearance ? "tenant-operational site-appearance" : ""}`} data-site-page={page} style={visualDefaults(identity) as CSSProperties}>
    {usesOperationalAppearance && <style>{pageAppearanceCss(identity, page)}</style>}
    {usesOperationalAppearance && config?.imagem_url && <img src={config.imagem_url} alt="" className="site-page-banner" style={{ objectFit: config.imagem_ajuste || "cover", objectPosition: (config.imagem_posicao || "center").replace("-", " ") } as CSSProperties} />}
    {usesOperationalAppearance ? <div data-site-block="conteudo">{children}</div> : children}
  </div>;
}
