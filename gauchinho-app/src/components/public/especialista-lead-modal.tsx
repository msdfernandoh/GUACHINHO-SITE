"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, Textarea, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";
import { MoneyInput } from "@/components/ui/money-input";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";

type WhatsappOrigem = {
  exibir_botao_apos_lead?: boolean;
  whatsapp_destino?: string;
  mensagem_padrao?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** `compact`: só nome e WhatsApp (ex.: Dicas do Tchê). */
  variant?: "full" | "compact";
  /** Texto enviado em observação no lead (compact). */
  leadContext?: string;
};

export function EspecialistaLeadModal({
  open,
  onClose,
  variant = "full",
  leadContext,
}: Props) {
  const compact = variant === "compact";
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoCredito, setTipoCredito] = useState("");
  const [valorCredito, setValorCredito] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [eventoDestaque, setEventoDestaque] = useState<{ slug: string; nome: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || compact) return;
    void fetch("/api/public/eventos/destaque")
      .then((r) => r.json())
      .then((d: { evento?: { slug: string; nome: string } | null }) => {
        setEventoDestaque(d.evento ?? null);
      })
      .catch(() => setEventoDestaque(null));
  }, [open, compact]);

  useLockBodyScroll(open);

  const reset = () => {
    setNome("");
    setWhatsapp("");
    setTipoCredito("");
    setValorCredito(null);
    setObservacao("");
    setErro(null);
    setSucesso(false);
    setWaLink(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const obs = compact
        ? [leadContext?.trim(), observacao.trim()].filter(Boolean).join(" — ") || leadContext
        : observacao.trim() || undefined;

      const res = await fetch("/api/public/leads/especialista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          tipoCredito: compact ? undefined : tipoCredito || undefined,
          valorCredito: compact ? undefined : valorCredito ?? undefined,
          observacao: obs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setSucesso(true);
      const wa = data.whatsappOrigem as WhatsappOrigem | null;
      if (wa?.exibir_botao_apos_lead && wa?.whatsapp_destino) {
        const text = encodeURIComponent(
          wa.mensagem_padrao ?? "Olá! Acabei de me cadastrar como especialista no site Gauchinho.",
        );
        setWaLink(`https://wa.me/${wa.whatsapp_destino.replace(/\D/g, "")}?text=${text}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  const panelClass = cn(
    "flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl",
    compact
      ? "max-h-[min(420px,calc(100dvh-2rem))]"
      : "max-h-[min(540px,calc(100dvh-2rem))] sm:max-h-[min(520px,calc(100dvh-3rem))]",
  );

  const scrollBodyClass = "flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5";

  if (!open || !mounted) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[10050] overflow-y-auto overscroll-contain bg-black/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex min-h-[calc(100dvh-2rem)] items-center justify-center">
        <div className={panelClass} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          {!sucesso ? (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-700/80 px-4 py-3 sm:px-5">
              <div className="min-w-0 pr-2">
                <h2 className={cn("font-bold leading-tight text-white", compact ? "text-base" : "text-base sm:text-lg")}>
                  {compact ? "Fale com o Tchê" : "Falar com especialista"}
                </h2>
                <p className="mt-0.5 text-xs leading-snug text-slate-400">
                  {compact
                    ? "Deixe seu nome e WhatsApp que nossa equipe entra em contato."
                    : "Nome e WhatsApp abaixo; detalhes opcionais se quiser."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className={cn(scrollBodyClass, sucesso && "space-y-3")}>
            {sucesso ? (
              <>
                <h2 className={cn("font-bold text-white", compact ? "text-lg" : "text-lg sm:text-xl")}>
                  {compact ? "Contato recebido" : "Cadastro recebido"}
                </h2>
                <p className="text-sm leading-relaxed text-slate-300">
                  {compact
                    ? "Recebemos seus dados. Nossa equipe entra em contato pelo WhatsApp em breve."
                    : "Cadastro recebido. Um especialista do Gauchinho vai te chamar para uma análise personalizada."}
                </p>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Abrir WhatsApp
                  </a>
                ) : null}
                <Button type="button" variant="outlineGold" className="w-full min-h-10" onClick={handleClose}>
                  Fechar
                </Button>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                {!compact && eventoDestaque ? (
                  <Link
                    href={`/eventos/${eventoDestaque.slug}`}
                    className="block rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/15"
                    onClick={handleClose}
                  >
                    Evento: {eventoDestaque.nome} →
                  </Link>
                ) : null}
                <div>
                  <Label className="text-xs text-slate-200">Nome *</Label>
                  <Input
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={cn("mt-1 h-10", surfaceInputDarkSlate)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-200">Telefone / WhatsApp *</Label>
                  <Input
                    required
                    inputMode="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatWhatsappBrInput(e.target.value))}
                    className={cn("mt-1 h-10", surfaceInputDarkSlate)}
                    placeholder="(51) 99999-9999"
                  />
                </div>
                {!compact ? (
                  <details className="rounded-lg border border-slate-700/80 bg-slate-950/40 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-amber-200/90">
                      Mais detalhes (opcional)
                    </summary>
                    <div className="mt-2 space-y-2.5 border-t border-slate-700/60 pt-2">
                      <div>
                        <Label className="text-xs text-slate-200">Tipo de crédito</Label>
                        <select
                          value={tipoCredito}
                          onChange={(e) => setTipoCredito(e.target.value)}
                          className={cn(
                            "mt-1 h-10 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white",
                            surfaceInputDarkSlate,
                          )}
                        >
                          <option value="">Selecione…</option>
                          {TIPOS_CREDITO_PUBLICO.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label className="text-xs text-slate-200">Valor do crédito</Label>
                          <MoneyInput
                            value={valorCredito}
                            onValueChange={setValorCredito}
                            className={cn("mt-1", surfaceInputDarkSlate)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-200">Observação</Label>
                        <Textarea
                          rows={2}
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          className={cn("mt-1 min-h-[3.25rem] text-sm", surfaceInputDarkSlate)}
                        />
                      </div>
                    </div>
                  </details>
                ) : null}
                {erro ? <p className="text-sm text-red-400">{erro}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="submit"
                    variant="gold"
                    disabled={loading || digitsOnlyPhone(whatsapp).length < 10}
                    className="min-h-10 flex-1"
                  >
                    {loading ? "Enviando…" : compact ? "Enviar contato" : "Enviar cadastro"}
                  </Button>
                  <Button type="button" variant="outlineGold" className="min-h-10 flex-1" onClick={handleClose}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
