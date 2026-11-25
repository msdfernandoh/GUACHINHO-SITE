"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { statusLeadAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { LeadPortal } from "@/lib/contempladas/repo";
import { brl, Card, mascaraTelefone } from "./ui";

const SITUACOES: [LeadPortal["status"], string, string][] = [
  ["NOVO", "Novo", "bg-blue-100 text-blue-800"],
  ["EM_CONTATO", "Em contato", "bg-amber-100 text-amber-800"],
  ["FECHADO", "Fechado", "bg-emerald-100 text-emerald-800"],
  ["PERDIDO", "Perdido", "bg-slate-200 text-slate-600"],
];

/** Interessados que clicaram em "Negociar" sem login. */
export function Leads({ itens, dono }: { itens: LeadPortal[]; dono: boolean }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [filtro, setFiltro] = useState<LeadPortal["status"] | "TODOS">("TODOS");
  const [erro, setErro] = useState<string | null>(null);
  const lista = itens.filter((l) => filtro === "TODOS" || l.status === filtro);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Quem clicou em <b>Negociar</b> sem login e deixou nome e WhatsApp. {dono ? "Você vê todos os leads." : "Você vê os leads das suas cotas."} Os leads também entram no CRM do ERP.
      </p>
      <div className="flex flex-wrap gap-2">
        {([["TODOS", "Todos"], ...SITUACOES.map(([k, l]) => [k, l])] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k as LeadPortal["status"] | "TODOS")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === k ? "bg-[#0047bb] text-white" : "bg-slate-100 text-slate-700"}`}>
            {l} ({k === "TODOS" ? itens.length : itens.filter((x) => x.status === k).length})
          </button>
        ))}
      </div>
      {erro ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p> : null}
      <Card className="divide-y">
        {lista.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nenhum lead por aqui.</p>
        ) : (
          lista.map((l) => {
            const sit = SITUACOES.find(([k]) => k === l.status) ?? SITUACOES[0];
            const msg = `Olá ${l.nome.split(" ")[0]}! Vi seu interesse na carta contemplada ${l.codigos.join(", ")} (crédito ${brl(l.credito)}). Posso te ajudar?`;
            return (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{l.nome} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sit[2]}`}>{sit[1]}</span></p>
                  <p className="text-sm text-slate-600">{mascaraTelefone(l.telefone)} · {new Date(l.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                  <p className="text-xs text-slate-500">
                    {l.codigos.join(", ")} · crédito {brl(l.credito)} · entrada {brl(l.entrada)}{dono && l.donos.length ? ` · ${l.donos.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" href={`https://wa.me/55${l.telefone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                  <select disabled={pend} className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm" value={l.status}
                    onChange={(e) => start(async () => {
                      const r = await statusLeadAction(l.id, e.target.value as LeadPortal["status"]);
                      setErro(r.ok ? null : r.erro ?? "Erro.");
                      if (r.ok) router.refresh();
                    })}>
                    {SITUACOES.map(([k, rot]) => <option key={k} value={k}>{rot}</option>)}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
