import { BadgeCheck, Wallet, Trophy, Shield } from "lucide-react";
import { HomeReveal } from "./home-reveal";

const BADGES = [
  { Icon: BadgeCheck, texto: "Sem juros é consórcio!" },
  { Icon: Wallet, texto: "Planejamento que cabe no bolso" },
  { Icon: Trophy, texto: "Contemplação por sorteio ou lance" },
  { Icon: Shield, texto: "Segurança e transparência" },
] as const;

export function TrustBadgesSection() {
  return (
    <section
      className="py-10"
      style={{ background: "var(--brand-blue)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {BADGES.map(({ Icon, texto }, i) => (
            <HomeReveal key={texto} delayMs={i * 80}>
              <div
                className="flex flex-col items-center gap-3 rounded-2xl p-5 text-center transition duration-300 hover:scale-[1.02]"
                style={{
                  background: "rgba(201,168,76,0.06)",
                  border: "1px solid rgba(201,168,76,0.22)",
                }}
              >
                <Icon
                  className="h-7 w-7 shrink-0"
                  style={{ color: "var(--brand-gold)" }}
                  aria-hidden
                />
                <span className="text-sm font-semibold text-white">{texto}</span>
              </div>
            </HomeReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
