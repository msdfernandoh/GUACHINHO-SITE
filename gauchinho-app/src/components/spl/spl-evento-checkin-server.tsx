import { dadosPaginaCheckinSpl } from "@/lib/spl/evento-checkin";
import { SplEventoCheckin } from "./spl-evento-checkin";

/** Carrega imobiliárias e empreendimentos e monta o check-in SPL (site spl., QR fixo e rota do evento). */
export async function SplEventoCheckinServer({
  eventoId,
  eventoNome,
  inicioDireto = false,
}: {
  eventoId: string;
  eventoNome: string;
  inicioDireto?: boolean;
}) {
  const dados = await dadosPaginaCheckinSpl();
  return (
    <div className="-mx-4 min-h-[80vh] bg-[#0A1931] px-4 py-6 sm:py-10">
      <SplEventoCheckin
        evento={{ id: eventoId, nome: eventoNome }}
        imobiliarias={dados.imobiliarias}
        empreendimentos={dados.empreendimentos}
        inicioDireto={inicioDireto}
      />
    </div>
  );
}
