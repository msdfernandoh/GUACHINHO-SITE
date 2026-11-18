"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decidirReservaAction,
  permissaoEnvioAction,
  salvarConfigAction,
  statusCotaAction,
} from "@/app/(landing-contempladas)/contempladas/actions";
import type { ConfigContempladas, CotaPortal } from "@/lib/contempladas/repo";
import { brl, btnOuro, Card, inputCls, Sair } from "./ui";

type Reserva = { id: string; tipo: "PRE" | "PIX"; nome: string; telefone: string; cotaIds: string[]; expiraEm: string | null; criadaEm: string; comprovanteUrl: string | null };
type Usuario = { id: string; nome: string; email: string; perfil: string; contempladas_pode_enviar: boolean };

export function Painel(props: {
  reservas: Reserva[];
  cotas: CotaPortal[];
  config: ConfigContempladas;
  stats: { simulacoes: number; preReservas: number; reservasPix: number; vendidas: number };
  usuarios: Usuario[];
  master: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"reservas" | "cotas" | "config" | "acesso">("reservas");
  const [busca, setBusca] = useState("");
  const [pend, start] = useTransition();
  const [cfg, setCfg] = useState(props.config);
  const [ok, setOk] = useState(false);
  const porId = new Map(props.cotas.map((c) => [c.id, c]));
  const agir = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const abas = [["reservas", `Reservas (${props.reservas.length})`], ["cotas", "Cotas"], ...(props.master ? [["config", "Configurar"], ["acesso", "Autorizações"]] : [])] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Simulações", props.stats.simulacoes], ["Pré-reservas", props.stats.preReservas], ["PIX a conferir", props.stats.reservasPix], ["Vendidas", props.stats.vendidas]].map(([l, v]) => (
          <Card key={l as string} className="!p-3"><p className="text-2xl font-black text-amber-300">{v}</p><p className="text-[11px] uppercase text-white/60">{l}</p></Card>
        ))}
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (busca) router.push(`/contempladas/p/${busca.replace(/\D/g, "")}`); }}>
        <input className={inputCls} inputMode="numeric" placeholder="Nº da proposta para reimprimir" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className={btnOuro}>Abrir</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {abas.map(([k, l]) => (
          <button key={k} onClick={() => setAba(k as typeof aba)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${aba === k ? "bg-amber-400 text-[#07142b]" : "bg-white/5"}`}>{l}</button>
        ))}
        <span className="ml-auto self-center"><Sair /></span>
      </div>

      {aba === "reservas" && (
        <div className="space-y-2">
          {!props.reservas.length && <Card className="text-center text-white/50">Nenhuma reserva ativa.</Card>}
          {props.reservas.map((r) => {
            const cs = r.cotaIds.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[];
            return (
              <Card key={r.id} className={r.tipo === "PIX" ? "border-emerald-400/40" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-amber-300">{r.tipo === "PIX" ? "PIX enviado · cota bloqueada" : "Pré-reserva"}</p>
                    <p className="font-bold">{r.nome}</p>
                    <a className="text-sm text-emerald-300 underline" href={`https://wa.me/55${r.telefone}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                  </div>
                  {r.expiraEm && <p className="text-right text-xs text-white/60">expira<br />{new Date(r.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                </div>
                <p className="mt-2 text-sm">{cs.map((c) => `${c.codigo} ${brl(c.credito)}`).join(" + ")}</p>
                {r.comprovanteUrl && <a className="mt-1 inline-block text-sm text-amber-300 underline" href={r.comprovanteUrl} target="_blank" rel="noreferrer">Ver comprovante</a>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button disabled={pend} className="rounded-xl bg-emerald-500 py-3 font-bold text-white" onClick={() => agir(() => decidirReservaAction(r.id, "VENDIDA"))}>✔ Vendida</button>
                  <button disabled={pend} className="rounded-xl border border-white/20 py-3 font-semibold" onClick={() => agir(() => decidirReservaAction(r.id, "CANCELAR"))}>{r.tipo === "PIX" ? "Liberar" : "Remover"}</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "cotas" && (
        <div className="space-y-2">
          {props.cotas.map((c) => (
            <Card key={c.id} className="!p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{brl(c.credito)} <span className="text-xs font-normal text-white/50">{c.codigo}</span></p>
                  <p className="text-xs text-white/60">Entrada {brl(c.entrada)} · {c.prazo}x {brl(c.parcela)}</p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${c.status === "VENDIDA" ? "bg-red-500/20 text-red-200" : c.status === "RESERVADA" ? "bg-orange-500/20 text-orange-200" : "bg-emerald-500/20 text-emerald-200"}`}>{c.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <button disabled={pend || c.status === "VENDIDA"} className="rounded-lg bg-emerald-600 py-2 font-bold" onClick={() => agir(() => statusCotaAction(c.id, "VENDIDA"))}>Vendida</button>
                <button disabled={pend || c.status === "DISPONIVEL"} className="rounded-lg bg-white/10 py-2" onClick={() => agir(() => statusCotaAction(c.id, "DISPONIVEL"))}>Liberar</button>
                {props.master && <button disabled={pend} className="rounded-lg bg-white/10 py-2" onClick={() => agir(() => statusCotaAction(c.id, "INATIVA"))}>Tirar</button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {aba === "config" && props.master && (
        <Card className="space-y-3">
          <label className="block text-sm">Tempo da pré-reserva (minutos) — relógio entre fechar o negócio e o PIX
            <input className={inputCls} type="number" min={5} value={cfg.pre_reserva_minutos} onChange={(e) => setCfg({ ...cfg, pre_reserva_minutos: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">WhatsApp para reservas
            <input className={inputCls} value={cfg.whatsapp ?? ""} onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })} placeholder="66999554703" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">Chave PIX<input className={inputCls} value={cfg.chave_pix ?? ""} onChange={(e) => setCfg({ ...cfg, chave_pix: e.target.value })} /></label>
            <label className="block text-sm">Favorecido<input className={inputCls} value={cfg.favorecido_pix ?? ""} onChange={(e) => setCfg({ ...cfg, favorecido_pix: e.target.value })} /></label>
          </div>
          <label className="block text-sm">Comissão dos usuários
            <select className={inputCls} value={cfg.comissao_modo} onChange={(e) => setCfg({ ...cfg, comissao_modo: e.target.value as ConfigContempladas["comissao_modo"] })}>
              <option value="TABELA">Usar a comissão de cada cota (tabela)</option>
              <option value="PERCENTUAL">Percentual sobre o crédito</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {cfg.comissao_modo === "PERCENTUAL" && (
              <label className="block text-sm">% do crédito<input className={inputCls} type="number" step="0.01" value={cfg.comissao_percentual} onChange={(e) => setCfg({ ...cfg, comissao_percentual: Number(e.target.value) })} /></label>
            )}
            <label className="block text-sm">Repasse ao usuário (%)<input className={inputCls} type="number" value={cfg.comissao_repasse_percentual} onChange={(e) => setCfg({ ...cfg, comissao_repasse_percentual: Number(e.target.value) })} /></label>
          </div>
          <button className={`${btnOuro} w-full`} disabled={pend} onClick={() => agir(async () => { await salvarConfigAction(cfg); setOk(true); })}>Salvar</button>
          {ok && <p className="text-sm text-emerald-300">Salvo.</p>}
        </Card>
      )}

      {aba === "acesso" && props.master && (
        <Card className="space-y-1">
          <p className="mb-2 text-sm text-white/60">Quem pode enviar cotas para o portal.</p>
          {props.usuarios.map((u) => (
            <label key={u.id} className="flex items-center justify-between gap-2 border-t border-white/5 py-2">
              <span className="text-sm"><b>{u.nome}</b><span className="block text-xs text-white/50">{u.email} · {u.perfil}</span></span>
              <input type="checkbox" className="h-6 w-6 accent-amber-400" disabled={pend || u.perfil === "master"}
                checked={u.perfil === "master" || u.contempladas_pode_enviar}
                onChange={(e) => agir(() => permissaoEnvioAction(u.id, e.target.checked))} />
            </label>
          ))}
        </Card>
      )}
    </div>
  );
}
