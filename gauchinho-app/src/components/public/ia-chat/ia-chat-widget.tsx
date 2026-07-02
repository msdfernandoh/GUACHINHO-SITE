"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Sparkles, X, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { IaConfig } from "@/lib/config/ia-defaults";
import type { WhatsappOrigemRow } from "@/lib/whatsapp/resolve-origem";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";
import { formatWhatsappBrInput, digitsOnlyPhone } from "@/lib/utils/format";
import { MoneyInput } from "@/components/ui/money-input";
import { surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import {
  buildWhatsappPosLead,
  getOrCreateSessionId,
  IA_QUICK_ACTIONS,
} from "@/lib/ia/chat-client";
import { stripGuidedMarker } from "@/lib/ia/guided-assistant";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Props = {
  config: IaConfig;
};

export function IaChatWidget({ config }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [leadNome, setLeadNome] = useState("");
  const [leadInteresse, setLeadInteresse] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formTipo, setFormTipo] = useState("");
  const [formValor, setFormValor] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  const titulo = config.identidade.nomeIa || "Assistente Gauchinho";
  const subtitulo = "Soluções financeiras, consórcio, financiamento e oportunidades";

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: config.identidade.mensagemInicial }]);
    }
  }, [open, messages.length, config.identidade.mensagemInicial]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, showLeadForm]);

  const registrarEvento = useCallback((tipo: string, extra?: Record<string, unknown>) => {
    void fetch("/api/public/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_evento: tipo, origem: "ia_chat", ...extra }),
    });
  }, []);

  const onOpen = useCallback(() => {
    setOpen(true);
    if (!openedRef.current) {
      openedRef.current = true;
      registrarEvento("ia_chat_aberto", { entidade_tipo: pathname ?? "/" });
    }
  }, [pathname, registrarEvento]);

  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener("gauchinho:open-ia-chat", handler);
    return () => window.removeEventListener("gauchinho:open-ia-chat", handler);
  }, [onOpen]);

  useLockBodyScroll(open);

  const sendMessage = useCallback(
    async (text: string, action?: { href?: string; evento?: string; openLeadForm?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (action?.evento) registrarEvento(action.evento);
      if (action?.openLeadForm) {
        setShowLeadForm(true);
        setFormMsg(null);
      }
      if (action?.href) router.push(action.href);

      const nextUser: ChatMsg = { role: "user", content: trimmed };
      const historyForApi = [...messages, nextUser].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((m) => [...m, nextUser]);
      setInput("");
      setLoading(true);

      try {
        const sessionId = getOrCreateSessionId();
        const res = await fetch("/api/ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            paginaOrigem: pathname ?? "/",
            urlOrigem: typeof window !== "undefined" ? window.location.href : pathname,
            history: historyForApi,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          message?: string;
          leadCreated?: boolean;
          whatsappOrigem?: WhatsappOrigemRow | null;
          showLeadCapture?: boolean;
          nomeLead?: string;
          tipoInteresseLead?: string;
          mode?: string;
        };

        const reply =
          data.message ??
          data.reply ??
          "Posso te ajudar pelos atalhos abaixo ou registrar seu interesse para um especialista.";

        setMessages((m) => [...m, { role: "assistant", content: reply }]);

        if (data.showLeadCapture) setShowLeadForm(true);

        if (
          data.leadCreated &&
          config.mostrarWhatsappPosLead &&
          data.whatsappOrigem?.whatsapp_destino &&
          data.whatsappOrigem.exibir_botao_apos_lead !== false
        ) {
          const nome = data.nomeLead?.trim() || leadNome || "cliente";
          const interesse = data.tipoInteresseLead?.trim() || leadInteresse || "atendimento comercial";
          if (data.nomeLead) setLeadNome(data.nomeLead);
          if (data.tipoInteresseLead) setLeadInteresse(data.tipoInteresseLead);
          setWaLink(buildWhatsappPosLead(nome, interesse, data.whatsappOrigem.whatsapp_destino));
          setShowLeadForm(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, pathname, registrarEvento, router, leadInteresse, leadNome, config.mostrarWhatsappPosLead],
  );

  async function submitLeadForm(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormMsg(null);
    try {
      const res = await fetch("/api/public/leads/ia-fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formNome,
          whatsapp: digitsOnlyPhone(formWhatsapp) || formWhatsapp,
          tipoCredito: formTipo || undefined,
          valorCredito: formValor ?? undefined,
          sessionId: getOrCreateSessionId(),
          paginaOrigem: pathname ?? "/",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setFormMsg("Interesse registrado! Em breve um especialista pode entrar em contato.");
      setShowLeadForm(false);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Registrei seus dados. Use o botão WhatsApp abaixo ou os atalhos para continuar explorando o site.",
        },
      ]);
      registrarEvento("ia_lead_fallback_form");
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setFormLoading(false);
    }
  }

  if (!config.ativo) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full",
            "border border-amber-400/50 bg-gradient-to-br from-slate-900 to-slate-950",
            "px-4 py-3 shadow-2xl shadow-amber-500/20 transition hover:border-amber-400",
            "max-sm:px-3",
          )}
          aria-label="Fale com o Gauchinho"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-slate-950">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="hidden text-sm font-semibold text-amber-100 sm:inline">Fale com o Gauchinho</span>
        </button>
      ) : null}

      {open ? (
        <div
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl",
            "bottom-0 right-0 h-[min(100dvh,640px)] w-full sm:bottom-5 sm:right-5 sm:h-[min(85vh,620px)] sm:w-[min(100vw-2rem,400px)] sm:rounded-2xl",
          )}
        >
          <header className="flex items-start justify-between gap-2 border-b border-slate-700/80 bg-slate-900/90 px-4 py-3">
            <div>
              <p className="font-bold text-white">{titulo}</p>
              <p className="text-xs leading-snug text-slate-400">{subtitulo}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Fechar chat"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-amber-400/90 text-slate-950"
                    : "mr-auto border border-slate-700/80 bg-slate-800/90 text-slate-100",
                )}
              >
                {stripGuidedMarker(m.content)}
              </div>
            ))}
            {loading ? <p className="text-xs text-amber-400/80">Assistente digitando…</p> : null}

            {showLeadForm ? (
              <form onSubmit={submitLeadForm} className="mr-auto max-w-[92%] space-y-2 rounded-2xl border border-amber-500/30 bg-slate-900/90 p-3 text-sm">
                <p className="font-semibold text-amber-200">Registrar interesse</p>
                <input
                  required
                  placeholder="Nome"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-white"
                />
                <input
                  required
                  placeholder="WhatsApp"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(formatWhatsappBrInput(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-white"
                />
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-white"
                >
                  <option value="">Tipo de crédito</option>
                  {TIPOS_CREDITO_PUBLICO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <MoneyInput
                  value={formValor}
                  onValueChange={setFormValor}
                  placeholder="Valor aproximado"
                  className={cn(surfaceInputDarkSlate)}
                />
                {formMsg ? <p className="text-xs text-emerald-400">{formMsg}</p> : null}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full rounded-lg bg-amber-400 py-2 font-semibold text-slate-950 disabled:opacity-50"
                >
                  {formLoading ? "Enviando…" : "Enviar dados"}
                </button>
              </form>
            ) : null}
          </div>

          <div className="border-t border-slate-700/80 bg-slate-900/80 px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {IA_QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void sendMessage(a.message ?? a.label, {
                      href: a.href,
                      evento: a.evento,
                      openLeadForm: a.id === "especialista",
                    })
                  }
                  className="rounded-full border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-amber-200/90 hover:border-amber-500/50"
                >
                  {a.label}
                </button>
              ))}
            </div>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => registrarEvento("ia_cta_whatsapp")}
                className="mb-2 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <MessageCircle className="h-4 w-4" />
                Chamar no WhatsApp
              </a>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem…"
                className="min-h-11 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-slate-950 disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
