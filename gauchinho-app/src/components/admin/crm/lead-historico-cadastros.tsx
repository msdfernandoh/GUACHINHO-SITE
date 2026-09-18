"use client";

import { History, Calendar, DollarSign, Tag, MapPin, Sparkles, HelpCircle } from "lucide-react";

export function LeadHistoricoCadastros({
  historicoTexto,
}: {
  historicoTexto?: string | null;
}) {
  if (!historicoTexto || !historicoTexto.trim()) {
    return null;
  }

  // Divide as abordagens separadas por '---'
  const blocks = historicoTexto
    .split(/\n\s*---\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Histórico de Cadastros & Abordagens
            </h2>
            <p className="text-[11px] text-zinc-400">
              Informações unificadas pelo WhatsApp · {blocks.length}{" "}
              {blocks.length === 1 ? "interação registrada" : "interações registradas"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300">
          Chave: Telefone Unificado
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {blocks.map((block, idx) => {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          const firstLine = lines[0] || "";
          const detailLines = lines.slice(1);

          // Extrai data do padrão [DD/MM/AAAA HH:mm]
          const dateMatch = firstLine.match(/^\[(.*?)\]\s*(.*)$/);
          const dateStr = dateMatch ? dateMatch[1] : null;
          const titleStr = dateMatch ? dateMatch[2] : firstLine;

          return (
            <div
              key={idx}
              className={`rounded-xl border p-3.5 transition-colors ${
                idx === 0
                  ? "border-amber-500/30 bg-amber-950/10"
                  : "border-zinc-800/90 bg-zinc-950/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {dateStr && (
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                      <Calendar className="h-3 w-3" />
                      {dateStr}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-zinc-200">
                    {titleStr || "Nova interação"}
                  </span>
                </div>
                {idx === 0 && (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Mais recente
                  </span>
                )}
              </div>

              {detailLines.length > 0 ? (
                <div className="mt-2.5 space-y-1 text-xs text-zinc-300">
                  {detailLines.map((line, lIdx) => {
                    const clean = line.replace(/^[•\-\*]\s*/, "");
                    const isValor = clean.toLowerCase().includes("valor");
                    const isEntrada = clean.toLowerCase().includes("entrada");
                    const isTipo = clean.toLowerCase().includes("tipo");
                    const isEvento = clean.toLowerCase().includes("evento");

                    let icon = <Sparkles className="h-3.5 w-3.5 text-zinc-500" />;
                    if (isValor || isEntrada) {
                      icon = <DollarSign className="h-3.5 w-3.5 text-emerald-400" />;
                    } else if (isTipo) {
                      icon = <Tag className="h-3.5 w-3.5 text-amber-400" />;
                    } else if (isEvento) {
                      icon = <MapPin className="h-3.5 w-3.5 text-blue-400" />;
                    }

                    return (
                      <div key={lIdx} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">{icon}</span>
                        <span
                          className={
                            isValor || isEntrada
                              ? "font-medium text-emerald-300"
                              : isTipo
                              ? "font-medium text-amber-200"
                              : "text-zinc-300"
                          }
                        >
                          {clean}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">{block}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
