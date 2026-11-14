import type { Metadata } from "next";
import { headers } from "next/headers";
import { HerancaQr } from "@/components/heranca/heranca-qr";
import { fraunces } from "@/components/heranca/fonts";
import { landingDoHost } from "@/lib/landings/subdominios";
import s from "@/components/heranca/heranca.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "QR code · Inscrição Herança Inteligente" },
  robots: { index: false, follow: false },
};

/** Link único da inscrição no encontro, no domínio em que a página foi aberta. */
async function linkInscricao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "filhos.raconsinop.com.br";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const caminho = landingDoHost(host)?.subdominio === "filhos" ? "/evento" : "/filhos/evento";
  return `${proto}://${host}${caminho}`;
}

export default async function HerancaQrPage() {
  const url = await linkInscricao();
  return (
    <div className={`${fraunces.variable} ${s.root}`} style={{ paddingBottom: 0, background: "#fff" }}>
      <div className={s.qrPage}>
        <div>
          <span className={`${s.eyebrow} ${s.eyebrowDark}`}>Encontro Método Herança Inteligente</span>
          <h1 style={{ marginTop: 10 }}>Aponte a câmera e garanta sua vaga</h1>
          <HerancaQr url={url} />
        </div>
      </div>
    </div>
  );
}
