"use client";

import { useMemo, useState } from "react";
import type { PublicGrupoAggregate } from "@/lib/types";
import { sugerirComposicoes, type OpcaoComposicao } from "@/lib/spl/combinacao-cartas";
import { agregarResultadosLinhas } from "@/lib/grupos/simulacao-linha";
import { buildDadosSimulacaoGrupos } from "@/lib/contratacoes-online/build-grupos-payload";
import { useIniciarContratacao } from "@/lib/contratacoes-online/use-iniciar-contratacao";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { valorMonetarioBr } from "@/lib/spl/validacao";
import type { EmpreendimentoSpl, ModeloVendedor, SolucaoSpl } from "@/lib/spl/types";
import { Aviso, BotaoGrande, Campo, Cartao, brl, brl2, inputGrande } from "./spl-ui";

export type CartaPortfolio = {
  id: string;
  credito: number;
  entrada: number | null;
  prazo: number | null;
  parcela: number | null;
  saldo: number | null;
  transferencia: number | null;
  vencimento: string | null;
};

export type PlanoPortfolio = {
  chave: "CONSORCIO_SPL" | "CONSORCIO_ECONOMICO";
  nome: string;
  codigo: string;
  reduzida: number;
  embutido: number;
  reajuste: string;
  agg: PublicGrupoAggregate | null;
};

type Props = {
  vendedor: { codigo: string; nome: string; modelo: ModeloVendedor };
  imobiliaria: { nome: string; logo_url: string | null };
  veComissao: boolean;
  empreendimentos: EmpreendimentoSpl[];
  planos: PlanoPortfolio[];
  cartas: CartaPortfolio[];
  taxas: { financiamento: number; prazoFinanciamento: number; homeEquity: number; prazoHomeEquity: number };
  whatsappReservas: string;
  validadeHoras: number;
};

type Escolha =
  | { tipo: "consorcio"; plano: PlanoPortfolio; opcao: OpcaoComposicao }
  | { tipo: "carta"; carta: CartaPortfolio }
  | { tipo: "financiamento"; valor: number; parcela: number; prazo: number; taxa: number }
  | { tipo: "home_equity"; valor: number; garantia: number; parcela: number; prazo: number; taxa: number };

type Passo = "inicio" | "solucoes" | "consorcio" | "carta" | "financiamento" | "home_equity" | "cliente" | "pronto";

const PERCENTUAL_VENDEDOR: Partial<Record<ModeloVendedor, number>> = { GERADOR_NEGOCIOS: 0.25, GERADOR_OPORTUNIDADES: 0.125 };
const BASE_LIQUIDA = 0.033;

function solucaoDaEscolha(e: Escolha): SolucaoSpl {
  if (e.tipo === "consorcio") return e.plano.chave;
  if (e.tipo === "carta") return "CARTA_CONTEMPLADA";
  if (e.tipo === "financiamento") return "FINANCIAMENTO";
  return "HOME_EQUITY";
}

function resumoEscolha(e: Escolha): { titulo: string; linhas: [string, string][] } {
  if (e.tipo === "consorcio") {
    const o = e.opcao;
    return {
      titulo: `Consórcio · ${e.plano.nome} (grupo ${e.plano.codigo})`,
      linhas: [
        ["Cartas", o.resumo],
        ["Crédito contratado", brl(o.creditoContratado)],
        ["Lance embutido", `${brl(o.lanceEmbutido)} (${e.plano.embutido}%)`],
        ["Crédito na mão para as chaves", brl(o.creditoLiquido)],
        [`Parcela reduzida ${e.plano.reduzida}% até contemplar`, brl2(o.parcelaAteContemplar)],
        ["Parcela após a contemplação", brl2(o.parcelaPosContemplacao)],
        ["Reajuste", e.plano.reajuste],
      ],
    };
  }
  if (e.tipo === "carta") {
    const c = e.carta;
    return {
      titulo: "Carta contemplada Racon",
      linhas: [
        ["Crédito", brl(c.credito)],
        ["Entrada", brl(c.entrada)],
        ["Parcelas", c.prazo ? `${c.prazo} × ${brl2(c.parcela)}` : "—"],
        ["Saldo devedor", brl(c.saldo)],
        ["Transferência", brl(c.transferencia)],
        ["Sujeito a", "confirmação de disponibilidade"],
      ],
    };
  }
  if (e.tipo === "financiamento") {
    return {
      titulo: "Financiamento bancário (simulação)",
      linhas: [
        ["Valor financiado", brl(e.valor)],
        ["Parcela estimada", `${e.prazo} × ${brl2(e.parcela)}`],
        ["Taxa de referência", `${e.taxa.toLocaleString("pt-BR")}% ao mês`],
        ["Sujeito a", "análise de crédito do banco"],
      ],
    };
  }
  return {
    titulo: "Home equity (simulação)",
    linhas: [
      ["Valor desejado", brl(e.valor)],
      ["Imóvel em garantia", brl(e.garantia)],
      ["Parcela estimada", `${e.prazo} × ${brl2(e.parcela)}`],
      ["Taxa de referência", `${e.taxa.toLocaleString("pt-BR")}% ao mês`],
      ["Sujeito a", "análise de crédito e avaliação do imóvel"],
    ],
  };
}

function Etiqueta({ texto, tom }: { texto: string; tom: "verde" | "ouro" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${tom === "verde" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
      {texto}
    </span>
  );
}

function Voltar({ onClick, texto = "← Voltar" }: { onClick: () => void; texto?: string }) {
  return (
    <button type="button" onClick={onClick} className="py-2 text-lg font-bold text-[#153E90] print:hidden">
      {texto}
    </button>
  );
}

export function SplPortfolio(props: Props) {
  const { vendedor, imobiliaria, veComissao, empreendimentos, planos, cartas, taxas } = props;
  const [passo, setPasso] = useState<Passo>("inicio");
  const [emp, setEmp] = useState<EmpreendimentoSpl | null>(null);
  const [valorTxt, setValorTxt] = useState("");
  const [planoAtivo, setPlanoAtivo] = useState<PlanoPortfolio["chave"]>("CONSORCIO_SPL");
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cliente, setCliente] = useState<DadosCliente | null>(null);
  const valor = valorMonetarioBr(valorTxt) ?? 0;

  const irPara = (p: Passo) => {
    setErro(null);
    setPasso(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const recomendadas = new Set(emp?.solucoes_recomendadas ?? []);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3 print:hidden">
        {imobiliaria.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imobiliaria.logo_url} alt={imobiliaria.nome} className="h-12 w-12 rounded-xl bg-white object-contain ring-1 ring-slate-200" />
        ) : null}
        <div>
          <p className="text-sm font-bold uppercase text-[#153E90]">{imobiliaria.nome}</p>
          <p className="text-slate-600">Vendedor: {vendedor.nome}</p>
        </div>
      </div>

      {passo === "inicio" ? (
        <Cartao className="space-y-5">
          <h1 className="text-3xl font-black text-[#0A1931]">Qual o empreendimento do cliente?</h1>
          <div className="grid grid-cols-2 gap-3">
            {empreendimentos.map((e) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => setEmp(e)}
                className={`overflow-hidden rounded-2xl border-4 text-left transition ${emp?.slug === e.slug ? "border-[#F59E0B]" : "border-transparent"} bg-[#0A1931] text-white`}
              >
                {e.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.foto_url} alt="" className="h-24 w-full object-cover opacity-90" />
                ) : null}
                <span className="block px-3 pb-3 pt-2">
                  <span className="block text-xl font-black">{e.nome}</span>
                  <span className="block text-sm text-white/70">
                    {e.cidade} · {e.entrega_texto}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Campo rotulo="Quanto o cliente precisa na entrega das chaves?">
            <input
              className={`${inputGrande} text-3xl font-black`}
              inputMode="numeric"
              value={valorTxt}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "");
                setValorTxt(d ? Number(d).toLocaleString("pt-BR") : "");
              }}
              placeholder="350.000"
            />
          </Campo>
          {erro ? <Aviso>{erro}</Aviso> : null}
          <BotaoGrande
            tipo="ouro"
            className="w-full"
            onClick={() => {
              if (!emp) return setErro("Toque no empreendimento do cliente.");
              if (valor < 10_000) return setErro("Digite o valor das chaves.");
              irPara("solucoes");
            }}
          >
            Ver as opções
          </BotaoGrande>
        </Cartao>
      ) : null}

      {passo === "solucoes" && emp ? (
        <Cartao className="space-y-4">
          <Voltar onClick={() => irPara("inicio")} />
          <h1 className="text-3xl font-black text-[#0A1931]">
            {emp.nome} · {brl(valor)}
          </h1>
          <p className="text-lg text-slate-600">Escolha como o cliente vai quitar a entrega das chaves.</p>
          {(
            [
              ["consorcio", "Consórcio", "Plano SPL ou Plano Econômico", ["CONSORCIO_SPL", "CONSORCIO_ECONOMICO"]],
              ["carta", "Carta contemplada", "Crédito já liberado, parcela menor que a do banco", ["CARTA_CONTEMPLADA"]],
              ["financiamento", "Financiamento", "Simulação com aviso de análise de crédito", ["FINANCIAMENTO"]],
              ["home_equity", "Home equity", "Para quem tem outro imóvel quitado", ["HOME_EQUITY"]],
            ] as [Passo, string, string, string[]][]
          ).map(([p, titulo, sub, chaves]) => (
            <button
              key={p}
              type="button"
              onClick={() => irPara(p)}
              className="flex w-full items-center justify-between gap-3 rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-[#153E90] active:scale-[0.99]"
            >
              <span>
                <span className="block text-2xl font-black text-[#0A1931]">{titulo}</span>
                <span className="block text-base text-slate-600">{sub}</span>
                <span className="mt-2 flex flex-wrap gap-2">
                  {p === "consorcio" ? <Etiqueta texto="Mais econômica" tom="verde" /> : null}
                  {chaves.some((c) => recomendadas.has(c)) ? <Etiqueta texto="Recomendado" tom="ouro" /> : null}
                </span>
              </span>
              <span className="text-3xl text-[#153E90]">›</span>
            </button>
          ))}
        </Cartao>
      ) : null}

      {passo === "consorcio" ? (
        <TelaConsorcio
          planos={planos}
          ativo={planoAtivo}
          setAtivo={setPlanoAtivo}
          valor={valor}
          veComissao={veComissao}
          modeloVendedor={vendedor.modelo}
          onVoltar={() => irPara("solucoes")}
          onEscolher={(plano, opcao) => {
            setEscolha({ tipo: "consorcio", plano, opcao });
            irPara("cliente");
          }}
        />
      ) : null}

      {passo === "carta" ? (
        <TelaCartas
          cartas={cartas}
          valor={valor}
          vendedor={vendedor.nome}
          imobiliaria={imobiliaria.nome}
          whatsapp={props.whatsappReservas}
          onVoltar={() => irPara("solucoes")}
          onEscolher={(carta) => {
            setEscolha({ tipo: "carta", carta });
            irPara("cliente");
          }}
        />
      ) : null}

      {passo === "financiamento" || passo === "home_equity" ? (
        <TelaCredito
          tipo={passo}
          valor={valor}
          taxa={passo === "financiamento" ? taxas.financiamento : taxas.homeEquity}
          prazo={passo === "financiamento" ? taxas.prazoFinanciamento : taxas.prazoHomeEquity}
          onVoltar={() => irPara("solucoes")}
          onEscolher={(e) => {
            setEscolha(e);
            irPara("cliente");
          }}
        />
      ) : null}

      {passo === "cliente" && escolha && emp ? (
        <TelaCliente
          escolha={escolha}
          emp={emp}
          valor={valor}
          vendedor={vendedor.codigo}
          validadeHoras={props.validadeHoras}
          onVoltar={() => irPara(escolha.tipo === "consorcio" ? "consorcio" : escolha.tipo === "carta" ? "carta" : escolha.tipo)}
          onPronto={() => irPara("pronto")}
          setCliente={setCliente}
        />
      ) : null}

      {passo === "pronto" && escolha && emp && cliente ? (
        <TelaPronto
          escolha={escolha}
          emp={emp}
          valor={valor}
          cliente={cliente}
          vendedor={vendedor}
          imobiliaria={imobiliaria.nome}
          onNovo={() => {
            setEscolha(null);
            setCliente(null);
            setValorTxt("");
            setEmp(null);
            irPara("inicio");
          }}
        />
      ) : null}
    </div>
  );

}

type DadosCliente = { id: string; nome: string; telefone: string; unidade: string; expiraEm: string | null };

function TelaConsorcio({
  planos,
  ativo,
  setAtivo,
  valor,
  veComissao,
  modeloVendedor,
  onVoltar,
  onEscolher,
}: {
  planos: PlanoPortfolio[];
  ativo: PlanoPortfolio["chave"];
  setAtivo: (c: PlanoPortfolio["chave"]) => void;
  valor: number;
  veComissao: boolean;
  modeloVendedor: ModeloVendedor;
  onVoltar: () => void;
  onEscolher: (plano: PlanoPortfolio, opcao: OpcaoComposicao) => void;
}) {
  const plano = planos.find((p) => p.chave === ativo) ?? planos[0];
  const opcoes = useMemo(() => {
    if (!plano?.agg) return [];
    return sugerirComposicoes({
      grupo: plano.agg.grupo,
      cotas: plano.agg.cotas,
      modalidades: plano.agg.modalidades,
      plano: { reduzida: plano.reduzida, embutido: plano.embutido },
      valorLiquidoDesejado: valor,
    });
  }, [plano, valor]);
  const pctVend = PERCENTUAL_VENDEDOR[modeloVendedor];
  const participantes = (p: PlanoPortfolio) => {
    const g = p.agg?.grupo as unknown as { quantidade_cotas_sorteio?: number | null } | undefined;
    return g?.quantidade_cotas_sorteio ?? null;
  };

  return (
    <Cartao className="space-y-5">
      <Voltar onClick={onVoltar} />
      <h1 className="text-3xl font-black text-[#0A1931]">Consórcio para {brl(valor)} na mão</h1>
      <div className="grid grid-cols-2 gap-3">
        {planos.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => setAtivo(p.chave)}
            className={`rounded-3xl border-4 p-4 text-left transition ${ativo === p.chave ? "border-[#F59E0B] bg-[#0A1931] text-white" : "border-slate-200 bg-white text-slate-900"}`}
          >
            <span className="block text-xl font-black">{p.nome}</span>
            <span className={`block text-sm ${ativo === p.chave ? "text-white/70" : "text-slate-500"}`}>Grupo {p.codigo}</span>
            <span className="mt-2 block text-sm font-semibold">
              Parcela {p.reduzida}% · embutido {p.embutido}%
            </span>
            <span className="block text-sm">Reajuste: {p.reajuste}</span>
            {p.chave === "CONSORCIO_SPL" ? (
              <span className="mt-2 block text-sm leading-snug">
                Grupo fechado SPL: menos pessoas, mais contemplações por mês e ágio na venda da carta contemplada.
              </span>
            ) : (
              <span className="mt-2 block text-sm leading-snug">
                {participantes(p) ? `${participantes(p)!.toLocaleString("pt-BR")} participantes no grupo.` : "Grupo aberto da Racon."}
              </span>
            )}
          </button>
        ))}
      </div>

      {!plano?.agg ? (
        <Aviso>O grupo {plano?.codigo} não está disponível no catálogo agora. Fale com a equipe.</Aviso>
      ) : !opcoes.length ? (
        <Aviso>Não encontrei cartas para esse valor neste grupo.</Aviso>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {opcoes.map((o) => (
            <div key={o.posicao + o.resumo} className="flex flex-col rounded-3xl border-2 border-slate-200 bg-[#F4F7FB] p-5">
              <p className="text-sm font-bold uppercase text-slate-500">{o.posicao === "abaixo" ? "Um pouco menos" : "Um pouco mais"}</p>
              <p className="text-4xl font-black text-[#153E90]">{brl(o.creditoLiquido)}</p>
              <p className="text-base text-slate-600">na mão para as chaves</p>
              <dl className="mt-3 space-y-1 text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Parcela até contemplar</dt>
                  <dd className="font-black">{brl2(o.parcelaAteContemplar)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Depois de contemplar</dt>
                  <dd className="font-bold">{brl2(o.parcelaPosContemplacao)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Cartas</dt>
                  <dd className="text-right font-bold">{o.resumo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Crédito contratado</dt>
                  <dd className="font-bold">{brl(o.creditoContratado)}</dd>
                </div>
              </dl>
              {veComissao && pctVend ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  Sua comissão estimada: {brl(o.creditoContratado * BASE_LIQUIDA * pctVend)}
                </p>
              ) : null}
              <BotaoGrande tipo="ouro" className="mt-4 w-full" onClick={() => onEscolher(plano, o)}>
                Escolher esta
              </BotaoGrande>
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-500">
        Valores do catálogo de hoje. A contemplação acontece por sorteio ou lance, conforme as regras do grupo.
      </p>
    </Cartao>
  );
}

function TelaCartas({
  cartas,
  valor,
  vendedor,
  imobiliaria,
  whatsapp,
  onVoltar,
  onEscolher,
}: {
  cartas: CartaPortfolio[];
  valor: number;
  vendedor: string;
  imobiliaria: string;
  whatsapp: string;
  onVoltar: () => void;
  onEscolher: (c: CartaPortfolio) => void;
}) {
  const ordenadas = [...cartas].sort((a, b) => Math.abs(a.credito - valor) - Math.abs(b.credito - valor));
  const msg = (c: CartaPortfolio) =>
    `Olá! Sou ${vendedor}, da ${imobiliaria}. Quero reservar a carta contemplada de ${brl(c.credito)} ` +
    `(entrada ${brl(c.entrada)}, ${c.prazo ?? "?"} × ${brl2(c.parcela)}). Ela está disponível?`;
  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onVoltar} />
      <h1 className="text-3xl font-black text-[#0A1931]">Cartas contempladas</h1>
      <p className="text-lg text-slate-600">As mais próximas de {brl(valor)} aparecem primeiro. Peça a reserva antes de fechar.</p>
      {!ordenadas.length ? <Aviso tom="info">Nenhuma carta disponível hoje. Fale com a equipe.</Aviso> : null}
      {ordenadas.map((c) => (
        <div key={c.id} className="rounded-3xl border-2 border-slate-200 bg-[#F4F7FB] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-3xl font-black text-[#153E90]">{brl(c.credito)}</p>
            <p className="text-lg font-bold">Entrada {brl(c.entrada)}</p>
          </div>
          <p className="mt-1 text-lg">
            {c.prazo ? `${c.prazo} × ${brl2(c.parcela)}` : "Parcelas a confirmar"} · saldo {brl(c.saldo)}
          </p>
          <p className="text-sm text-slate-500">Transferência {brl(c.transferencia)}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/${whatsapp ? `55${whatsapp.replace(/^55/, "")}` : ""}?text=${encodeURIComponent(msg(c))}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-[#16A34A] px-4 text-center text-lg font-extrabold text-white"
            >
              Pedir reserva no WhatsApp
            </a>
            <BotaoGrande tipo="secundario" onClick={() => onEscolher(c)}>
              Reserva confirmada · seguir
            </BotaoGrande>
          </div>
        </div>
      ))}
    </Cartao>
  );
}

function TelaCredito({
  tipo,
  valor,
  taxa,
  prazo: prazoPadrao,
  onVoltar,
  onEscolher,
}: {
  tipo: "financiamento" | "home_equity";
  valor: number;
  taxa: number;
  prazo: number;
  onVoltar: () => void;
  onEscolher: (e: Escolha) => void;
}) {
  const [prazo, setPrazo] = useState(prazoPadrao);
  const [garantiaTxt, setGarantiaTxt] = useState("");
  const garantia = valorMonetarioBr(garantiaTxt) ?? 0;
  const r = simularFinanciamento({ valorBem: valor, entrada: 0, taxaMensalPercentual: taxa, prazoMeses: prazo });
  const isHE = tipo === "home_equity";
  const garantiaBaixa = isHE && garantia > 0 && valor > garantia * 0.6;
  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onVoltar} />
      <h1 className="text-3xl font-black text-[#0A1931]">{isHE ? "Home equity" : "Financiamento"}</h1>
      {isHE ? (
        <Campo rotulo="Valor do imóvel que fica em garantia">
          <input
            className={`${inputGrande} text-2xl font-black`}
            inputMode="numeric"
            value={garantiaTxt}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "");
              setGarantiaTxt(d ? Number(d).toLocaleString("pt-BR") : "");
            }}
            placeholder="800.000"
          />
        </Campo>
      ) : null}
      <p className="text-base font-bold">Prazo</p>
      <div className="grid grid-cols-3 gap-2">
        {[...new Set([Math.min(120, prazoPadrao), prazoPadrao, isHE ? 240 : 360])].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrazo(p)}
            className={`rounded-2xl border-2 py-4 text-lg font-bold ${prazo === p ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {p} meses
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-[#0A1931] p-5 text-white">
        <p className="text-white/70">Parcela estimada para {brl(valor)}</p>
        <p className="text-4xl font-black text-[#F59E0B]">{brl2(r.parcelaEstimada)}</p>
        <p className="text-white/70">
          {prazo} meses · {taxa.toLocaleString("pt-BR")}% ao mês · total {brl(r.valorTotalPago)}
        </p>
      </div>
      <Aviso tom="info">
        Simulação de referência, sujeita à análise de crédito{isHE ? " e à avaliação do imóvel" : " do banco"}. A taxa final é definida na aprovação.
      </Aviso>
      {garantiaBaixa ? <Aviso>O valor pedido passa de 60% do imóvel em garantia. A aprovação pode ficar mais difícil.</Aviso> : null}
      <BotaoGrande
        tipo="ouro"
        className="w-full"
        onClick={() =>
          onEscolher(
            isHE
              ? { tipo: "home_equity", valor, garantia, parcela: r.parcelaEstimada, prazo, taxa }
              : { tipo: "financiamento", valor, parcela: r.parcelaEstimada, prazo, taxa },
          )
        }
        disabled={isHE && garantia <= 0}
      >
        Seguir com este cliente
      </BotaoGrande>
    </Cartao>
  );
}

function TelaCliente({
  escolha,
  emp,
  valor,
  vendedor,
  validadeHoras,
  onVoltar,
  onPronto,
  setCliente,
}: {
  escolha: Escolha;
  emp: EmpreendimentoSpl;
  valor: number;
  vendedor: string;
  validadeHoras: number;
  onVoltar: () => void;
  onPronto: () => void;
  setCliente: (c: DadosCliente) => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [unidade, setUnidade] = useState("");
  const [situacao, setSituacao] = useState<"JA_COMPROU" | "VAI_COMPRAR" | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const resumo = resumoEscolha(escolha);

  async function salvar() {
    setErro(null);
    if (nome.trim().length < 2) return setErro("Digite o nome do cliente.");
    if (telefone.replace(/\D/g, "").length < 10) return setErro("Digite o WhatsApp do cliente com DDD.");
    setEnviando(true);
    try {
      const res = await fetch("/api/public/spl/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedor,
          nome,
          telefone,
          unidade,
          situacao,
          empreendimento_slug: emp.slug,
          valor_chaves: valor,
          solucao: solucaoDaEscolha(escolha),
          proposta: true,
          dados: { resumo: resumo.titulo, itens: Object.fromEntries(resumo.linhas) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setCliente({ id: data.id, nome, telefone, unidade, expiraEm: data.expiraEm ?? null });
      onPronto();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onVoltar} />
      <h1 className="text-3xl font-black text-[#0A1931]">Dados do cliente</h1>
      <div className="rounded-2xl bg-[#153E90]/5 p-4">
        <p className="font-black text-[#153E90]">{resumo.titulo}</p>
        <p className="text-slate-700">{resumo.linhas.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
      </div>
      <Campo rotulo="Nome do cliente">
        <input className={inputGrande} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="WhatsApp do cliente">
        <input className={inputGrande} inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(66) 99999-0000" />
      </Campo>
      <Campo rotulo="Unidade (opcional)">
        <input className={inputGrande} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Torre 1 · 302" />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["JA_COMPROU", "Já comprou"],
            ["VAI_COMPRAR", "Vai comprar"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setSituacao(v)}
            className={`rounded-2xl border-2 px-3 py-4 text-lg font-bold ${situacao === v ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {erro ? <Aviso>{erro}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={salvar} disabled={enviando} className="w-full">
        {enviando ? "Salvando…" : `Gerar proposta (vale ${validadeHoras} horas)`}
      </BotaoGrande>
    </Cartao>
  );
}

function TelaPronto({
  escolha,
  emp,
  valor,
  cliente,
  vendedor,
  imobiliaria,
  onNovo,
}: {
  escolha: Escolha;
  emp: EmpreendimentoSpl;
  valor: number;
  cliente: DadosCliente;
  vendedor: { codigo: string; nome: string };
  imobiliaria: string;
  onNovo: () => void;
}) {
  const { iniciar, loading } = useIniciarContratacao();
  const [erro, setErro] = useState<string | null>(null);
  const resumo = resumoEscolha(escolha);
  const validade = cliente.expiraEm
    ? new Date(cliente.expiraEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  const textoWhats =
    `Olá, ${cliente.nome}! Segue a proposta para a entrega das chaves do ${emp.nome} (${brl(valor)}):\n` +
    `${resumo.titulo}\n` +
    resumo.linhas.map(([k, v]) => `• ${k}: ${v}`).join("\n") +
    (validade ? `\nVálida até ${validade}.` : "") +
    `\n${vendedor.nome} · ${imobiliaria}`;

  async function documentos() {
    if (escolha.tipo !== "consorcio") return;
    setErro(null);
    const plano = escolha.plano;
    const agg = plano.agg!;
    const linhas = escolha.opcao.itens.map((i) => ({
      grupoId: agg.grupo.id,
      cotaId: i.cota.id,
      config: i.config,
      resultado: i.resultado,
      grupo: agg.grupo,
      modalidades: agg.modalidades,
    }));
    const totais = agregarResultadosLinhas(linhas.map((l) => l.resultado));
    try {
      await iniciar({
        modo: "cliente_site",
        origem: "grupos",
        cliente_pre_nome: cliente.nome,
        cliente_pre_telefone: cliente.telefone.replace(/\D/g, ""),
        dados_simulacao: {
          ...buildDadosSimulacaoGrupos(linhas, totais as unknown as Record<string, unknown>),
          splPortfolio: {
            clienteId: cliente.id,
            vendedor: vendedor.nome,
            vendedorCodigo: vendedor.codigo,
            imobiliaria,
            empreendimento: emp.nome,
            unidade: cliente.unidade || null,
            valorChaves: valor,
            plano: plano.nome,
            validaAte: cliente.expiraEm,
          },
        },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a proposta.");
    }
  }

  return (
    <div className="space-y-4">
      <Cartao className="space-y-4 print:border-0 print:shadow-none">
        <div className="hidden items-center justify-between print:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/spl.png" alt="SPL" className="h-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/logo-racon-gauchinho.jpeg" alt="Racon Gauchinho" className="h-10" />
        </div>
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 print:text-slate-500">Proposta gerada</p>
        <h1 className="text-3xl font-black text-[#0A1931]">{cliente.nome}</h1>
        <p className="text-lg text-slate-700">
          {emp.nome} · {emp.cidade}
          {cliente.unidade ? ` · ${cliente.unidade}` : ""} · chaves {brl(valor)}
        </p>
        <div className="rounded-2xl border-2 border-[#153E90]/20 p-4">
          <p className="text-xl font-black text-[#153E90]">{resumo.titulo}</p>
          <dl className="mt-2 divide-y">
            {resumo.linhas.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2 text-lg">
                <dt className="text-slate-600">{k}</dt>
                <dd className="text-right font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {validade ? <p className="text-base font-bold text-amber-800">Proposta válida até {validade}.</p> : null}
        <p className="text-sm text-slate-500">
          {vendedor.nome} · {imobiliaria}. Nossa equipe entra em contato para o fechamento.
        </p>
      </Cartao>
      {erro ? <Aviso>{erro}</Aviso> : null}
      <div className="grid gap-3 print:hidden">
        <BotaoGrande onClick={() => window.print()}>Gerar PDF</BotaoGrande>
        <a
          href={`https://wa.me/55${cliente.telefone.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(textoWhats)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[60px] items-center justify-center rounded-2xl bg-[#16A34A] px-6 text-center text-lg font-extrabold text-white"
        >
          Enviar para o cliente no WhatsApp
        </a>
        {escolha.tipo === "consorcio" ? (
          <BotaoGrande tipo="ouro" onClick={documentos} disabled={loading}>
            {loading ? "Abrindo…" : "Subir documentos e fechar a proposta"}
          </BotaoGrande>
        ) : null}
        <BotaoGrande tipo="secundario" onClick={onNovo}>
          Atender outro cliente
        </BotaoGrande>
      </div>
    </div>
  );
}
