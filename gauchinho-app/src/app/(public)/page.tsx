import Link from "next/link";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";

export default async function HomePage() {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
          Escritório de Soluções Financeiras
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          {site.nomeEmpresa}
        </h1>
        {site.subtitulo ? (
          <p className="mt-4 text-lg text-zinc-400">{site.subtitulo}</p>
        ) : (
          <p className="mt-4 max-w-xl text-lg text-zinc-400">
            Consórcio, financiamento e soluções sob medida para realizar seus planos.
          </p>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/simulador"
            className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
          >
            Simular consórcio ou financiamento
          </Link>
          {site.exibirBotaoGruposNoSite ? (
            <Link
              href="/grupos"
              className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              Nossos grupos
            </Link>
          ) : (
            <Link
              href="/grupos"
              className="rounded-full border border-amber-500/40 px-8 py-3 font-semibold text-amber-400 transition hover:bg-amber-500/10"
            >
              Acessar grupos (link direto)
            </Link>
          )}
          <Link
            href="/login"
            className="rounded-full border border-zinc-700 px-8 py-3 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Área admin
          </Link>
        </div>
    </div>
  );
}
