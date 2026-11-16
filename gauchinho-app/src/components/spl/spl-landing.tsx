import Link from "next/link";
import { MODELOS_PARCERIA, REMUNERACAO_FIXA, type EmpreendimentoSpl } from "@/lib/spl/types";
import { brl, SplShell } from "./spl-ui";

type Props = {
  stats: {
    imobiliarias: number;
    clientesEmAtendimento: number;
    carteira: number;
    vendidas: number;
    disponiveis: number;
    logos: { id: string; nome: string; logo_url: string }[];
    empreendimentos: EmpreendimentoSpl[];
  };
};

const SOLUCAO_CURTA: Record<string, string> = {
  CONSORCIO_SPL: "Consórcio",
  CONSORCIO_ECONOMICO: "Consórcio",
  CARTA_CONTEMPLADA: "Carta contemplada",
  FINANCIAMENTO: "Financiamento",
  HOME_EQUITY: "Home equity",
};

export function SplLanding({ stats }: Props) {
  const n = (v: number) => v.toLocaleString("pt-BR");
  return (
    <SplShell
      direita={
        <Link href="/spl/cadastro" className="rounded-xl bg-[#F59E0B] px-4 py-2.5 text-sm font-extrabold text-[#3B2302]">
          Cadastrar imobiliária
        </Link>
      }
    >
      <section className="bg-[#0A1931] text-white">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#00AEEF]">Encontro exclusivo com imobiliárias parceiras</p>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">Chaves para o Futuro</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80 sm:text-xl">
            Sua imobiliária vende. A gente resolve os 70% da entrega das chaves com consórcio, carta contemplada,
            financiamento ou home equity, e protege a sua venda contra o distrato.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              [n(stats.carteira), "oportunidades na carteira SPL"],
              [n(stats.vendidas), "unidades vendidas que vão quitar"],
              [n(stats.imobiliarias), "imobiliárias parceiras"],
              [n(stats.clientesEmAtendimento), "clientes já em atendimento"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-3xl font-black text-[#F59E0B]">{v}</p>
                <p className="mt-1 text-sm text-white/70">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/spl/cadastro" className="rounded-2xl bg-[#F59E0B] px-7 py-4 text-lg font-extrabold text-[#3B2302]">
              Cadastrar minha imobiliária
            </Link>
            <a href="#modelos" className="rounded-2xl border-2 border-white/30 px-7 py-4 text-lg font-bold text-white">
              Ver modelos de parceria
            </a>
          </div>
        </div>
      </section>

      {stats.logos.length ? (
        <section className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">Imobiliárias parceiras</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-6">
              {stats.logos.map((l) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={l.id} src={l.logo_url} alt={l.nome} title={l.nome} className="h-12 w-auto max-w-[140px] object-contain" />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-black text-[#0A1931]">A venda só termina quando o cliente quita os 70%</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-5xl font-black text-[#00AEEF]">30%</p>
            <p className="mt-2 text-lg text-slate-700">pagos até a entrega, diluídos durante a obra.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-5xl font-black text-[#F59E0B]">70%</p>
            <p className="mt-2 text-lg text-slate-700">
              na entrega das chaves. É aí que aparecem a reprovação de crédito e a parcela que não cabe.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-3xl font-black text-[#0A1931]">Uma solução para cada entrega</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.empreendimentos.map((e) => (
              <article key={e.id} className="overflow-hidden rounded-3xl border bg-[#F4F7FB]">
                {e.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.foto_url} alt={e.nome} className="h-44 w-full object-cover" />
                ) : null}
                <div className="p-5">
                  <p className="text-sm font-bold uppercase text-[#153E90]">
                    {e.cidade} · {e.entrega_texto}
                  </p>
                  <h3 className="text-2xl font-black text-[#0A1931]">{e.nome}</h3>
                  <p className="mt-1 text-slate-600">
                    {n(e.vendidas)} vendidas · {n(e.disponiveis)} disponíveis
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...new Set(e.solucoes_recomendadas.map((s) => SOLUCAO_CURTA[s] ?? s))].map((s) => (
                      <span key={s} className="rounded-full bg-[#153E90]/10 px-3 py-1 text-sm font-semibold text-[#153E90]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modelos" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-black text-[#0A1931]">Você escolhe o seu nível de atuação</h2>
        <p className="mt-2 text-lg text-slate-600">Valores já livres de impostos, sobre a base líquida de cada R$ 1 milhão contratado em consórcio.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {MODELOS_PARCERIA.map((m) => (
            <div
              key={m.value}
              className={`rounded-3xl p-6 shadow-sm ${m.value === "GERADOR_NEGOCIOS" ? "bg-[#0A1931] text-white ring-4 ring-[#F59E0B]" : "bg-white"}`}
            >
              <p className="text-lg font-black">{m.label}</p>
              <p className={`mt-2 text-4xl font-black ${m.value === "GERADOR_NEGOCIOS" ? "text-[#F59E0B]" : "text-[#153E90]"}`}>{m.percentual}</p>
              {m.porMilhao ? <p className="text-sm font-semibold opacity-80">{brl(m.porMilhao)} a cada R$ 1 milhão</p> : null}
              <p className="mt-3 text-base opacity-90">{m.descricao}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Object.entries(REMUNERACAO_FIXA).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-bold uppercase text-slate-500">{SOLUCAO_CURTA[k]}</p>
              <p className="text-lg font-bold text-[#0A1931]">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#12284C] text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          {[
            ["1", "Cadastre a imobiliária", "Nome, logo, responsável, CNPJ e PIX. Escolha o modelo e como seus vendedores trabalham."],
            ["2", "Mande o link para a equipe", "Cada vendedor se cadastra pelo seu link e já entra na sua rede, com o portfólio no celular."],
            ["3", "Suba a carteira", "Cliente por cliente ou por planilha. Nós entramos em contato e acompanhamos cada um no painel."],
          ].map(([num, t, d]) => (
            <div key={num}>
              <p className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F59E0B] text-xl font-black text-[#3B2302]">{num}</p>
              <p className="mt-3 text-xl font-black">{t}</p>
              <p className="mt-1 text-white/75">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-3xl font-black text-[#0A1931]">Vamos blindar suas entregas?</h2>
        <p className="mx-auto mt-2 max-w-xl text-lg text-slate-600">
          O cadastro leva dois minutos. A logo aparece aqui depois da aprovação da nossa equipe.
        </p>
        <Link href="/spl/cadastro" className="mt-6 inline-block rounded-2xl bg-[#F59E0B] px-8 py-4 text-lg font-extrabold text-[#3B2302]">
          Cadastrar minha imobiliária
        </Link>
      </section>
    </SplShell>
  );
}
