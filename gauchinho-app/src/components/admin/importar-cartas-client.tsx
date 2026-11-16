"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { parseCartasWhatsAppLote } from "@/lib/cartas/parser";
import {
  importarCartasWhatsAppAction,
  type ResultadoImportacaoCartas,
} from "@/app/admin/cartas-contempladas/importar-actions";
import { Button, Label, Textarea } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";

export function ImportarCartasClient({ margem }: { margem: number }) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacaoCartas | null>(null);
  const [pendente, iniciar] = useTransition();
  const itens = useMemo(() => (texto.trim() ? parseCartasWhatsAppLote(texto, margem) : []), [texto, margem]);
  const validas = itens.filter((i) => !i.erro);

  function confirmar() {
    if (!validas.length) return;
    const ok = window.confirm(
      `Substituir o catálogo? As cartas ativas atuais serão inativadas e ${validas.length} carta(s) nova(s) entram como disponíveis.`,
    );
    if (!ok) return;
    iniciar(async () => {
      const r = await importarCartasWhatsAppAction(texto);
      setResultado(r);
      if (r.ok) setTexto("");
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Label>Conversa do WhatsApp</Label>
        <Textarea
          rows={12}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setResultado(null);
          }}
          placeholder="[12:58, 13/11/2026] +55 55 9966-5641: 🔥OPORTUNIDADE🔥 ..."
        />
        <p className="text-xs text-zinc-500">
          Cada entrada recebe {formatCurrency(margem)} de margem. O valor pode ser mudado em Configurações › Portfólio SPL.
        </p>
      </div>

      {resultado ? (
        <div
          className={`rounded-xl border p-4 text-sm ${resultado.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          {resultado.ok
            ? `Catálogo atualizado: ${resultado.incluidas} carta(s) incluída(s) e ${resultado.inativadas} inativada(s).`
            : resultado.erro}
          {resultado.ok ? (
            <Link href="/admin/cartas-contempladas" className="ml-2 font-semibold underline">
              Ver cartas
            </Link>
          ) : null}
        </div>
      ) : null}

      {itens.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
              <tr>
                {["#", "Tipo", "Crédito", "Entrada (original → site)", "Prazo", "Saldo devedor", "Transferência", "Vencimento", "Situação"].map((h) => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((c, i) => (
                <tr key={i} className="border-t dark:border-zinc-800">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3">{c.tipo_carta === "automovel" ? "Veículo" : c.tipo_carta === "imovel" ? "Imóvel" : "—"} · {c.administradora ?? "—"}</td>
                  <td className="p-3 font-semibold">{formatCurrency(c.credito)}</td>
                  <td className="p-3">{formatCurrency(c.entrada_original)} → <b>{formatCurrency(c.entrada)}</b></td>
                  <td className="p-3">{c.prazo_quantidade ? `${c.prazo_quantidade} × ${formatCurrency(c.valor_parcela)}` : "—"}</td>
                  <td className="p-3">{formatCurrency(c.saldo_devedor)}</td>
                  <td className="p-3">{formatCurrency(c.taxa_transferencia)}</td>
                  <td className="p-3">{c.proxima_parcela_data ? c.proxima_parcela_data.split("-").reverse().join("/") : "—"}</td>
                  <td className={`p-3 ${c.erro ? "text-red-600" : "text-emerald-700"}`}>{c.erro ?? "Pronta"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Button type="button" variant="gold" onClick={confirmar} disabled={!validas.length || pendente}>
        {pendente ? "Atualizando…" : `Substituir catálogo por ${validas.length} carta(s)`}
      </Button>
    </div>
  );
}
