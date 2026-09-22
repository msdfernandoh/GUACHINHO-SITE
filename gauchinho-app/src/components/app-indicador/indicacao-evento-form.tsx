"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { registrarIndicacaoEventoDoAppAction } from "@/app/app-indicador/indicar/actions";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { AppIndicadorTheme } from "./app-indicador-theme";

type EventoOption = {
  id: string;
  nome: string;
  dataEvento: string | null;
  local: string | null;
  cidade: string | null;
};

const dataEvento = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Cuiaba" }).format(new Date(value))
    : "Data a confirmar";

export function IndicacaoEventoForm({
  racon,
  nomeIndicador,
  eventos,
}: {
  racon: boolean;
  nomeIndicador: string;
  eventos: EventoOption[];
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const enviar = async () => {
    setSaving(true);
    setError("");
    const result = await registrarIndicacaoEventoDoAppAction({ nome, telefone, empresa, observacao });
    setSaving(false);
    if (!result.ok) return setError(result.error ?? "Não foi possível incluir o convidado.");
    setDone(result.eventoNome ?? "pendente");
  };

  if (done) {
    return (
      <AppIndicadorTheme racon={racon}>
        <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
          <section className="mx-auto max-w-md rounded-[2rem] bg-zinc-900 p-7 text-center">
            <Check className="mx-auto h-14 w-14 rounded-full bg-emerald-400 p-3 text-zinc-950" />
            <h1 className="mt-5 text-3xl font-black">Convidado incluído.</h1>
            <p className="mt-3 text-sm text-zinc-300">{done === "pendente" ? "O contato ficou na fila de convites pendentes até existir um evento ativo." : `O contato entrou como pendente na lista de “${done}” e poderá confirmar sua participação.`}</p>
            <Link href="/app-indicador" className="mt-7 block rounded-2xl bg-amber-400 p-4 font-black text-zinc-950">Voltar ao painel</Link>
          </section>
        </main>
      </AppIndicadorTheme>
    );
  }

  return (
    <AppIndicadorTheme racon={racon}>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/app-indicador/indicar" className="text-sm font-bold text-zinc-300">← Escolher outro tipo</Link>
          <header className="mt-7">
            <CalendarDays className="h-12 w-12 rounded-2xl bg-amber-400 p-3 text-zinc-950" />
            <p className="mt-4 text-xs font-black tracking-[.18em] text-amber-300">CONVITE DE {nomeIndicador.toUpperCase()}</p>
            <h1 className="mt-2 text-3xl font-black">Adicionar ao evento</h1>
            <p className="mt-2 text-sm text-zinc-400">{eventos.length ? "O convite será incluído automaticamente no evento ativo." : "Sem evento ativo agora: o convite ficará na lista de pendentes."}</p>
          </header>

          <section className="mt-6 space-y-4 rounded-[2rem] bg-zinc-900 p-5">
            {eventos[0] ? (
              <p className="rounded-2xl bg-zinc-800 p-3 text-sm text-zinc-200">
                <strong>{eventos[0].nome}</strong> · {dataEvento(eventos[0].dataEvento)}<br />
                {[eventos[0].local, eventos[0].cidade].filter(Boolean).join(" · ") || "Local a confirmar"}
              </p>
            ) : <p className="rounded-2xl bg-amber-400/10 p-3 text-sm text-amber-200">Nenhum evento ativo. Seu convite será guardado para vinculação posterior.</p>}
                <label className="block text-sm font-bold">Nome completo<input value={nome} onChange={(event) => setNome(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                <label className="block text-sm font-bold">WhatsApp / telefone<input inputMode="tel" value={telefone} onChange={(event) => setTelefone(formatWhatsappBrInput(event.target.value))} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="(00) 00000-0000" /></label>
                <label className="block text-sm font-bold">Empresa ou atividade (opcional)<input value={empresa} onChange={(event) => setEmpresa(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                <label className="block text-sm font-bold">Observação (opcional)<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{error}</p> : null}
                <button type="button" disabled={saving} onClick={enviar} className="w-full rounded-2xl bg-amber-400 p-4 font-black text-zinc-950 disabled:opacity-60">{saving ? "Salvando…" : "Adicionar à lista do evento"}</button>
          </section>
        </div>
      </main>
    </AppIndicadorTheme>
  );
}
