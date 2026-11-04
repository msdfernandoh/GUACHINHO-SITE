"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import type { LeadListRow } from "@/lib/crm/types";

export function CrmStageWhatsappBulk({ leads }: { leads: LeadListRow[] }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const eligible = leads.filter((lead) => lead.whatsapp?.replace(/\D/g, "").length);
  async function send() {
    if (!template.trim() || !eligible.length || busy) return;
    setBusy(true); setFeedback(null);
    window.open("/erp/whatsapp", "_blank", "noopener,noreferrer");
    try {
      const response = await fetch("/api/erp/whatsapp/disparar-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_ids: eligible.map((lead) => lead.id), template_nome: template.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha no disparo.");
      const success = result.results?.filter((item: { ok: boolean }) => item.ok).length || 0;
      setFeedback(`${success}/${eligible.length} mensagens aceitas. Acompanhe o histórico em Conversas WhatsApp.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha no disparo."); }
    finally { setBusy(false); }
  }
  return <div className="relative"><button type="button" disabled={!eligible.length} onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40" title="Enviar template sequencialmente para os leads desta fase"><MessageCircle className="h-3.5 w-3.5" />Enviar template ({eligible.length})</button>{open && <div className="absolute right-0 top-9 z-30 w-80 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-2xl"><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Disparo nesta fase</h4><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-zinc-400">Serão processados um por vez e registrados no histórico. {eligible.length} lead(s) com WhatsApp.</p><label className="mt-3 block text-xs font-semibold">Nome exato do template Meta<input value={template} onChange={(event) => setTemplate(event.target.value)} placeholder="nome_do_template" className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm" /></label><button type="button" onClick={() => void send()} disabled={busy || !template.trim()} className="mt-3 w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Enviando contato a contato…" : "Iniciar envio"}</button>{feedback && <p role="status" className="mt-2 text-xs text-zinc-300">{feedback}</p>}</div>}</div>;
}
