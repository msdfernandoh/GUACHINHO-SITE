"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { parseCartasWhatsAppLote, type MargensEntrada } from "@/lib/cartas/parser";
import type { CartaTipo } from "@/lib/cartas/types";
import {
  importarCartasWhatsAppAction,
  type ResultadoImportacaoCartas,
} from "@/app/admin/cartas-contempladas/importar-actions";
import { formatCurrency } from "@/lib/utils/format";

const TIPO_LABEL: Record<CartaTipo, string> = { imovel: "Imóvel", automovel: "Veículo" };

export function ImportarCartasClient({ margens }: { margens: MargensEntrada }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<CartaTipo | null>(null);
  const [incluirRepetidas, setIncluirRepetidas] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacaoCartas | null>(null);
  const [pendente, iniciar] = useTransition();
  const itens = useMemo(
    () => (texto.trim() ? parseCartasWhatsAppLote(texto, margens, new Date(), tipo) : []),
    [texto, margens, tipo],
  );
  const validas = itens.filter((i) => !i.erro && (incluirRepetidas || !i.repetida));
  const repetidas = itens.filter((i) => !i.erro && i.repetida).length;
  const tiposNoTexto = [...new Set(validas.map((i) => i.tipo_carta).filter(Boolean))] as CartaTipo[];
  const nomesTipos = tiposNoTexto.map((t) => (t === "automovel" ? "veículo" : "imóvel")).join(" e ");

  function enviar(substituir: boolean) {
    if (!validas.length) return;
    const pergunta = substituir
      ? `Cadastrar ${validas.length} carta(s) e inativar as cartas de ${nomesTipos} que estão ativas hoje? As de outro tipo não mudam.`
      : `Cadastrar ${validas.length} carta(s) sem inativar nenhuma?`;
    if (!window.confirm(pergunta)) return;
    iniciar(async () => {
      const r = await importarCartasWhatsAppAction(texto, { substituir, tipo, incluirRepetidas });
      setResultado(r);
      if (r.ok) setTexto("");
    });
  }

  const botao = "min-h-[56px] w-full rounded-2xl px-5 text-base font-extrabold transition active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-base font-bold" htmlFor="texto-cartas">
          Conversa do WhatsApp
        </label>
        <textarea
          id="texto-cartas"
          rows={9}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setResultado(null);
          }}
          placeholder="Cole aqui as mensagens das cartas…"
          className="w-full rounded-xl border-2 border-zinc-200 p-3 text-base outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div>
          <p className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Tipo das cartas</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                [null, "Pelo texto"],
                ["imovel", "Imóvel"],
                ["automovel", "Veículo"],
              ] as [CartaTipo | null, string][]
            ).map(([v, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => setTipo(v)}
                className={`min-h-[48px] rounded-xl border-2 text-sm font-bold ${tipo === v ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-200 dark:border-zinc-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Margem na entrada: imóvel {formatCurrency(margens.imovel)} · veículo {formatCurrency(margens.automovel)}. Mude em Admin ›
          Portfólio SPL.
        </p>
      </div>

      {resultado ? (
        <div
          className={`rounded-2xl border p-4 text-base ${resultado.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          {resultado.ok
            ? `Pronto: ${resultado.incluidas} carta(s) cadastrada(s)${resultado.inativadas ? ` e ${resultado.inativadas} inativada(s)` : ""}.`
            : resultado.erro}
          {resultado.ok ? (
            <Link href="/admin/cartas-contempladas" className="ml-2 font-semibold underline">
              Ver cartas
            </Link>
          ) : null}
        </div>
      ) : null}

      {itens.length ? (
        <div className="space-y-2">
          <p className="text-base font-bold">
            {validas.length} pronta(s) para cadastrar
            {repetidas ? ` · ${repetidas} repetida(s)` : ""}
            {itens.some((i) => i.erro) ? ` · ${itens.filter((i) => i.erro).length} com problema` : ""}
          </p>
          {repetidas ? (
            <label className="flex items-center gap-3 rounded-xl border bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <input type="checkbox" checked={incluirRepetidas} onChange={(e) => setIncluirRepetidas(e.target.checked)} className="h-5 w-5" />
              Cadastrar também as repetidas (são cotas diferentes com as mesmas condições)
            </label>
          ) : null}
          <ul className="grid gap-2 md:grid-cols-2">
            {itens.map((c, i) => {
              const fora = !!c.erro || (c.repetida && !incluirRepetidas);
              return (
                <li
                  key={i}
                  className={`rounded-2xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${fora ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold dark:bg-zinc-800">
                      {c.tipo_carta ? TIPO_LABEL[c.tipo_carta] : "Tipo?"} · {c.administradora ?? "—"}
                    </span>
                    <span className={`text-xs font-bold ${c.erro ? "text-red-600" : c.repetida && !incluirRepetidas ? "text-amber-600" : "text-emerald-700"}`}>
                      {c.erro ?? (c.repetida && !incluirRepetidas ? "Repetida" : "Pronta")}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-black">{formatCurrency(c.credito)}</p>
                  <p className="text-sm">
                    Entrada {formatCurrency(c.entrada_original)} → <b>{formatCurrency(c.entrada)}</b>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {c.prazo_quantidade ? `${c.prazo_quantidade} × ${formatCurrency(c.valor_parcela)}` : "Prazo não lido"} · saldo{" "}
                    {formatCurrency(c.saldo_devedor)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Transferência {formatCurrency(c.taxa_transferencia)} · vencimento{" "}
                    {c.proxima_parcela_data ? c.proxima_parcela_data.split("-").reverse().join("/") : "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="sticky bottom-2 z-10 grid gap-2 rounded-2xl bg-white/90 p-2 shadow-lg backdrop-blur sm:static sm:grid-cols-2 sm:bg-transparent sm:p-0 sm:shadow-none dark:bg-zinc-900/90">
        <button type="button" onClick={() => enviar(true)} disabled={!validas.length || pendente} className={`${botao} bg-amber-500 text-black`}>
          {pendente ? "Salvando…" : `Cadastrar e substituir${nomesTipos ? ` (${nomesTipos})` : ""}`}
        </button>
        <button
          type="button"
          onClick={() => enviar(false)}
          disabled={!validas.length || pendente}
          className={`${botao} border-2 border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white`}
        >
          Apenas cadastrar
        </button>
      </div>
    </div>
  );
}
