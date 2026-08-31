"use client";

import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { normalizePageAppearance, pageAppearanceCss, visualDefaults, type SiteVisualIdentity } from "@/lib/tenant/site-appearance";

export function SiteAppearance({ identity, children }: { identity: SiteVisualIdentity; children: ReactNode }) {
  const path = usePathname();
  const page = path.replace(/\/$/, "") || "/";
  const config = normalizePageAppearance(identity.paginas_blocos)[page]?.pagina;
  return <div className={`tenant-racon-content ${page === "/" ? "" : "tenant-operational site-appearance"}`} data-site-page={page} style={visualDefaults(identity) as CSSProperties}>
    {page !== "/" && <style>{pageAppearanceCss(identity, page)}</style>}
    {page !== "/" && config?.imagem_url && <img src={config.imagem_url} alt="" className="site-page-banner" style={{ objectFit: config.imagem_ajuste || "cover", objectPosition: (config.imagem_posicao || "center").replace("-", " ") } as CSSProperties} />}
    {["/", "/simulador", "/grupos"].includes(page) ? children : <div data-site-block="conteudo">{children}</div>}
  </div>;
}
