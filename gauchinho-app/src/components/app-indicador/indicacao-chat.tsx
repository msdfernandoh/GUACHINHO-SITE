"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, MessageCircle, Send } from "lucide-react";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { registrarIndicacaoDoAppAction, type NovaIndicacaoApp } from "@/app/app-indicador/indicar/actions";

const creditos = [50000, 100000, 200000, 300000, 500000, 1000000];
const parcelas = [400, 500, 700, 900, 1000, 1200, 1500, 2000, 3000, 5000];
const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);

function Escolha({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left text-sm font-black transition ${selected ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-700 bg-zinc-900 text-white hover:border-zinc-500"}`}>{value}{selected ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 opacity-50" />}</button>;
}

export function IndicacaoChat() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [data, setData] = useState<Partial<NovaIndicacaoApp>>({});
  const update = (patch: Partial<NovaIndicacaoApp>) => { setData((current) => ({ ...current, ...patch })); setError(""); };
  const avancar = () => {
    if (step === 0 && (!data.nome?.trim() || !data.telefone || data.telefone.replace(/\D/g, "").length < 10)) return setError("Informe nome e telefone com DDD.");
    if (step === 1 && (!data.relacao || (data.relacao === "OUTROS" && !data.relacaoOutro?.trim()))) return setError("Escolha ou explique a relação.");
    if (step === 2 && !data.produto) return setError("Escolha o que essa pessoa procura.");
    if (step === 3 && !data.credito) return setError("Escolha ou informe o crédito desejado.");
    if (step === 4 && !data.capacidadeMensal) return setError("Escolha ou informe a parcela disponível.");
    setStep((current) => current + 1);
  };
  const enviar = async () => {
    setSaving(true); setError("");
    const result = await registrarIndicacaoDoAppAction(data as NovaIndicacaoApp);
    setSaving(false);
    if (!result.ok) return setError(result.error || "Não foi possível enviar agora.");
    setDone(true);
  };
  if (done) return <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white"><section className="mx-auto max-w-md rounded-[2rem] border border-emerald-400/30 bg-zinc-900 p-7 text-center shadow-2xl"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-zinc-950"><Check className="h-9 w-9" /></span><p className="mt-6 text-xs font-black tracking-[.18em] text-emerald-300">INDICAÇÃO ENVIADA</p><h1 className="mt-3 text-3xl font-black">Pronto, você ajudou alguém a começar.</h1><p className="mt-3 text-sm leading-relaxed text-zinc-300">Acompanhe a evolução em Meus indicados e suas comissões pelo app.</p><div className="mt-7 grid gap-3"><button onClick={() => { setData({}); setStep(0); setDone(false); }} className="rounded-2xl bg-amber-400 p-4 font-black text-zinc-950">Cadastrar outra indicação</button><Link href="/app-indicador" className="rounded-2xl border border-zinc-700 p-4 font-black">Voltar ao meu painel</Link></div></section></main>;

  const perguntas = ["Vamos cadastrar uma indicação", "Qual é sua relação com essa pessoa?", "O que ela está procurando?", "Qual crédito ela precisa?", "Qual parcela mensal cabe hoje?", "Tudo pronto para enviar?"];
  return <main className="min-h-screen bg-zinc-950 px-4 py-5 text-white"><div className="mx-auto max-w-md"><Link href="/app-indicador" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300"><ArrowLeft className="h-4 w-4" />Meu painel</Link><header className="mt-7"><span className="inline-flex rounded-full bg-amber-400/15 p-3 text-amber-300"><MessageCircle className="h-6 w-6" /></span><p className="mt-4 text-xs font-black tracking-[.18em] text-amber-300">NOVA INDICAÇÃO · {step + 1}/6</p><h1 className="mt-2 text-3xl font-black">{perguntas[step]}</h1><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-amber-400 transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }} /></div></header><section className="mt-7 rounded-[2rem] bg-zinc-900 p-5 shadow-xl">
    {step === 0 && <div className="space-y-4"><p className="rounded-2xl bg-zinc-800 p-4 text-sm text-zinc-200">Primeiro, conte quem é a pessoa. Você já está identificado no app.</p><label className="block text-sm font-bold">Nome completo<input autoFocus value={data.nome || ""} onChange={(e) => update({ nome: e.target.value })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-base outline-none focus:border-amber-400" placeholder="Nome do indicado" /></label><label className="block text-sm font-bold">Telefone / WhatsApp<input inputMode="tel" value={data.telefone || ""} onChange={(e) => update({ telefone: formatWhatsappBrInput(e.target.value) })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-base outline-none focus:border-amber-400" placeholder="(00) 00000-0000" /></label></div>}
    {step === 1 && <div className="space-y-3"><p className="text-sm text-zinc-300">Isso ajuda nossa equipe a conduzir o contato da forma certa.</p><div className="grid gap-3">{[["AMIGO", "Amigo"], ["FAMILIAR", "Familiar"], ["CLIENTE", "Cliente"], ["OUTROS", "Outros"]].map(([id, label]) => <Escolha key={id} value={label} selected={data.relacao === id} onClick={() => update({ relacao: id as NovaIndicacaoApp["relacao"] })} />)}</div>{data.relacao === "OUTROS" && <input autoFocus value={data.relacaoOutro || ""} onChange={(e) => update({ relacaoOutro: e.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-amber-400" placeholder="Explique a relação" />}</div>}
    {step === 2 && <div className="grid grid-cols-2 gap-3">{[["IMOVEL", "Imóvel"], ["VEICULO", "Veículo"], ["MOTO", "Moto"], ["FROTA", "Frota"]].map(([id, label]) => <Escolha key={id} value={label} selected={data.produto === id} onClick={() => update({ produto: id as NovaIndicacaoApp["produto"] })} />)}</div>}
    {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{creditos.map((value) => <Escolha key={value} value={moeda(value)} selected={data.credito === value} onClick={() => update({ credito: value })} />)}</div><label className="block text-sm font-bold">Ou digite outro valor<input inputMode="numeric" onChange={(e) => update({ credito: Number(e.target.value.replace(/\D/g, "")) || undefined })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-amber-400" placeholder="Ex.: 250000" /></label></div>}
    {step === 4 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{parcelas.map((value) => <Escolha key={value} value={`${moeda(value)} / mês`} selected={data.capacidadeMensal === value} onClick={() => update({ capacidadeMensal: value })} />)}</div><label className="block text-sm font-bold">Ou digite outra parcela<input inputMode="numeric" onChange={(e) => update({ capacidadeMensal: Number(e.target.value.replace(/\D/g, "")) || undefined })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-amber-400" placeholder="Ex.: 1800" /></label></div>}
    {step === 5 && <div className="space-y-4"><div className="rounded-2xl bg-zinc-800 p-4 text-sm leading-7 text-zinc-200"><p><b>Indicado:</b> {data.nome}</p><p><b>Interesse:</b> {data.produto} · {moeda(data.credito || 0)}</p><p><b>Parcela:</b> {moeda(data.capacidadeMensal || 0)} por mês</p></div><label className="block text-sm font-bold">Alguma observação? <span className="font-normal text-zinc-500">(opcional)</span><textarea value={data.observacao || ""} onChange={(e) => update({ observacao: e.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-amber-400" placeholder="Ex.: prefere contato à tarde" /></label></div>}
    {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{error}</p>}
    <div className="mt-6 flex gap-3">{step > 0 && <button type="button" onClick={() => { setStep((current) => current - 1); setError(""); }} className="rounded-2xl border border-zinc-700 px-5 font-black">Voltar</button>}<button type="button" disabled={saving} onClick={step === 5 ? enviar : avancar} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 p-4 font-black text-zinc-950 disabled:opacity-60">{saving ? "Enviando…" : step === 5 ? <><Send className="h-4 w-4" />Enviar indicação</> : "Continuar"}</button></div>
  </section></div></main>;
}
