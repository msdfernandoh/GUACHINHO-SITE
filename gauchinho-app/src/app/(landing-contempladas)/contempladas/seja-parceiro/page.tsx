import type { Metadata } from "next";
import { Shell } from "@/components/contempladas/ui";

export const metadata: Metadata = {
  title: { absolute: "Seja parceiro · Cotas Contempladas Racon" },
  description: "Venda ou anuncie cartas contempladas numa rede de revendas: proposta com sua marca, comissão em cada carta e reserva com PIX.",
};

const ADMIN = [
  ["Mais vendedores", "Todas as revendas cadastradas veem e oferecem suas cartas, sem você mandar planilha para cada uma."],
  ["Suba como recebe", "Cole a mensagem do WhatsApp ou copie direto da planilha. O sistema lê crédito, entrada, prazo, parcela, saldo, vencimento, comissão e transferência."],
  ["Sem cota repetida", "Se subir uma carta idêntica a uma que já está no ar, o sistema avisa e deixa você decidir. Errou o envio? Desfaz com um clique."],
  ["Seu ágio garantido", "Defina o ágio de imóvel e de veículo (% ou R$). Ele entra sozinho na entrada e, se mudar, atualiza todas as suas cotas."],
  ["Você decide a comissão", "Um padrão para todas as cotas ou o valor que veio na lista de cada carta. A revenda vê, o cliente nunca."],
  ["Seu PIX e seu WhatsApp", "Cada administrador tem a própria chave PIX, WhatsApp e sinal mínimo. A reserva cai direto para você."],
  ["Sinal segura a venda", "O cliente paga o sinal no seu PIX e anexa o comprovante. A cota fica em análise, bloqueada só para ele."],
  ["Comissões organizadas", "A comissão da revenda aparece pendente quando a carta é vendida. Você paga, anexa o comprovante e ela confirma o recebimento."],
  ["Tudo registrado", "Cada venda fica gravada com revenda, administrador, data e hora, e os cards mostram o volume negociado."],
];
const REVENDA = [
  ["Estoque sem comprar nada", "Cartas de vários administradores num lugar só, com filtros por imóvel, veículo e administradora e o total do crédito do filtro."],
  ["Comissão à vista", "Veja a comissão de cada carta e de cada proposta. Um toque no olho esconde quando estiver na frente do cliente."],
  ["Junte cartas", "O sistema soma cartas para chegar no crédito do cliente e traz a mais próxima acima e abaixo, sem limite de cartas."],
  ["Taxa efetiva calculada", "Cada carta e cada junção mostram a taxa mensal e anual (crédito menos a entrada contra as parcelas)."],
  ["Planos sob medida", "Mensal, semestral antecipado ou anual antecipado, muito usado por produtor rural."],
  ["Sua marca na proposta", "A proposta sai com sua logo, seu nome e seu WhatsApp para assinatura, e pode ser reimpressa pelo número."],
  ["Mensagens prontas", "Gere oportunidades com as melhores junções e textos de WhatsApp com emojis, taxa e o código das cartas."],
  ["Ganhe mais", "Some um adicional fixo na entrada de todas as suas propostas ou dê desconto como oportunidade para fechar."],
  ["Reserve e receba", "Pré-reserva de 30 minutos e sinal no PIX. Vendida, sua comissão aparece para receber com comprovante."],
];

const PERGUNTAS = [
  ["Como faço para participar?", "Clique em Solicitar acesso, preencha seus dados e os da empresa e aguarde a aprovação. Liberado, você entra com seu e-mail e senha."],
  ["Quem pode se cadastrar?", "Quem tem cartas contempladas para vender (administrador de cotas), quem vai revender e quem faz as duas coisas."],
  ["Tenho acesso aos sistemas internos?", "Não. O acesso é só ao portal de cotas contempladas."],
  ["Como subo minhas cartas?", "Em Enviar cotas: cole a mensagem do WhatsApp ou copie da planilha com a linha de títulos. Clique em Conferir e depois em Enviar."],
  ["E se eu subir uma carta repetida ou errar o envio?", "Cartas idênticas às que já estão no ar vêm desmarcadas com aviso. Um envio errado pode ser desfeito em Últimos envios."],
  ["Como funciona o ágio?", "O administrador define um valor ou % do crédito (imóvel e veículo). Ele entra na entrada de cada carta e é o ganho dele."],
  ["Como a revenda ganha?", "Com a comissão que o administrador paga por carta, mais o adicional que ela pode somar na entrada das propostas dela."],
  ["O cliente vê a comissão?", "Não. Comissão e rentabilidade aparecem só para quem está logado e nunca saem na proposta."],
  ["Como é calculada a taxa mensal?", "O cliente recebe o crédito menos a entrada e paga as parcelas. A taxa é o custo desse fluxo ao mês; a anual é a mensal composta em 12 meses."],
  ["A pré-reserva segura a carta?", "Não. Ela liga um relógio de 30 minutos e mostra interesse. Quem segura a carta é o sinal pago no PIX do administrador."],
  ["Para quem vai o PIX do cliente?", "Para a chave do administrador dono da carta. Ele confere o comprovante e marca a carta como vendida."],
  ["Quando recebo minha comissão?", "Quando a carta é vendida a comissão aparece pendente. O administrador paga com comprovante e você confirma o recebimento no painel."],
  ["Posso juntar cartas de administradores diferentes?", "Na proposta, sim. A reserva e o sinal são feitos com cada administrador separadamente."],
  ["Funciona no celular?", "Sim. Simular, gerar proposta, reservar, enviar comprovante e marcar vendida funcionam no celular."],
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-black text-[#0a2a66] sm:text-3xl">Como uma venda acontece</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["O administrador sobe as cartas", "Colando a lista. O ágio dele entra na entrada e a comissão fica definida."],
              ["A revenda simula", "Crédito e entrada do cliente; o sistema junta cartas e mostra a taxa mensal e anual."],
              ["Proposta com a marca da revenda", "Mensal, semestral ou anual antecipado, com logo, nome e WhatsApp."],
              ["Pré-reserva de 30 minutos", "Relógio na tela para negociar; a cota continua livre e cria escassez."],
              ["Sinal no PIX do administrador", "Com o comprovante a cota fica em análise; ele confere e marca vendida."],
              ["Comissão paga e confirmada", "O administrador paga com comprovante e a revenda confirma o recebimento."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-[#f5f7fb] p-4">
                <p className="text-sm font-black text-[#0047bb]">Passo {i + 1}</p>
                <p className="font-extrabold text-[#0a2a66]">{t}</p>
                <p className="text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-slate-500">Acesso só ao portal de cotas, sem acesso a sistemas internos. Cada administrador vê e cuida só das cartas dele.</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-black text-[#0a2a66] sm:text-3xl">Perguntas frequentes</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {PERGUNTAS.map(([p, r]) => (
              <details key={p} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-[#0a2a66]">
                  {p}
                  <span className="text-xl text-[#0047bb] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600">{r}</p>
              </details>
            ))}
          </div>
        </section>

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
