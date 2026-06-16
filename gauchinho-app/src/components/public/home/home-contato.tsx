import type { ContatoConfig } from "@/lib/config/defaults";
import { cn } from "@/lib/utils/cn";
import { HomeSection } from "./home-section";

const ctaClass = {
  gold:
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400",
  outline:
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/50 hover:text-amber-300",
};

function waLink(numero: string, text: string) {
  const n = numero.replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function HomeContato({ contato }: { contato: ContatoConfig }) {
  const wa = waLink(
    contato.whatsappPrincipal,
    "Olá! Vim pelo site Gauchinho e gostaria de falar com um especialista.",
  );
  const agendar = waLink(
    contato.whatsappPrincipal,
    "Olá! Gostaria de agendar uma consultoria financeira com o Gauchinho.",
  );

  return (
    <HomeSection
      id="contato"
      eyebrow="Fale conosco"
      title="Contato / Agendar consultoria"
      subtitle="WhatsApp, telefone e e-mail configurados no admin — resposta orientada, não robô."
      className="pb-20"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm">
          {contato.whatsappPrincipal ? (
            <p>
              <span className="text-zinc-500">WhatsApp: </span>
              {wa ? (
                <a href={wa} className="text-amber-400 hover:underline" target="_blank" rel="noreferrer">
                  {contato.whatsappPrincipal}
                </a>
              ) : (
                <span className="text-zinc-200">{contato.whatsappPrincipal}</span>
              )}
            </p>
          ) : null}
          {contato.telefone ? (
            <p>
              <span className="text-zinc-500">Telefone: </span>
              <span className="text-zinc-200">{contato.telefone}</span>
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
          {contato.endereco ? (
            <p>
              <span className="text-zinc-500">Endereço: </span>
              <span className="text-zinc-300">{contato.endereco}</span>
            </p>
          ) : null}
          {!contato.whatsappPrincipal && !contato.email && !contato.telefone ? (
            <p className="text-zinc-500">Configure contatos em /admin/configuracoes.</p>
          ) : null}
        </div>
        <div className="flex flex-col justify-center gap-3">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className={ctaClass.gold}>
              Falar com especialista
            </a>
          ) : (
            <a href="/simulador" className={ctaClass.gold}>
              Falar com especialista
            </a>
          )}
          {agendar ? (
            <a href={agendar} target="_blank" rel="noreferrer" className={ctaClass.outline}>
              Agendar consultoria
            </a>
          ) : (
            <a href="#contato" className={ctaClass.outline}>
              Agendar consultoria
            </a>
          )}
        </div>
      </div>
    </HomeSection>
  );
}
