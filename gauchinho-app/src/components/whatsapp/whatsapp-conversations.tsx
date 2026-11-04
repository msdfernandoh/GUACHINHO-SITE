"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MessageCircle, Send } from "lucide-react";
import type { InstanciaView, MensagemView } from "@/lib/whatsapp/cloud-api/types";

type Props = {
  instancia: InstanciaView;
  mensagens: MensagemView[];
  compact?: boolean;
  leadId?: string | null;
  leadName?: string | null;
  leadPhone?: string | null;
};

function digits(value: string) {
  const normalized = value.replace(/\D/g, "");
  return normalized.startsWith("55") ? normalized : `55${normalized}`;
}

export function WhatsappConversations({ instancia, mensagens, compact = false, leadName, leadPhone }: Props) {
  const contacts = useMemo(() => {
    const map = new Map<string, { numero: string; nome: string | null; ultima: string }>();
    for (const message of mensagens) {
      if (!map.has(message.contato_numero)) {
        map.set(message.contato_numero, { numero: message.contato_numero, nome: message.contato_nome, ultima: message.criada_em });
      }
    }
    if (leadPhone) {
      const phone = digits(leadPhone);
      if (!map.has(phone)) map.set(phone, { numero: phone, nome: leadName || null, ultima: new Date().toISOString() });
    }
    return [...map.values()].sort((a, b) => Date.parse(b.ultima) - Date.parse(a.ultima));
  }, [leadName, leadPhone, mensagens]);

  const [active, setActive] = useState(leadPhone ? digits(leadPhone) : contacts[0]?.numero || "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const conversation = mensagens.filter((message) => message.contato_numero === active).sort((a, b) => Date.parse(a.criada_em) - Date.parse(b.criada_em));
  const contact = contacts.find((item) => item.numero === active);

  async function sendText() {
    if (!active || !text.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/erp/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instancia_id: instancia.id, id_envio: crypto.randomUUID(), para: active, tipo: "text", texto: text.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a mensagem.");
      setText("");
      setFeedback("Mensagem aceita pela Meta.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm ${compact ? "h-full" : "min-h-[680px]"}`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2"><MessageCircle className="text-emerald-600" size={20} /><div><h2 className="font-bold">Conversas WhatsApp</h2><p className="text-xs text-slate-500">{instancia.nome} · histórico da instância</p></div></div>
        {!compact && <a href="/erp/whatsapp" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">Abrir completo <ExternalLink size={14} /></a>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-slate-200 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          {contacts.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhuma conversa registrada.</p> : contacts.map((item) => <button type="button" key={item.numero} onClick={() => setActive(item.numero)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${active === item.numero ? "bg-emerald-50" : "hover:bg-slate-50"}`}><span className="block truncate text-sm font-semibold">{item.nome || item.numero}</span><span className="block text-xs text-slate-500">{item.numero}</span></button>)}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3"><p className="truncate text-sm font-bold">{contact?.nome || active || "Selecione uma conversa"}</p><p className="text-xs text-slate-500">{active || "Número não selecionado"}</p></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {conversation.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Nenhuma mensagem nesta conversa.</p> : conversation.map((message) => <article key={message.id} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm shadow-sm ${message.direcao === "enviada" ? "ml-auto bg-emerald-600 text-white" : "bg-white text-slate-900"}`}><p className="whitespace-pre-wrap break-words">{message.tipo === "template" ? `Template: ${message.template_nome || "sem nome"}` : message.conteudo || "Mensagem sem texto"}</p><time className="mt-1 block text-[10px] opacity-70">{new Date(message.criada_em).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}</time>{message.erro && <p className="mt-1 text-xs text-red-700">{message.erro}</p>}</article>)}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            {feedback && <p role="status" className="mb-2 text-xs text-slate-600">{feedback}</p>}
            <div className="flex items-end gap-2"><textarea value={text} onChange={(event) => setText(event.target.value)} disabled={!active || busy} rows={2} maxLength={4096} placeholder="Digite uma mensagem…" className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" /><button type="button" onClick={() => void sendText()} disabled={!active || !text.trim() || busy} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />Enviar</button></div>
          </div>
        </div>
      </div>
    </section>
  );
}
