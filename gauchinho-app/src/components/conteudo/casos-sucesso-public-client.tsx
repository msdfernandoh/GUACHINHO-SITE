"use client";

import { useMemo, useState } from "react";
import type { CasoSucesso } from "@/lib/conteudo/types";
import { CASO_CATEGORIAS } from "@/lib/conteudo/types";
import { CasoSucessoCard } from "./caso-sucesso-card";
import { ConteudoCTA } from "./conteudo-cta";
import { ConteudoViewTracker } from "./conteudo-view-tracker";
import { cn } from "@/lib/utils/cn";

type Props = {
  casos: CasoSucesso[];
  simuladorHref: string;
  whatsappHref: string;
  /** Dentro da página /depoimentos (sem padding externo duplicado). */
  embedded?: boolean;
};

export function CasosSucessoPublicClient({ casos, simuladorHref, whatsappHref, embedded }: Props) {
  const [categoria, setCategoria] = useState("");
  const destaques = useMemo(() => casos.filter((c) => c.destaque), [casos]);
  const filtered = useMemo(
    () => (categoria ? casos.filter((c) => c.categoria === categoria) : casos),
    [casos, categoria],
  );

  return (
    <>
      {!embedded ? <ConteudoViewTracker tipo_evento="caso_sucesso_visualizado" entidade_tipo="lista" /> : null}
      <div className={cn(!embedded && "mx-auto max-w-7xl px-4 py-12 sm:px-6")}>
        <div className="flex flex-wrap gap-2">
          <Chip active={!categoria} onClick={() => setCategoria("")}>
            Todos
          </Chip>
          {CASO_CATEGORIAS.map((c) => (
            <Chip key={c} active={categoria === c} onClick={() => setCategoria(c === categoria ? "" : c)}>
              {c}
            </Chip>
          ))}
        </div>

        {destaques.length > 0 && !categoria ? (
          <section className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">Em destaque</h2>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {destaques.map((c) => (
                <CasoSucessoCard key={c.id} caso={c} featured />
              ))}
            </div>
          </section>
        ) : null}

        <section className={embedded ? "mt-0" : "mt-12"}>
          {!embedded ? (
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Histórias</h2>
          ) : null}
          {filtered.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              Ainda não há casos publicados nesta categoria. Fale com um especialista para orientação personalizada.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <CasoSucessoCard key={c.id} caso={c} />
              ))}
            </div>
          )}
        </section>

        <div className="mt-16">
          <ConteudoCTA
            simuladorHref={simuladorHref}
            whatsappHref={whatsappHref}
            simuladorLabel="Simular meu objetivo"
          />
        </div>
        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-zinc-600">
          Cada história ilustra um caminho de planejamento e acompanhamento. Resultados variam conforme perfil,
          administradora e condições do grupo — não há garantia de contemplação ou aprovação.
        </p>
      </div>
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-amber-500 text-zinc-950"
          : "border border-zinc-700 text-zinc-400 hover:border-amber-500/40",
      )}
    >
      {children}
    </button>
  );
}
