import type { ContatoConfig } from "@/lib/config/defaults";
import { HomeCtaLink, HomeSection } from "./home-section";
import { HomeReveal } from "./home-reveal";

function waLink(numero: string, text: string) {
  const n = numero.replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function FinalCTASection({ contato }: { contato: ContatoConfig }) {
  const wa = waLink(
    contato.whatsappPrincipal,
    "Olá! Vim pelo site Gauchinho e gostaria de falar com um especialista.",
  );

  return (
    <HomeSection
      id="contato"
      eyebrow="Próximo passo"
      title="Pronto para escolher o melhor caminho?"
      subtitle="Fale com um especialista e receba uma orientação personalizada para seu objetivo."
      className="pb-24"
    >
      <HomeReveal>
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-8 md:p-12">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-8 py-4 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/30 transition hover:brightness-105"
                >
                  Falar com especialista
                </a>
              ) : (
                <HomeCtaLink href="/simulador">Falar com especialista</HomeCtaLink>
              )}
              <HomeCtaLink href="/simulador" variant="outline">
                Simular agora
              </HomeCtaLink>
            </div>
            <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-6 text-sm text-zinc-400">
              {contato.whatsappPrincipal ? (
                <p>
                  <span className="text-zinc-500">WhatsApp: </span>
                  {wa ? (
                    <a href={wa} className="text-amber-400 hover:underline" target="_blank" rel="noreferrer">
                      {contato.whatsappPrincipal}
                    </a>
                  ) : (
                    contato.whatsappPrincipal
                  )}
                </p>
              ) : null}
              {contato.telefone ? (
                <p>
                  <span className="text-zinc-500">Telefone: </span>
                  {contato.telefone}
                </p>
              ) : null}
              {contato.email ? (
                <p>
                  <span className="text-zinc-500">E-mail: </span>
                  <a href={`mailto:${contato.email}`} className="text-amber-400 hover:underline">
                    {contato.email}
                  </a>
                </p>
              ) : null}
              {!contato.whatsappPrincipal && !contato.email && !contato.telefone ? (
                <p className="text-zinc-500">Configure contatos em /admin/configuracoes.</p>
              ) : null}
            </div>
          </div>
        </div>
      </HomeReveal>
    </HomeSection>
  );
}
