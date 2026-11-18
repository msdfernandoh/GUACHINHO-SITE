"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reservarAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { CotaPortal } from "@/lib/contempladas/repo";
import { Relogio } from "./acoes-proposta";
import { brl, btnOuro, btnSec, TelInput } from "./ui";
import type { ConfigPublica } from "@/lib/contempladas/publico";

export type { ConfigPublica };

/**
 * Janela de negociação: pré-reserva (só cria escassez, com relógio),
 * reserva com PIX (chave + comprovante → "em análise", bloqueia a cota)
 * e atalho para o WhatsApp de reservas.
 */
export function Negociar({ cotas, entrada, cfg, onClose }: { cotas: CotaPortal[]; entrada: number; cfg: ConfigPublica; onClose: () => void }) {
  const router = useRouter();
  const [aba, setAba] = useState<"PIX" | "PRE">("PIX");
  const [expira, setExpira] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pend, start] = useTransition();
  const credito = cotas.reduce((s, c) => s + c.credito, 0);
  // Sinal de bloqueio da unidade (por tipo de bem); sem sinal, o PIX é a entrada inteira.
  const sinal = cotas.reduce((s, c) => s + (c.tipo === "automovel" ? cfg.sinalAuto : cfg.sinalImovel), 0);
  const usaSinal = cotas.every((c) => (c.tipo === "automovel" ? cfg.sinalAuto : cfg.sinalImovel) > 0);
  const valorPix = usaSinal ? sinal : entrada;
  const resumo = `${cotas.length} cota(s) ${cotas.map((c) => c.codigo).join(", ")} · crédito ${brl(credito)} · entrada ${brl(entrada)}`;
  const wa = cfg.whatsapp ? `https://wa.me/55${cfg.whatsapp}?text=${encodeURIComponent(`Olá! Quero negociar: ${resumo}`)}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#0047bb]">Negociar</p>
            <p className="text-2xl font-black text-[#0a2a66]">{brl(credito)}</p>
            <p className="text-sm text-slate-500">Entrada {brl(entrada)} · {cotas.map((c) => c.codigo).join(" + ")}</p>
            {cfg.unidade && <p className="mt-1 inline-block rounded-full bg-[#0047bb]/10 px-2.5 py-0.5 text-xs font-bold text-[#0047bb]">Cota da unidade {cfg.unidade}</p>}
          </div>
          <button className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {ok ? (
          <div className="rounded-2xl bg-amber-50 p-5 text-center">
            <p className="text-3xl">⏳</p>
            <p className="text-lg font-bold text-amber-800">Comprovante em análise</p>
            <p className="text-sm text-amber-800/80">A cota ficou bloqueada para você até a confirmação{cfg.unidade ? ` da unidade ${cfg.unidade}` : ""}. Avisaremos pelo WhatsApp.</p>
          </div>
        ) : expira ? (
          <div className="rounded-2xl bg-[#0047bb]/5 p-5 text-center">
            <p className="text-sm text-slate-600">Pré-reserva registrada. Ela não segura a cota: feche o negócio e envie o PIX antes de acabar o tempo.</p>
            <div className="my-2"><Relogio ate={expira} /></div>
            <button className={`${btnOuro} w-full`} onClick={() => { setExpira(null); setAba("PIX"); }}>Já tenho o PIX → enviar comprovante</button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              <button className={`rounded-lg py-2 ${aba === "PIX" ? "bg-white text-[#0047bb] shadow" : "text-slate-600"}`} onClick={() => setAba("PIX")}>Reservar com PIX</button>
              <button className={`rounded-lg py-2 ${aba === "PRE" ? "bg-white text-[#0047bb] shadow" : "text-slate-600"}`} onClick={() => setAba("PRE")}>Pré-reservar ({cfg.minutos} min)</button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("tipo", aba);
                fd.set("cotaIds", cotas.map((c) => c.id).join(","));
                setErro(null);
                start(async () => {
                  const r = await reservarAction(fd);
                  if (!r.ok) return setErro(r.erro);
                  if (aba === "PRE") setExpira(r.expira);
                  else setOk(true);
                  router.refresh();
                });
              }}
            >
              {aba === "PIX" ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4 text-sm">
                  <p className="text-slate-500">{usaSinal ? "Sinal para bloquear a cota" : "Valor da entrada"}</p>
                  <p className="text-2xl font-black text-[#0a2a66]">{brl(valorPix)}</p>
                  {usaSinal && <p className="text-xs text-slate-500">O restante da entrada ({brl(Math.max(0, entrada - valorPix))}) é pago no fechamento.</p>}
                  {cfg.chavePix ? (
                    <>
                      <p className="pt-1 text-slate-500">Chave PIX{cfg.tipoPix ? ` (${cfg.tipoPix})` : ""}</p>
                      <div className="flex items-center gap-2">
                        <b className="flex-1 select-all break-all text-base">{cfg.chavePix}</b>
                        <button type="button" className="rounded-lg bg-[#0047bb] px-3 py-1.5 text-xs font-bold text-white"
                          onClick={() => { navigator.clipboard.writeText(cfg.chavePix!); setCopiado(true); }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
                      </div>
                      {cfg.favorecido && <p className="text-slate-500">Favorecido: <b className="text-slate-800">{cfg.favorecido}</b></p>}
                    </>
                  ) : (
                    <p className="text-slate-500">Peça a chave PIX ao consultor.</p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">A pré-reserva mostra aos outros que há interesse e liga o relógio, mas <b>não bloqueia</b> a cota. Só o PIX bloqueia.</p>
              )}

              <input name="nome" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Nome completo" required />
              <TelInput name="telefone" placeholder="WhatsApp com DDD" required />
              {aba === "PIX" && (
                <label className="block rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-sm text-slate-600">
                  📎 Anexar comprovante (foto ou PDF)
                  <input name="comprovante" type="file" accept="image/*,application/pdf" className="mt-2 block w-full text-xs" required />
                </label>
              )}
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <button className={`${btnOuro} w-full`} disabled={pend}>{pend ? "Enviando…" : aba === "PIX" ? "Enviar comprovante" : "Pré-reservar"}</button>
            </form>
          </>
        )}

        {wa && <a className={`${btnSec} mt-3 block text-center !text-emerald-700`} href={wa} target="_blank" rel="noreferrer">💬 Falar no WhatsApp{cfg.unidade ? ` com ${cfg.unidade}` : ""}</a>}
      </div>
    </div>
  );
}
