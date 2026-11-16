import { NextResponse } from "next/server";

/**
 * Manifesto do app SPL para "adicionar à tela inicial". O ícone abre direto no
 * link pessoal (painel da imobiliária, portfólio do vendedor ou painel da SPL).
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const inicio = url.searchParams.get("inicio") ?? "/spl";
  const start = /^\/spl(\/[A-Za-z0-9_\-/]*)?$/.test(inicio) ? inicio : "/spl";
  const nome = (url.searchParams.get("nome") ?? "Portfólio SPL").replace(/[^\p{L}\p{N} .·&-]/gu, "").slice(0, 45) || "Portfólio SPL";
  const curto = (url.searchParams.get("curto") ?? "SPL").replace(/[^\p{L}\p{N} .-]/gu, "").slice(0, 12) || "SPL";
  const manifest = {
    id: start,
    name: nome,
    short_name: curto,
    description: "SPL Engenharia × Racon Consórcios: carteira, clientes e propostas.",
    start_url: start,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A1931",
    theme_color: "#0A1931",
    icons: [
      { src: "/spl-img/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/spl-img/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/spl-img/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
