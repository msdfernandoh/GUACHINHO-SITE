"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarPropostaAction, simularAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { resumirCombinacao, valorAcrescimo, type Acrescimo, type Combinacao, type Preferencia } from "@/lib/contempladas/motor";
import type { CotaPortal } from "@/lib/contempladas/repo";
import { brl, btnOuro, btnSec, Card, inputCls } from "./ui";

const MODOS = [
  ["COMPLETA", "Completa (mensal, semestral e anual)"],
  ["MENSAL", "Só mensal"],
  ["SEMESTRAL", "Só semestral"],
  ["ANUAL", "Só anual"],
  ["RESUMO", "Média resumida"],
] as const;

const numBr = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

type Stats = { simulacoes: number; preReservas: number; reservasPix: number; vendidas: number };

export function Portal({ cotas, stats, logado, adicional }: { cotas: CotaPortal[]; stats: Stats; logado: string | null; adicional: Acrescimo | null }) {
  const router = useRouter();
  const [credito, setCredito] = useState("");
  const [entrada, setEntrada] = useState("");
  const [pref, setPref] = useState<Preferencia>("MENOR_PARCELA");
  const [maxCotas, setMaxCotas] = useState(3);
  const [opcoes, setOpcoes] = useState<{ rotulo: string; c: Combinacao }[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [modo, setModo] = useState("COMPLETA");
  const [desconto, setDesconto] = useState("");
  const [cliente, setCliente] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();

  const porId = useMemo(() => new Map(cotas.map((c) => [c.id, c])), [cotas]);
  const escolhidas = sel.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[];
  const resumo = escolhidas.length ? resumirCombinacao(escolhidas) : null;
  // Adicional fixo do vendedor entra sozinho na entrada; desconto aparece na proposta.
  const extraDe = (credito: number) => (logado ? valorAcrescimo(credito, adicional) : 0);
  const extra = resumo ? extraDe(resumo.credito) : 0;
  const desc = logado ? numBr(desconto) : 0;
  const rentDe = (c: Combinacao, d = 0) => c.comissao + extraDe(c.credito) - d;
  const disponiveis = cotas.filter((c) => c.status === "DISPONIVEL");

  const simular = () =>
    start(async () => {
      setErro(null);
      const r = await simularAction({ credito: numBr(credito), entradaMax: entrada ? numBr(entrada) : null, preferencia: pref, maxCotas });
      const lista: { rotulo: string; c: Combinacao }[] = [];
      if (r.acima) lista.push({ rotulo: "Um pouco acima", c: r.acima });
      if (r.abaixo) lista.push({ rotulo: "Um pouco abaixo", c: r.abaixo });
      for (const c of r.proximas.slice(lista.length)) lista.push({ rotulo: "Outra opção próxima", c });
      setOpcoes(lista);
      if (!lista.length) setErro("Nenhuma combinação cabe nessa entrada. Aumente a entrada ou o número de cotas.");
      else setSel(lista[0].c.cotas.map((x) => x.id));
    });

  const gerar = () =>
    start(async () => {
      const r = await gerarPropostaAction({ cotaIds: sel, modo, desconto: desc, clienteNome: cliente });
      if (r.ok) router.push(`/contempladas/p/${r.numero}`);
      else setErro(r.erro);
    });

  return (
    <>
      <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Cotas disponíveis", disponiveis.length],
          ["Simulações feitas", stats.simulacoes],
          ["Pré-reservas agora", stats.preReservas],
          ["Reservadas com PIX", stats.reservasPix],
        ].map(([l, v]) => (
          <Card key={l as string} className="!p-3">
            <p className="text-2xl font-black text-amber-300">{v}</p>
            <p className="text-[11px] uppercase tracking-wide text-white/60">{l}</p>
          </Card>
        ))}
      </section>

      <Card className="mb-5">
        <h1 className="text-xl font-black">Quanto de crédito você precisa?</h1>
        <p className="mb-4 text-sm text-white/60">O sistema junta as cartas, soma entradas e saldos e traz a opção mais próxima, sempre uma acima e outra abaixo.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-white/60">Crédito desejado
            <input className={inputCls} inputMode="numeric" placeholder="500.000" value={credito} onChange={(e) => setCredito(e.target.value)} />
          </label>
          <label className="text-xs text-white/60">Entrada máxima
            <input className={inputCls} inputMode="numeric" placeholder="200.000" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          </label>
          <label className="text-xs text-white/60">Prioridade
            <select className={inputCls} value={pref} onChange={(e) => setPref(e.target.value as Preferencia)}>
              <option value="MENOR_PARCELA">Menor parcela</option>
              <option value="MENOR_PRAZO">Menor prazo</option>
            </select>
          </label>
          <label className="text-xs text-white/60">Juntar até
            <select className={inputCls} value={maxCotas} onChange={(e) => setMaxCotas(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "cota" : "cotas"}</option>)}
            </select>
          </label>
        </div>
        <button className={`${btnOuro} mt-4 w-full sm:w-auto`} disabled={!numBr(credito) || pend} onClick={simular}>
          {pend ? "Calculando…" : "Encontrar cotas"}
        </button>
        {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}
      </Card>

      {opcoes && opcoes.length > 0 && (
        <section className="mb-5 grid gap-3 md:grid-cols-3">
          {opcoes.map(({ rotulo, c }) => {
            const ativa = c.cotas.map((x) => x.id).sort().join() === [...sel].sort().join();
            return (
              <button key={rotulo + c.credito} onClick={() => setSel(c.cotas.map((x) => x.id))}
                className={`rounded-2xl border p-4 text-left transition ${ativa ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[0.04]"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">{rotulo}</p>
                <p className="text-2xl font-black">{brl(c.credito)}</p>
                <p className="text-sm text-white/70">Entrada {brl(c.entrada + extraDe(c.credito))}</p>
                <p className="mt-2 text-xs text-white/60">{c.cotas.length} {c.cotas.length > 1 ? "cotas juntas" : "cota"} · média {brl(c.parcelaMedia)}/mês · até {c.prazoMaximo} meses</p>
                <p className="text-xs text-white/60">Saldo devedor {brl(c.saldo)}</p>
                {logado && <p className="mt-1 text-xs font-semibold text-emerald-300">Sua rentabilidade {brl(rentDe(c))}</p>}
              </button>
            );
          })}
        </section>
      )}

      <Card className="mb-5 overflow-x-auto !p-0">
        <p className="px-4 pt-4 text-sm font-semibold">Todas as cotas · marque para juntar</p>
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead className="text-xs text-white/50">
            <tr>
              <th className="p-2" />
              <th className="p-2 text-left">Crédito</th>
              <th className="p-2 text-right">Entrada</th>
              <th className="p-2 text-right">Prazo</th>
              <th className="p-2 text-right">Parcela</th>
              <th className="p-2 text-right">Saldo</th>
              {logado && <th className="p-2 text-right">Rentab.</th>}
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {cotas.map((c) => {
              const marcada = sel.includes(c.id);
              const bloqueada = c.status !== "DISPONIVEL";
              return (
                <tr key={c.id} onClick={() => !bloqueada && setSel((s) => (marcada ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                  className={`border-t border-white/5 ${bloqueada ? "opacity-40" : "cursor-pointer"} ${marcada ? "bg-amber-400/10" : ""}`}>
                  <td className="p-2"><input type="checkbox" readOnly checked={marcada} disabled={bloqueada} className="h-4 w-4 accent-amber-400" /></td>
                  <td className="p-2 font-semibold">{brl(c.credito)}</td>
                  <td className="p-2 text-right">{brl(c.entrada + extraDe(c.credito))}</td>
                  <td className="p-2 text-right">{c.prazo}x</td>
                  <td className="p-2 text-right">{brl(c.parcela)}</td>
                  <td className="p-2 text-right">{brl(c.saldo_devedor)}</td>
                  {logado && <td className="p-2 text-right text-emerald-300">{brl(c.comissao_parceiro + extraDe(c.credito))}</td>}
                  <td className="p-2 text-xs">
                    {c.status === "RESERVADA" ? <span className="rounded bg-orange-500/20 px-2 py-0.5 text-orange-300">Reservada</span>
                      : c.preReservas > 0 ? <span className="rounded bg-amber-400/20 px-2 py-0.5 text-amber-200">🔥 {c.preReservas} pré-reserva{c.preReservas > 1 ? "s" : ""}</span>
                      : <span className="text-white/50">Disponível</span>}
                  </td>
                </tr>
              );
            })}
            {!cotas.length && <tr><td colSpan={8} className="p-6 text-center text-white/50">Nenhuma cota cadastrada ainda.</td></tr>}
          </tbody>
        </table>
      </Card>

      {resumo && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-400/30 bg-[#0b1d3d]/95 backdrop-blur">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <b>{escolhidas.length} cota{escolhidas.length > 1 ? "s" : ""}</b>
              <span>Crédito <b className="text-amber-300">{brl(resumo.credito)}</b></span>
              <span>Entrada <b>{brl(resumo.entrada + extra - desc)}</b>{desc > 0 && <span className="text-xs text-white/50"> (−{brl(desc)})</span>}</span>
              <span>Média <b>{brl(resumo.parcelaMedia)}</b>/mês</span>
              <span className="text-white/60">Saldo {brl(resumo.saldo)}</span>
              {logado && <span className="font-semibold text-emerald-300">Rentabilidade {brl(rentDe(resumo, desc))}</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <select className={`${inputCls} !py-2 text-sm`} value={modo} onChange={(e) => setModo(e.target.value)}>
                {MODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input className={`${inputCls} !py-2 text-sm`} placeholder="Nome do cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
              {logado && (
                <input className={`${inputCls} !w-40 !py-2 text-sm`} inputMode="decimal" placeholder="Desconto na entrada R$" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              )}
              <div className="flex gap-2">
                <button className={`${btnSec} !py-2`} onClick={() => setSel([])}>Limpar</button>
                <button className={`${btnOuro} !py-2`} disabled={pend} onClick={gerar}>Gerar proposta</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
