import type { SiteConfig } from "@/lib/config/defaults";
import { HomeSection } from "./home-section";

export function HomeAbout({ site }: { site: SiteConfig }) {
  const nome = site.nomeEmpresa?.trim() || "Gauchinho Escritório de Soluções Financeiras";

  return (
    <HomeSection
      eyebrow="Quem somos"
      title="Escritório consultivo, não apenas simulador"
      subtitle={`O ${nome} orienta famílias e empresas na escolha entre consórcio, financiamento, cartas contempladas e oportunidades imobiliárias — com transparência e acompanhamento.`}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="font-semibold text-amber-400">Nossa missão</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Encontrar a melhor solução financeira para realizar seu sonho, comparando cenários reais
            e explicando cada etapa — do simulador à proposta formal.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="font-semibold text-amber-400">Como trabalhamos</h3>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>• Simulações alinhadas ao comercial e à planilha de grupos</li>
            <li>• Propostas em PDF e registro de leads com origem rastreável</li>
            <li>• Parcerias com administradoras, crédito e imobiliárias</li>
          </ul>
        </div>
      </div>
    </HomeSection>
  );
}
