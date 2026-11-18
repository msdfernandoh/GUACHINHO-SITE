import type { Metadata } from "next";
import { Shell } from "@/components/contempladas/ui";

export const metadata: Metadata = {
  title: { absolute: "Seja parceiro · Cotas Contempladas Racon" },
  description: "Venda ou anuncie cartas contempladas numa rede de revendas: proposta com sua marca, comissão em cada carta e reserva com PIX.",
};

const ADMIN = [
  ["Mais vendedores", "Todas as revendas cadastradas veem e oferecem suas cotas, sem mandar planilha para cada uma."],
  ["Seu ágio garantido", "O ágio que você define (imóvel e veículo) entra sozinho na entrada de cada cota. Mudou? Atualiza todas."],
  ["Suba pelo WhatsApp", "Cole a lista de cartas do jeito que recebe. O sistema lê crédito, entrada, prazo, parcela, saldo, vencimento e comissão."],
  ["Você decide a comissão", "Um padrão para todas as cotas (% ou R$ fixo) ou um valor diferente em cada envio."],
  ["Sinal segura a venda", "Defina o sinal mínimo. O cliente paga o PIX na sua chave e a cota fica em análise só para ele."],
  ["Tudo registrado", "Você confirma o PIX e marca vendida. Fica gravado quem vendeu, a unidade, a data e a hora."],
];
const REVENDA = [
  ["Comissão à vista", "Veja a comissão de cada carta e de cada proposta antes de oferecer. Um toque no olho esconde na frente do cliente."],
  ["Junte cartas", "Some cartas para chegar no crédito do cliente, com a taxa mensal e anual calculada na hora."],
  ["Planos sob medida", "Mensal, semestral antecipado ou anual antecipado, muito usado por produtor rural."],
  ["Sua marca na proposta", "A proposta sai com sua logo, seu nome e seu WhatsApp para assinatura."],
  ["Mensagens prontas", "Gere oportunidades e textos de WhatsApp com emojis e chamada, prontos para enviar."],
  ["Reserve e feche", "Pré-reserva de 30 minutos para negociar e sinal no PIX para segurar a venda."],
];

function Bloco({ titulo, sub, itens, cta, href }: { titulo: string; sub: string; itens: string[][]; cta: string; href: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black text-[#0a2a66] sm:text-3xl">{titulo}</h2>
      <p className="mt-1 text-slate-500">{sub}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(([t, d], i) => (
          <div key={t} className="rounded-2xl border-t-4 border-[#0047bb] bg-[#f5f7fb] p-5">
            <p className="text-3xl font-black text-[#0047bb]/30">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-1 text-lg font-extrabold text-[#0a2a66]">{t}</p>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
      <a href={href} className="mt-6 inline-block rounded-xl bg-[#0047bb] px-6 py-3 font-bold text-white hover:bg-[#003a99]">{cta}</a>
    </section>
  );
}

export default function Page() {
  return (
    <Shell titulo="Seja parceiro" sub="Rede de cartas contempladas Racon">
      <section className="mb-8 overflow-hidden rounded-3xl bg-[#0047bb] px-6 py-12 text-white sm:px-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">Para novos parceiros</p>
        <h1 className="mt-2 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Carta contemplada vende rápido. Venda com a gente.</h1>
        <p className="mt-4 max-w-3xl text-lg text-white/85">
          Quem tem cartas anuncia para uma rede inteira de revendas. Quem revende tem estoque, comissão em cada carta e proposta com a própria marca.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#administrador" className="rounded-xl bg-white px-5 py-3 font-bold text-[#0047bb]">Tenho cartas para vender</a>
          <a href="#revenda" className="rounded-xl border-2 border-white px-5 py-3 font-bold text-white">Quero revender</a>
        </div>
      </section>

      <div className="space-y-8">
        <div id="administrador">
          <Bloco titulo="Administrador de Cotas" sub="Você cuida das cartas, a rede vende." itens={ADMIN} cta="Solicitar acesso de Administrador de Cotas" href="/contempladas/solicitar?tipo=administrador" />
        </div>
        <div id="revenda">
          <Bloco titulo="Revenda" sub="Um estoque inteiro de cartas para oferecer, sem comprar nada." itens={REVENDA} cta="Solicitar acesso de revenda" href="/contempladas/solicitar?tipo=revenda" />
        </div>
        <section className="rounded-3xl bg-[#0a2a66] p-6 text-white sm:p-8">
          <h2 className="text-2xl font-black">Como começa</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[["1", "Peça seu acesso", "Preencha o cadastro com seus dados e os da empresa."], ["2", "Aprovação", "Seu acesso é liberado e você recebe o login do portal."], ["3", "Comece a vender", "Configure seu perfil, sua logo e já gere propostas."]].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-white/10 p-5">
                <p className="text-3xl font-black text-white/50">{n}</p>
                <p className="text-lg font-bold">{t}</p>
                <p className="text-sm text-white/75">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
