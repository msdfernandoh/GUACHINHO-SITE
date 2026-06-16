import { HomeSection } from "./home-section";

export function HomePlaceholders() {
  return (
    <>
      <HomeSection
        eyebrow="Resultados"
        title="Casos de sucesso"
        subtitle="Em breve: histórias reais de clientes que realizaram sonhos com consórcio, cartas e imóveis parceiros."
        className="border-t border-zinc-800/60"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {["Imóvel próprio", "Frota empresarial", "Carta + imóvel parceiro"].map((t) => (
            <div
              key={t}
              className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center"
            >
              <p className="text-sm font-medium text-zinc-400">{t}</p>
              <p className="mt-2 text-xs text-zinc-600">Conteúdo em preparação</p>
            </div>
          ))}
        </div>
      </HomeSection>
      <HomeSection
        eyebrow="Conteúdo"
        title="Dicas do Tchê"
        subtitle="Artigos e vídeos sobre consórcio, lance e planejamento — em breve no blog Gauchinho."
        className="bg-zinc-900/20"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500">Canal de educação financeira gaúcha — placeholder elegante.</p>
        </div>
      </HomeSection>
    </>
  );
}
