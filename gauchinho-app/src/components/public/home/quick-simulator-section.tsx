"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { formatCurrency } from "@/lib/utils/format";
import { HomeReveal } from "./home-reveal";
import { HomeSection } from "./home-section";

type Props = {
  defaults: {
    prazoImovel: number;
    prazoAutomovel: number;
    valorImovel: number;
    valorAutomovel: number;
  };
};

type Solucao = "consorcio" | "financiamento";
type TipoBemHome = "imovel" | "automovel" | "moto";

export function QuickSimulatorSection({ defaults }: Props) {
  const router = useRouter();
  const [solucao, setSolucao] = useState<Solucao>("consorcio");
  const [tipo, setTipo] = useState<TipoBemHome>("imovel");
  const [valor, setValor] = useState(defaults.valorImovel);
  const [prazo, setPrazo] = useState(defaults.prazoImovel);

  const valorMin = tipo === "imovel" ? 80_000 : 15_000;
  const valorMax = tipo === "imovel" ? 2_000_000 : 500_000;
  const prazoMin = 24;
  const prazoMax = tipo === "imovel" ? 220 : 100;

  const valorLabel = useMemo(() => formatCurrency(valor), [valor]);

  function onTipoChange(next: TipoBemHome) {
    setTipo(next);
    if (next === "imovel") {
      setValor(defaults.valorImovel);
      setPrazo(defaults.prazoImovel);
    } else {
      setValor(defaults.valorAutomovel);
      setPrazo(defaults.prazoAutomovel);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const extraTipo = tipo === "moto" ? "moto" : tipo === "automovel" ? "automovel" : "imovel";
    if (tipo === "moto") {
      router.push(
        `/simulador?tipo=moto&solucao=${solucao}&valor=${Math.round(valor)}&prazo=${Math.round(prazo)}&origem=home_simulador_rapido`,
      );
      return;
    }
    router.push(
      buildSimuladorUrl({
        tipo: extraTipo === "imovel" ? "imovel" : "automovel",
        solucao,
        valor,
        prazo,
        origem: "home_simulador_rapido",
      }),
    );
  }

  return (
    <HomeSection
      id="simulador-rapido"
      eyebrow="Ferramenta premium"
      title="Simulador rápido"
      subtitle="Ajuste solução, bem, valor e prazo — na página completa você refina lance, seguro e comparativo."
      className="relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(245,158,11,0.08),transparent)]"
        aria-hidden
      />
      <HomeReveal>
        <form
          onSubmit={submit}
          className="home-gold-glow relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 md:p-10"
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "consorcio" as const, label: "Consórcio" },
                { id: "financiamento" as const, label: "Financiamento" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSolucao(opt.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  solucao === opt.id
                    ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/25"
                    : "border border-zinc-700 bg-zinc-950/80 text-zinc-300 hover:border-amber-500/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Tipo de bem
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "imovel" as const, label: "Imóvel" },
                    { id: "automovel" as const, label: "Veículo" },
                    { id: "moto" as const, label: "Moto" },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onTipoChange(b.id)}
                    className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
                      tipo === b.id
                        ? "border border-amber-500/50 bg-amber-500/10 text-amber-200"
                        : "border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-xs text-zinc-500">Valor desejado</p>
              <p className="text-3xl font-bold text-amber-400">{valorLabel}</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Crédito</span>
                <span>
                  {formatCurrency(valorMin)} — {formatCurrency(valorMax)}
                </span>
              </div>
              <input
                type="range"
                min={valorMin}
                max={valorMax}
                step={tipo === "imovel" ? 5000 : 1000}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-amber-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Prazo</span>
                <span>
                  {prazoMin} — {prazoMax} meses ·{" "}
                  <strong className="text-zinc-300">{prazo} meses</strong>
                </span>
              </div>
              <input
                type="range"
                min={prazoMin}
                max={prazoMax}
                step={12}
                value={prazo}
                onChange={(e) => setPrazo(Number(e.target.value))}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-amber-500"
              />
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            Simulação orientativa para planejamento. Valores finais dependem de grupo, administradora,
            perfil e condições de mercado.
          </p>

          <button
            type="submit"
            className="home-cta-shimmer relative mt-8 w-full overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 py-4 text-sm font-bold text-zinc-950 shadow-xl shadow-amber-500/30 transition hover:brightness-105 md:w-auto md:px-12"
          >
            Ver simulação completa
          </button>
        </form>
      </HomeReveal>
    </HomeSection>
  );
}
