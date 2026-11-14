import type { Metadata } from "next";
import { HerancaLanding } from "@/components/heranca/heranca-landing";
import { fraunces } from "@/components/heranca/fonts";
import { carregarEventoHerancaView } from "@/lib/heranca-inteligente/evento";
import { EUA_ICONE_GAUCHINHO } from "@/lib/eua-landing/config";

export const dynamic = "force-dynamic";

const TITULO = "A herança que você vive junto 🔑";
const DESCRICAO =
  "Com R$ 375 por mês você começa hoje o patrimônio do seu filho: de R$ 317 mil a R$ 599 mil em 16 anos. Conheça o Método Herança Inteligente.";

export const metadata: Metadata = {
  title: { absolute: "Método Herança Inteligente · Racon Consórcios" },
  description: DESCRICAO,
  alternates: { canonical: "/filhos" },
  openGraph: { title: TITULO, description: DESCRICAO, siteName: "Racon Consórcios · Franqueado Gauchinho", locale: "pt_BR", type: "website" },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRICAO },
};

export default async function HerancaPage() {
  const evento = await carregarEventoHerancaView().catch(() => null);
  return (
    <div className={fraunces.variable} style={{ width: "100%" }}>
      <HerancaLanding evento={evento} iconeUrl={EUA_ICONE_GAUCHINHO} />
    </div>
  );
}
