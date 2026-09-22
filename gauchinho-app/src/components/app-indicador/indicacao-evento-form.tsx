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
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
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
    const result = await registrarIndicacaoEventoDoAppAction({ eventoId, nome, telefone, empresa, observacao });
    setSaving(false);
    if (!result.ok) return setError(result.error ?? "Não foi possível incluir o convidado.");
    setDone(result.eventoNome);
  };

  if (done) {
    return (
      <AppIndicadorTheme racon={racon}>
        <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
          <section className="mx-auto max-w-md rounded-[2rem] bg-zinc-900 p-7 text-center">
            <Check className="mx-auto h-14 w-14 rounded-full bg-emerald-400 p-3 text-zinc-950" />
            <h1 className="mt-5 text-3xl font-black">Convidado incluído.</h1>
            <p className="mt-3 text-sm text-zinc-300">O contato entrou como pendente na lista de “{done}” e poderá confirmar sua participação.</p>
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
            <p className="mt-2 text-sm text-zinc-400">O convidado ficará pendente até confirmar sua participação.</p>
          </header>

          <section className="mt-6 space-y-4 rounded-[2rem] bg-zinc-900 p-5">
            {eventos.length ? (
              <>
                <label className="block text-sm font-bold">Evento
                  <select value={eventoId} onChange={(event) => setEventoId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
                    {eventos.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome} · {dataEvento(evento.dataEvento)}</option>)}
                  </select>
                </label>
                {eventos.find((evento) => evento.id === eventoId) ? (
                  <p className="rounded-2xl bg-zinc-800 p-3 text-xs text-zinc-300">
                    {[eventos.find((evento) => evento.id === eventoId)?.local, eventos.find((evento) => evento.id === eventoId)?.cidade].filter(Boolean).join(" · ") || "Local a confirmar"}
                  </p>
                ) : null}
                <label className="block text-sm font-bold">Nome completo<input value={nome} onChange={(event) => setNome(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                <label className="block text-sm font-bold">WhatsApp / telefone<input inputMode="tel" value={telefone} onChange={(event) => setTelefone(formatWhatsappBrInput(event.target.value))} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" placeholder="(00) 00000-0000" /></label>
                <label className="block text-sm font-bold">Empresa ou atividade (opcional)<input value={empresa} onChange={(event) => setEmpresa(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                <label className="block text-sm font-bold">Observação (opcional)<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4" /></label>
                {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{error}</p> : null}
                <button type="button" disabled={saving} onClick={enviar} className="w-full rounded-2xl bg-amber-400 p-4 font-black text-zinc-950 disabled:opacity-60">{saving ? "Salvando…" : "Adicionar à lista do evento"}</button>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="font-bold">Nenhum evento disponível agora.</p>
                <p className="mt-2 text-sm text-zinc-400">Quando um próximo evento for publicado, ele aparecerá aqui.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </AppIndicadorTheme>
  );
}
