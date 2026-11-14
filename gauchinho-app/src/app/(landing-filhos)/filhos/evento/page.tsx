import type { Metadata } from "next";
import { Brand } from "@/components/eua/eua-ui";
import { HerancaForm } from "@/components/heranca/heranca-form";
import { fraunces } from "@/components/heranca/fonts";
import { carregarEventoHerancaView } from "@/lib/heranca-inteligente/evento";
import { EUA_ICONE_GAUCHINHO } from "@/lib/eua-landing/config";
import s from "@/components/heranca/heranca.module.css";

export const dynamic = "force-dynamic";

const TITULO = "Encontro Método Herança Inteligente 🔑";
const DESCRICAO = "Reserve sua vaga no encontro gratuito: a herança que você vive junto com seus filhos.";

export const metadata: Metadata = {
  title: { absolute: "Inscrição · Encontro Herança Inteligente" },
  description: DESCRICAO,
  openGraph: { title: TITULO, description: DESCRICAO, siteName: "Racon Consórcios · Franqueado Gauchinho", locale: "pt_BR", type: "website" },
};

/** Destino do QR code: vai direto para a inscrição no encontro. */
export default async function HerancaEventoPage() {
  const evento = await carregarEventoHerancaView().catch(() => null);
  const vagas =
    evento?.vagasRestantes != null
      ? evento.vagasRestantes > 0
        ? `Restam ${evento.vagasRestantes} ${evento.vagasRestantes === 1 ? "vaga" : "vagas"}`
        : "Vagas esgotadas · lista de prioridade aberta"
      : null;
  return (
    <div className={`${fraunces.variable} ${s.root}`} style={{ paddingBottom: 0 }}>
      <div className={s.evPage}>
        <div className={s.wrap}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Brand iconUrl={EUA_ICONE_GAUCHINHO} franqueado="FRANQUEADO" />
          </div>
          <div className={s.evHead}>
            <span className={s.eyebrow}>✦ Encontro presencial e gratuito</span>
            <h1 style={{ marginTop: 12 }}>
              A herança que <span className={s.it}>você vive junto.</span>
            </h1>
            <p className={s.mutedDark}>
              {evento?.dataLabel ? (
                <>
                  <b style={{ color: "#fff" }}>{evento.dataLabel}</b>
                  {evento.local ? ` · ${evento.local}` : ""}
                </>
              ) : (
                "Data e local confirmados pelo WhatsApp."
              )}
            </p>
            {vagas ? (
              <span className={s.vagas}>
                <i className={s.vagasPonto} />
                {vagas}
              </span>
            ) : null}
          </div>
          <div className={s.evBox}>
            <HerancaForm evento={evento} somenteEvento />
            <a className={s.evLink} href="./">
              Conhecer o Método Herança Inteligente →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
