"use client";

import { useEffect } from "react";
import type { CasoSucesso, Depoimento } from "@/lib/conteudo/types";
import { DepoimentoCard } from "./depoimento-card";
import { CasosSucessoPublicClient } from "./casos-sucesso-public-client";
import { ConteudoViewTracker } from "./conteudo-view-tracker";

type Props = {
  depoimentos: Depoimento[];
  casos: CasoSucesso[];
  simuladorHref: string;
  whatsappHref: string;
};

export function DepoimentosProvaSocialClient({ depoimentos, casos, simuladorHref, whatsappHref }: Props) {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const destaquesDepo = depoimentos.filter((d) => d.destaque);
  const listaDepo = destaquesDepo.length ? [...destaquesDepo, ...depoimentos.filter((d) => !d.destaque)] : depoimentos;
  const uniqueDepo = listaDepo.filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);

  return (
    <>
      <ConteudoViewTracker tipo_evento="depoimento_visualizado" entidade_tipo="lista" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <section id="depoimentos" className="scroll-mt-24">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">Depoimentos</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            O que clientes compartilham sobre o atendimento e o acompanhamento no escritório.
          </p>
          {uniqueDepo.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">Em breve novos depoimentos publicados aqui.</p>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {uniqueDepo.map((d) => (
                <DepoimentoCard key={d.id} depoimento={d} />
              ))}
            </div>
          )}
        </section>

        <section id="casos-de-sucesso" className="mt-20 scroll-mt-24 border-t border-zinc-800/80 pt-16">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">Casos de sucesso</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Histórias de conquistas planejadas — exemplos de orientação em consórcio, financiamento e crédito.
          </p>
          <div className="mt-8">
            <CasosSucessoPublicClient
              casos={casos}
              simuladorHref={simuladorHref}
              whatsappHref={whatsappHref}
              embedded
            />
          </div>
        </section>
      </div>
    </>
  );
}
