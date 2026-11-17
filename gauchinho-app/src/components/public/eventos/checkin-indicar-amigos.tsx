"use client";

import { useState, useTransition } from "react";
import { formatWhatsappBrInput, digitsOnlyPhone } from "@/lib/utils/format";
import { indicarAmigoCheckinAction } from "@/app/(public)/eventos/[slug]/sorteio/checkin-actions";

type Indicado = { nome: string; codigo: string | null; aviso: string | null };

/** Tela final do check-in: indicar amigos para a oportunidade, 1 cupom extra por indicado. */
export function CheckinIndicarAmigos({
  eventoId,
  whatsappIndicador,
  isPreview = false,
}: {
  eventoId: string;
  whatsappIndicador: string;
  isPreview?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indicados, setIndicados] = useState<Indicado[]>([]);
  const [pending, startTransition] = useTransition();

  const valido = nome.trim().length >= 2 && digitsOnlyPhone(telefone).length >= 10;

  function indicar() {
    setErro(null);
    if (isPreview) {
      setIndicados((l) => [...l, { nome: nome.trim(), codigo: "TESTE", aviso: null }]);
      setNome("");
      setTelefone("");
      return;
    }
    startTransition(async () => {
      const r = await indicarAmigoCheckinAction({ eventoId, whatsappIndicador, nome, telefone });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setIndicados((l) => [...l, { nome: nome.trim(), codigo: r.codigoExtra, aviso: r.aviso }]);
      setNome("");
      setTelefone("");
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-14 w-full flex-col items-center justify-center rounded-2xl bg-[var(--theme-primary)] px-4 py-3 text-white shadow-md transition active:scale-[0.98]"
      >
        <span className="text-base font-extrabold">Indique um amigo para participar dessa oportunidade</span>
        <span className="text-sm font-semibold opacity-90">Indique e ganhe um cupom 🎟️</span>
      </button>
    );
  }

  const campo =
    "w-full rounded-xl border-2 border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-500 focus:border-[var(--theme-primary)]";

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--theme-primary)]/40 bg-white p-4 text-left">
      <div>
        <div className="text-base font-extrabold text-zinc-900">Indique um amigo para participar dessa oportunidade</div>
        <div className="text-sm font-semibold text-zinc-600">Cada pessoa indicada vale 1 cupom a mais para você no sorteio.</div>
      </div>

      {indicados.length ? (
        <ul className="space-y-1.5">
          {indicados.map((i, n) => (
            <li key={`${i.nome}-${n}`} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
              {i.codigo ? `🎟️ ${i.codigo} · ${i.nome}` : `✓ ${i.nome}`}
              {i.aviso ? <span className="block text-xs font-medium text-emerald-800">{i.aviso}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do amigo" autoComplete="off" />
      <input
        className={campo}
        value={telefone}
        onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
        placeholder="WhatsApp do amigo"
        inputMode="tel"
        autoComplete="off"
      />
      {erro ? <div className="text-sm font-semibold text-red-600">{erro}</div> : null}
      <button
        type="button"
        onClick={indicar}
        disabled={!valido || pending}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--theme-primary)] px-4 text-base font-extrabold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Gerando cupom…" : indicados.length ? "+ Indicar outra pessoa" : "Indicar e ganhar cupom"}
      </button>
    </div>
  );
}
