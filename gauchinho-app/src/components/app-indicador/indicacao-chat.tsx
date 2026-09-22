"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, MessageCircle, Send } from "lucide-react";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { registrarIndicacaoDoAppAction, type NovaIndicacaoApp } from "@/app/app-indicador/indicar/actions";
import { AppIndicadorTheme } from "./app-indicador-theme";

const creditos = [50000, 100000, 200000, 300000, 500000, 1000000];
const parcelas = [400, 500, 700, 900, 1000, 1200, 1500, 2000, 3000, 5000];
const moeda = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

type Dados = Partial<NovaIndicacaoApp> & {
  estrategiaCredito?: string;
  prazoUtilizacaoCredito?: string;
  preferenciaAtendimento?: string;
  quandoAtendimento?: string;
  periodoContato?: string;
};

const estrategias = [
  ["ACESSO_RAPIDO", "Buscar uma estratégia para ter acesso ao crédito mais rápido"],
  ["PARCELA_CONFORTAVEL", "Ter uma parcela mais confortável para alcançar um crédito maior"],
  ["EQUILIBRIO", "Quero encontrar um equilíbrio entre prazo, parcela e valor do crédito"],
] as const;
const prazos = [
  ["RAPIDO", "Quero o mais rápido possível"],
  ["ATE_6_MESES", "Até 6 meses"],
  ["DE_6_A_12_MESES", "De 6 a 12 meses"],
  ["DE_1_A_2_ANOS", "De 1 a 2 anos"],
  ["MAIS_DE_2_ANOS", "Mais de 2 anos"],
  ["SEM_PRAZO", "Ainda não tenho um prazo definido"],
] as const;
const preferenciasAtendimento = [
  ["NETWORK", "Participar do nosso Network de Negócios, realizado às terças-feiras"],
  ["VISITA", "Agendar uma visita em minha casa ou empresa"],
  ["ESCRITORIO", "Agendar um atendimento em nosso escritório"],
] as const;
const momentosAtendimento = [
  ["QUANTO_ANTES", "O quanto antes"],
  ["PROXIMOS_DIAS", "Nos próximos dias"],
  ["PROXIMA_SEMANA", "Na próxima semana"],
  ["COMBINAR_DEPOIS", "Prefiro combinar uma data depois"],
] as const;
const periodosContato = [
  ["MANHA", "Manhã"],
  ["TARDE", "Tarde"],
  ["NOITE", "Noite"],
  ["QUALQUER", "Tanto faz, posso atender em qualquer período"],
] as const;

function Escolha({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${selected ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-700 bg-zinc-900 text-white"}`}
    >
      <span>{value}</span>
      {selected ? <Check className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
    </button>
  );
}

export function IndicacaoChat({ racon = false, codigoIndicacao, nomeIndicador }: { racon?: boolean; codigoIndicacao?: string; nomeIndicador?: string | null }) {
  const publico = Boolean(codigoIndicacao);
  const total = publico ? 11 : 6;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Dados>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [draftReady, setDraftReady] = useState(!publico);
  const coreStep = publico ? step - 2 : step;
  const isFinal = publico ? step === 10 : step === 5;
  const draftKey = publico && codigoIndicacao ? `gauchinho:indicacao:${codigoIndicacao}:rascunho:v1` : null;

  const perguntas = publico
    ? [
        "Pensando no seu objetivo hoje, o que é mais importante para você?",
        "Quanto tempo você pode esperar para utilizar o seu crédito?",
        "Vamos conhecer você",
        "Qual é sua relação com essa pessoa?",
        "O que você está procurando?",
        "Qual crédito você precisa?",
        "Qual valor disponível mensal para investimento?",
        "Como você prefere receber nosso atendimento?",
        "Quando você gostaria de receber esse atendimento?",
        "Qual é o melhor período para entrarmos em contato com você?",
        "Tudo pronto para enviar?",
      ]
    : [
        "Vamos cadastrar uma indicação",
        "Qual é sua relação com essa pessoa?",
        "O que ela está procurando?",
        "Qual crédito ela precisa?",
        "Qual valor disponível mensal para investimento?",
        "Tudo pronto para enviar?",
      ];

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; data?: Dados; updatedAt?: number };
        const aindaValido = !parsed.updatedAt || Date.now() - parsed.updatedAt < 7 * 24 * 60 * 60 * 1000;
        if (aindaValido && parsed.data) {
          setData(parsed.data);
          setStep(Math.max(0, Math.min(10, Number(parsed.step) || 0)));
        } else {
          window.localStorage.removeItem(draftKey);
        }
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    } finally {
      setDraftReady(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftReady || done) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ version: 1, step, data, updatedAt: Date.now() }));
    } catch {
      // O formulário continua utilizável quando o navegador bloquear armazenamento local.
    }
  }, [data, done, draftKey, draftReady, step]);

  const update = (patch: Partial<Dados>) => {
    setData((current) => ({ ...current, ...patch }));
    setError("");
  };

  const avancar = () => {
    if (publico && step === 0 && !data.estrategiaCredito) return setError("Escolha a estratégia que faz mais sentido para você.");
    if (publico && step === 1 && !data.prazoUtilizacaoCredito) return setError("Escolha o prazo que melhor representa seu momento.");
    if (coreStep === 0 && (!data.nome?.trim() || !data.telefone || data.telefone.replace(/\D/g, "").length < 10)) return setError("Informe nome e telefone com DDD.");
    if (coreStep === 1 && (!data.relacao || (data.relacao === "OUTROS" && !data.relacaoOutro?.trim()))) return setError("Escolha ou explique a relação.");
    if (coreStep === 2 && !data.produto) return setError("Escolha o que você procura.");
    if (coreStep === 3 && !data.credito) return setError("Escolha ou informe o crédito desejado.");
    if (coreStep === 4 && !data.capacidadeMensal) return setError("Escolha ou informe a parcela disponível.");
    if (publico && step === 7 && !data.preferenciaAtendimento) return setError("Escolha como prefere receber nosso atendimento.");
    if (publico && step === 8 && !data.quandoAtendimento) return setError("Escolha quando gostaria de receber o atendimento.");
    if (publico && step === 9 && !data.periodoContato) return setError("Escolha o melhor período para contato.");
    setStep((current) => Math.min(total - 1, current + 1));
  };

  const enviar = async () => {
    setSaving(true);
    setError("");
    const result = codigoIndicacao
      ? await fetch("/api/public/programa-indicacao", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ acao: "indicar_por_link", codigoIndicacao, ...data }),
        }).then(async (response) => ({ ...(await response.json()) as { error?: string }, ok: response.ok }))
      : await registrarIndicacaoDoAppAction(data as NovaIndicacaoApp);
    setSaving(false);
    if (!result.ok) return setError(result.error || "Não foi possível enviar agora.");
    if (draftKey) window.localStorage.removeItem(draftKey);
    setDone(true);
  };

  const reiniciar = () => {
    if (draftKey) window.localStorage.removeItem(draftKey);
    setData({});
    setStep(0);
    setDone(false);
  };

  if (done) {
    return (
      <AppIndicadorTheme racon={racon}>
        <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
          <section className="mx-auto max-w-md rounded-[2rem] bg-zinc-900 p-7 text-center">
            <Check className="mx-auto h-14 w-14 rounded-full bg-emerald-400 p-3 text-zinc-950" />
            <p className="mt-6 text-xs font-black text-emerald-300">CADASTRO ENVIADO</p>
            <h1 className="mt-3 text-3xl font-black">Pronto, recebemos suas informações.</h1>
            <p className="mt-3 text-sm text-zinc-300">{publico ? `A equipe de ${nomeIndicador || "seu indicador"} entrará em contato para apresentar as melhores possibilidades para o seu momento.` : "Acompanhe a evolução pelo app."}</p>
            <button onClick={reiniciar} className="mt-7 w-full rounded-2xl bg-amber-400 p-4 font-black text-zinc-950">Cadastrar outro contato</button>
          </section>
        </main>
      </AppIndicadorTheme>
    );
  }

  return (
    <AppIndicadorTheme racon={racon}>
      <main className="min-h-screen bg-zinc-950 px-4 py-5 text-white">
        <div className="mx-auto max-w-md">
          <Link href={publico ? "/" : "/app-indicador"} className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300">
            <ArrowLeft className="h-4 w-4" />{publico ? "Início" : "Meu painel"}
          </Link>
          <header className="mt-7">
            <MessageCircle className="rounded-full bg-amber-400/15 p-3 text-amber-300" size={48} />
            {publico ? (
              <>
                <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
                  Indicação de <span className="text-white">{nomeIndicador || "um parceiro"}</span>
                </div>
                <h1 className="mt-4 text-2xl font-black leading-tight">Queremos conhecer seus planos e apresentar possibilidades diferenciadas para transformar seus objetivos em boas decisões.</h1>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">Conheça novas estratégias em consórcio, pensadas para o seu momento, seu prazo, sua capacidade de investimento e seu crescimento financeiro.</p>
              </>
            ) : null}
            <p className="mt-5 text-xs font-black tracking-[.18em] text-amber-300">
              {publico && step >= 7 ? "FALTA POUCO" : "CONHECENDO SEU MOMENTO"} · {step + 1}/{total}
            </p>
            <h2 className="mt-2 text-2xl font-black">{perguntas[step]}</h2>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-amber-400 transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
          </header>

          <section className="mt-7 rounded-[2rem] bg-zinc-900 p-5">
            {publico && step === 0 ? <div className="grid gap-3">{estrategias.map(([id, label]) => <Escolha key={id} value={label} selected={data.estrategiaCredito === id} onClick={() => update({ estrategiaCredito: id })} />)}</div> : null}
            {publico && step === 1 ? <div className="grid gap-3">{prazos.map(([id, label]) => <Escolha key={id} value={label} selected={data.prazoUtilizacaoCredito === id} onClick={() => update({ prazoUtilizacaoCredito: id })} />)}</div> : null}
            {coreStep === 0 ? <div className="space-y-4"><p className="rounded-2xl bg-zinc-800 p-4 text-sm text-zinc-200">{publico ? `Você chegou pelo link de ${nomeIndicador || "um parceiro"}. Agora conte um pouco sobre você.` : "Primeiro, conte quem é a pessoa. Você já está identificado no app."}</p><label className="block text-sm font-bold">Nome completo<input autoFocus value={data.nome || ""} onChange={(event) => update({ nome: event.target.value })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="Seu nome" /></label><label className="block text-sm font-bold">Telefone / WhatsApp<input inputMode="tel" value={data.telefone || ""} onChange={(event) => update({ telefone: formatWhatsappBrInput(event.target.value) })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="(00) 00000-0000" /></label></div> : null}
            {coreStep === 1 ? <div className="grid gap-3">{[["AMIGO", "Amigo"], ["FAMILIAR", "Familiar"], ["CLIENTE", "Cliente"], ["OUTROS", "Outros"]].map(([id, label]) => <Escolha key={id} value={label} selected={data.relacao === id} onClick={() => update({ relacao: id as NovaIndicacaoApp["relacao"] })} />)}{data.relacao === "OUTROS" ? <input value={data.relacaoOutro || ""} onChange={(event) => update({ relacaoOutro: event.target.value })} className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="Explique a relação" /> : null}</div> : null}
            {coreStep === 2 ? <div className="grid grid-cols-2 gap-3">{[["IMOVEL", "Imóvel"], ["VEICULO", "Veículo"], ["MOTO", "Moto"], ["FROTA", "Frota"]].map(([id, label]) => <Escolha key={id} value={label} selected={data.produto === id} onClick={() => update({ produto: id as NovaIndicacaoApp["produto"] })} />)}</div> : null}
            {coreStep === 3 ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{creditos.map((value) => <Escolha key={value} value={moeda(value)} selected={data.credito === value} onClick={() => update({ credito: value })} />)}</div><label className="block text-sm font-bold">Ou digite outro valor<input inputMode="numeric" value={data.credito || ""} onChange={(event) => update({ credito: Number(event.target.value.replace(/\D/g, "")) || undefined })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="Ex.: 250000" /></label></div> : null}
            {coreStep === 4 ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{parcelas.map((value) => <Escolha key={value} value={`${moeda(value)} / mês`} selected={data.capacidadeMensal === value} onClick={() => update({ capacidadeMensal: value })} />)}</div><label className="block text-sm font-bold">Ou informe outro valor mensal<input inputMode="numeric" value={data.capacidadeMensal || ""} onChange={(event) => update({ capacidadeMensal: Number(event.target.value.replace(/\D/g, "")) || undefined })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="Ex.: 1800" /></label></div> : null}
            {publico && step === 7 ? <div className="grid gap-3">{preferenciasAtendimento.map(([id, label]) => <Escolha key={id} value={label} selected={data.preferenciaAtendimento === id} onClick={() => update({ preferenciaAtendimento: id })} />)}</div> : null}
            {publico && step === 8 ? <div className="grid gap-3">{momentosAtendimento.map(([id, label]) => <Escolha key={id} value={label} selected={data.quandoAtendimento === id} onClick={() => update({ quandoAtendimento: id })} />)}</div> : null}
            {publico && step === 9 ? <div className="grid gap-3">{periodosContato.map(([id, label]) => <Escolha key={id} value={label} selected={data.periodoContato === id} onClick={() => update({ periodoContato: id })} />)}</div> : null}
            {isFinal ? <label className="block text-sm font-bold">Alguma observação? <textarea value={data.observacao || ""} onChange={(event) => update({ observacao: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="Ex.: prefere contato à tarde" /></label> : null}

            {error ? (
              <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">
                <p>{error}</p>
                {error.toLowerCase().includes("telefone") ? (
                  <button type="button" onClick={() => setStep(publico ? 2 : 0)} className="mt-2 underline">Alterar telefone</button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-6 flex gap-3">
              {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-2xl border border-zinc-700 px-5 font-black">Voltar</button> : null}
              <button type="button" disabled={saving || !draftReady} onClick={isFinal ? enviar : avancar} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 p-4 font-black text-zinc-950 disabled:opacity-60">
                {saving ? "Enviando…" : isFinal ? <><Send className="h-4 w-4" />Enviar cadastro</> : "Continuar"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </AppIndicadorTheme>
  );
}
