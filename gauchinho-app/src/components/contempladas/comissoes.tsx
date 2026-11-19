"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarRecebimentoAction, pagarComissaoAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { Comissao } from "@/lib/contempladas/repo";
import { brl, Card } from "./ui";

const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const STATUS = {
  PENDENTE: ["Pendente de pagamento", "bg-amber-100 text-amber-800"],
  PAGO: ["Pago · aguardando confirmação", "bg-[#0047bb]/10 text-[#0047bb]"],
  RECEBIDO: ["Recebido", "bg-emerald-100 text-emerald-800"],
} as const;

function Linha({ c, lado, onAcao }: { c: Comissao; lado: "pagar" | "receber"; onAcao: (msg: string) => void }) {
  const router = useRouter();
  const [abrir, setAbrir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const [rotulo, cor] = STATUS[c.status];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[#0a2a66]">{c.codigo} · {brl(c.credito)}{c.propostaNumero ? <span className="font-normal text-slate-500"> · proposta nº {c.propostaNumero}</span> : null}</p>
          <p className="text-xs text-slate-500">
            {lado === "pagar" ? `Revenda ${c.revenda ?? "—"}` : `Administrador ${c.dono ?? "—"}`} · vendida em {dataHora(c.criadaEm)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Comissão {brl(c.valorComissao)}{c.valorAdicional ? ` + adicional da revenda ${brl(c.valorAdicional)}` : ""}{c.valorDesconto ? ` − desconto ${brl(c.valorDesconto)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-emerald-700">{brl(c.valor)}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cor}`}>{rotulo}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {c.pagoEm && <span className="text-slate-500">Pago em {dataHora(c.pagoEm)}</span>}
        {c.recebidoEm && <span className="text-slate-500">· recebido em {dataHora(c.recebidoEm)}</span>}
        {c.comprovanteUrl && <a className="font-bold text-[#0047bb] underline" href={c.comprovanteUrl} target="_blank" rel="noreferrer">Ver comprovante</a>}
        {lado === "pagar" && c.status === "PENDENTE" && !abrir && (
          <button className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white" onClick={() => setAbrir(true)}>Marcar como pago</button>
        )}
        {lado === "receber" && c.status === "PAGO" && (
          <button className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white" disabled={pend}
            onClick={() => start(async () => {
              const r = await confirmarRecebimentoAction(c.id);
              if (!r.ok) return setErro(r.erro);
              onAcao("✅ Recebimento confirmado.");
              router.refresh();
            })}>Confirmar recebido</button>
        )}
      </div>

      {abrir && (
        <form className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("id", c.id);
            start(async () => {
              const r = await pagarComissaoAction(fd);
              if (!r.ok) return setErro(r.erro);
              setAbrir(false);
              onAcao("✅ Comissão marcada como paga.");
              router.refresh();
            });
          }}>
          <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-600">
            📎 Comprovante do pagamento (foto ou PDF)
            <input name="comprovante" type="file" accept="image/*,application/pdf" className="mt-2 block w-full text-xs" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-white py-2 text-sm font-semibold ring-1 ring-slate-200" onClick={() => setAbrir(false)}>Cancelar</button>
            <button className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white" disabled={pend}>{pend ? "Enviando…" : "Confirmar pagamento"}</button>
          </div>
        </form>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">⚠️ {erro}</p>}
    </div>
  );
}

/** Aba Comissões: a pagar (administrador/dono) e a receber (revenda), com cards de volume. */
export function Comissoes({ itens, authUserId, dono, volumeVendido }: { itens: Comissao[]; authUserId: string; dono: boolean; volumeVendido: number | null }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const pagar = itens.filter((c) => dono || c.donoAuthId === authUserId);
  const receber = itens.filter((c) => c.revendaAuthId === authUserId);
  const soma = (l: Comissao[], st?: Comissao["status"][]) => l.filter((c) => !st || st.includes(c.status)).reduce((s, c) => s + c.valor, 0);
  const volumeRevenda = receber.reduce((s, c) => s + c.credito, 0);
  const ver = (l: Comissao[], abertas: Comissao["status"][]) => (filtro === "todas" ? l : l.filter((c) => abertas.includes(c.status)));

  const cards: [string, string][] = [];
  if (pagar.length || dono || volumeVendido != null) {
    cards.push(["Volume negociado", brl(volumeVendido ?? pagar.reduce((s, c) => s + c.credito, 0))]);
    cards.push(["A pagar às revendas", brl(soma(pagar, ["PENDENTE"]))]);
    cards.push(["Pago", brl(soma(pagar, ["PAGO", "RECEBIDO"]))]);
  }
  if (receber.length) {
    cards.push(["Meu volume vendido", brl(volumeRevenda)]);
    cards.push(["A receber", brl(soma(receber, ["PENDENTE", "PAGO"]))]);
    cards.push(["Recebido", brl(soma(receber, ["RECEBIDO"]))]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([l, v], i) => (
          <Card key={l} className={`!p-4 ${i === 0 ? "!bg-[#0047bb] !text-white" : ""}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${i === 0 ? "text-white/75" : "text-slate-500"}`}>{l}</p>
            <p className={`text-2xl font-black ${i === 0 ? "text-white" : "text-[#0a2a66]"}`}>{v}</p>
          </Card>
        ))}
      </div>

      <div className="flex gap-1">
        {([["abertas", "Em aberto"], ["todas", "Todas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filtro === k ? "bg-[#0a2a66] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>
        ))}
      </div>
      {aviso && <p className="text-sm">{aviso}</p>}

      {(dono || pagar.length > 0) && (
        <section className="space-y-2">
          <h3 className="font-extrabold text-[#0a2a66]">Pendentes de pagamento às revendas</h3>
          {ver(pagar, ["PENDENTE", "PAGO"]).map((c) => <Linha key={c.id} c={c} lado="pagar" onAcao={setAviso} />)}
          {!ver(pagar, ["PENDENTE", "PAGO"]).length && <p className="text-sm text-slate-500">Nada pendente.</p>}
        </section>
      )}

      {receber.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-extrabold text-[#0a2a66]">Minhas comissões a receber</h3>
          {ver(receber, ["PENDENTE", "PAGO"]).map((c) => <Linha key={c.id} c={c} lado="receber" onAcao={setAviso} />)}
          {!ver(receber, ["PENDENTE", "PAGO"]).length && <p className="text-sm text-slate-500">Nada pendente.</p>}
        </section>
      )}

      {!pagar.length && !receber.length && !dono && (
        <Card className="text-center text-slate-500">As comissões aparecem aqui quando uma cota de proposta sua for vendida.</Card>
      )}
    </div>
  );
}
