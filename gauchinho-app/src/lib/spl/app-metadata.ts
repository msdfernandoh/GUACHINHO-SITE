import type { Metadata } from "next";

/** Metadados para o link pessoal virar app na tela inicial (Android e iPhone). */
export function metadataAppSpl(args: { titulo: string; inicio: string; nomeApp: string; curto: string }): Metadata {
  const q = new URLSearchParams({ inicio: args.inicio, nome: args.nomeApp, curto: args.curto });
  return {
    title: { absolute: args.titulo },
    robots: { index: false, follow: false },
    manifest: `/api/public/spl/manifest?${q.toString()}`,
    appleWebApp: { capable: true, title: args.curto, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/spl-img/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/spl-img/app-icon-180.png", sizes: "180x180" }],
    },
  };
}
