import type { ContatoConfig } from "@/lib/config/defaults";
import { HomeCtaLink } from "./home-section";
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
    <section
      id="contato"
      className="relative scroll-mt-24 overflow-hidden py-24"
      style={{
        background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 50%, #0A1628 100%)",
      }}
    >
      {/* Radial gold glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(201,168,76,0.10) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      {/* Top divider line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(to right, transparent, rgba(201,168,76,0.4), transparent)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section header */}
        <div className="mb-10 text-center">
          <p
            className="text-xs font-bold uppercase tracking-[0.28em]"
            style={{ color: "var(--brand-gold)" }}
          >
            Próximo passo
          </p>
          <h2 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            Pronto para realizar seu{" "}
            <span style={{ color: "var(--brand-gold)" }}>sonho</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Fale com um especialista e receba uma orientação personalizada para seu objetivo.
          </p>
        </div>

        <HomeReveal>
          <div
            className="relative overflow-hidden rounded-3xl p-8 md:p-12"
            style={{
              background: "rgba(13,31,60,0.7)",
              border: "1px solid rgba(201,168,76,0.25)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Inner glow */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "rgba(201,168,76,0.14)" }}
              aria-hidden
            />

            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              {/* CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl px-8 py-4 text-sm font-bold transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #C9A84C, #F0D080, #C9A84C)",
                      color: "#0A1628",
                      boxShadow: "0 8px 28px rgba(201,168,76,0.35)",
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                      aria-hidden
                    />
                    <span className="relative z-10">Falar com especialista</span>
                  </a>
                ) : (
                  <HomeCtaLink href="/simulador">Falar com especialista</HomeCtaLink>
                )}
                <HomeCtaLink href="/simulador" variant="outline">
                  Simular agora
                </HomeCtaLink>
              </div>

              {/* Contact info */}
              <div
                className="space-y-3 rounded-2xl p-6 text-sm"
                style={{
                  background: "rgba(10,22,40,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {contato.whatsappPrincipal ? (
                  <p style={{ color: "#94A3B8" }}>
                    <span style={{ color: "#64748B" }}>WhatsApp: </span>
                    {wa ? (
                      <a
                        href={wa}
                        style={{ color: "var(--brand-gold)" }}
                        className="hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {contato.whatsappPrincipal}
                      </a>
                    ) : (
                      contato.whatsappPrincipal
                    )}
                  </p>
                ) : null}
                {contato.telefone ? (
                  <p style={{ color: "#94A3B8" }}>
                    <span style={{ color: "#64748B" }}>Telefone: </span>
                    {contato.telefone}
                  </p>
                ) : null}
                {contato.email ? (
                  <p style={{ color: "#94A3B8" }}>
                    <span style={{ color: "#64748B" }}>E-mail: </span>
                    <a
                      href={`mailto:${contato.email}`}
                      style={{ color: "var(--brand-gold)" }}
                      className="hover:underline"
                    >
                      {contato.email}
                    </a>
                  </p>
                ) : null}
                {!contato.whatsappPrincipal && !contato.email && !contato.telefone ? (
                  <p style={{ color: "#64748B" }}>Configure contatos em /admin/configuracoes.</p>
                ) : null}
              </div>
            </div>
          </div>
        </HomeReveal>
      </div>
    </section>
  );
}
