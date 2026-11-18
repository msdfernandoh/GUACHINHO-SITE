"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { reservarAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { brl, btnOuro, btnSec, inputCls, TelInput } from "./ui";

type Props = {
  numero: number;
  propostaId: string;
  cotaIds: string[];
  disponivel: boolean;
  whatsapp: string | null;
  chavePix: string | null;
  tipoPix?: string | null;
  favorecido: string | null;
  minutos: number;
  entrada: number;
  resumoTexto: string;
};

export function Relogio({ ate }: { ate: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((new Date(ate).getTime() - agora) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="font-mono text-2xl font-black text-[#0047bb]">{s ? `${hh}:${mm}:${ss}` : "expirada"}</span>;
}

export function AcoesProposta(p: Props) {
  const router = useRouter();
  const path = usePathname();
  const [aberto, setAberto] = useState<"PRE" | "PIX" | null>(null);
  const [expira, setExpira] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const url = typeof window !== "undefined" ? window.location.origin + path : "";
  const wa = p.whatsapp
    ? `https://wa.me/55${p.whatsapp}?text=${encodeURIComponent(`Olá! Quero reservar. ${p.resumoTexto}\n${url}`)}`
    : null;

  return (
    <div className="space-y-3 print:hidden">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button className={btnSec} onClick={() => window.print()}>Imprimir / PDF</button>
        <select className={inputCls} defaultValue="" onChange={(e) => e.target.value && router.push(`${path}?modo=${e.target.value}`)}>
          <option value="">Ver como…</option>
          <option value="COMPLETA">Completa</option>
          <option value="MENSAL">Mensal</option>
          <option value="SEMESTRAL">Semestral antecipado</option>
          <option value="ANUAL">Anual antecipado</option>
          <option value="RESUMO">Média resumida</option>
          <option value="DETALHADA">Detalhada mês a mês</option>
        </select>
        {wa && <a className={`${btnSec} text-center`} href={wa} target="_blank" rel="noreferrer">Reservar pelo WhatsApp</a>}
        <button className={btnSec} onClick={() => navigator.share?.({ title: `Proposta ${p.numero}`, url }) ?? navigator.clipboard.writeText(url)}>Compartilhar</button>
      </div>

      {p.disponivel && (
        <div className="grid grid-cols-2 gap-2">
          <button className={btnSec} onClick={() => setAberto("PRE")}>Pré-reservar</button>
          <button className={btnOuro} onClick={() => setAberto("PIX")}>Reservar com PIX</button>
        </div>
      )}

      {expira && (
        <div className="rounded-2xl border border-[#0047bb]/30 bg-[#0047bb]/5 p-4 text-center">
          <p className="text-sm">Pré-reserva registrada. Ela não segura a cota: feche o negócio e envie o PIX antes de</p>
          <Relogio ate={expira} />
        </div>
      )}

      {aberto && (
        <form
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("tipo", aberto);
            fd.set("cotaIds", p.cotaIds.join(","));
            fd.set("propostaId", p.propostaId);
            start(async () => {
              const r = await reservarAction(fd);
              if (!r.ok) return setMsg(`⚠️ ${r.erro}`);
              setAberto(null);
              if (aberto === "PRE") setExpira(r.expira);
              else setMsg("✅ Comprovante enviado. As cotas ficaram bloqueadas até a confirmação.");
              router.refresh();
            });
          }}
        >
          <p className="font-bold">{aberto === "PRE" ? `Pré-reserva (${p.minutos} min)` : "Reserva com PIX da entrada"}</p>
          {aberto === "PRE" && <p className="text-xs text-slate-500">A pré-reserva mostra aos outros que há interesse, mas não bloqueia a cota.</p>}
          {aberto === "PIX" && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p>Valor da entrada: <b>{brl(p.entrada)}</b></p>
              {p.chavePix ? <p>Chave PIX{p.tipoPix ? ` (${p.tipoPix})` : ""}: <b className="select-all">{p.chavePix}</b>{p.favorecido && ` · ${p.favorecido}`}</p> : <p className="text-slate-500">Peça a chave PIX ao consultor.</p>}
            </div>
          )}
          <input name="nome" className={inputCls} placeholder="Nome completo" required />
          <TelInput name="telefone" placeholder="WhatsApp com DDD" required />
          {aberto === "PIX" && <input name="comprovante" type="file" accept="image/*,application/pdf" capture="environment" className={inputCls} required />}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnSec} onClick={() => setAberto(null)}>Cancelar</button>
            <button className={btnOuro} disabled={pend}>{pend ? "Enviando…" : "Confirmar"}</button>
          </div>
        </form>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
