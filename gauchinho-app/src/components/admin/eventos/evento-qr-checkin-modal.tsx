"use client";

import { useId, useRef, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { Button } from "@/components/ui/form-primitives";

type EventoInfo = {
  id: string;
  nome: string;
  slug: string;
  checkinInterativoAtivo?: boolean;
  publicado?: boolean;
  tipoCheckin?: "evento" | "externo" | string | null;
};

type QrVinculoInfo = {
  qrId: string;
  qrNome: string;
  qrSlug: string;
} | null;

type Props = {
  evento: EventoInfo;
  qrVinculo?: QrVinculoInfo;
  buttonVariant?: "default" | "outline" | "ghost" | "gold";
  buttonSize?: "sm" | "md";
  buttonClassName?: string;
  label?: string;
};

export function EventoQrCheckinModal({
  evento,
  qrVinculo = null,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
  label = "QR Check-in",
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [abaAtiva, setAbaAtiva] = useState<"externo" | "evento" | "permanente">(
    evento.tipoCheckin === "externo" ? "externo" : "evento",
  );
  const [status, setStatus] = useState("");
  const [baixando, setBaixando] = useState(false);

  function getCheckinUrl() {
    return new URL(`/eventos/${encodeURIComponent(evento.slug)}/sorteio`, window.location.origin).href;
  }

  function getExternoUrl() {
    return new URL("/qr/externo", window.location.origin).href;
  }

  function getPermanenteUrl() {
    if (!qrVinculo?.qrSlug) return "";
    return new URL(`/qr/${encodeURIComponent(qrVinculo.qrSlug)}`, window.location.origin).href;
  }

  const urlAtiva =
    abaAtiva === "externo"
      ? getExternoUrl()
      : abaAtiva === "permanente" && qrVinculo
        ? getPermanenteUrl()
        : getCheckinUrl();

  function abrir() {
    const defaultTab = evento.tipoCheckin === "externo" ? "externo" : "evento";
    setAbaAtiva(defaultTab);
    setStatus("");
    dialog.current?.showModal();
  }

  function fechar() {
    dialog.current?.close();
  }

  async function copiar(urlToCopy: string) {
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setStatus("Link copiado com sucesso!");
    } catch {
      setStatus("Não foi possível copiar automaticamente. Selecione e copie o link no campo abaixo.");
    }
  }

  async function baixarPng() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    setBaixando(true);
    const exportedSvg = svg.cloneNode(true) as SVGSVGElement;
    exportedSvg.removeAttribute("style");
    exportedSvg.setAttribute("width", "1040");
    exportedSvg.setAttribute("height", "1040");
    const source = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(exportedSvg)], { type: "image/svg+xml" }),
    );

    try {
      const img = new Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");

      // Fundo branco limpo
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1200, 1200);
      context.drawImage(img, 80, 80, 1040, 1040);

      const filename =
        abaAtiva === "externo"
          ? "qr-fixo-panfletos-externo-1200px.png"
          : abaAtiva === "permanente"
            ? `qr-permanente-${qrVinculo?.qrSlug || "totem"}.png`
            : `qr-checkin-${evento.slug.replace(/[^a-z0-9_-]/gi, "-")}.png`;

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename;
      a.click();
      setStatus("Imagem PNG em alta resolução (1200px) baixada!");
    } catch {
      setStatus("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      URL.revokeObjectURL(source);
      setBaixando(false);
    }
  }

  function baixarSvg() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const exportedSvg = svg.cloneNode(true) as SVGSVGElement;
    exportedSvg.removeAttribute("style");
    exportedSvg.setAttribute("width", "1200");
    exportedSvg.setAttribute("height", "1200");
    const svgBlob = new Blob([new XMLSerializer().serializeToString(exportedSvg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const filename =
      abaAtiva === "externo"
        ? "qr-fixo-panfletos-externo.svg"
        : abaAtiva === "permanente"
          ? `qr-permanente-${qrVinculo?.qrSlug || "totem"}.svg`
          : `qr-checkin-${evento.slug.replace(/[^a-z0-9_-]/gi, "-")}.svg`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Arquivo vetorial SVG baixado (ideal para a gráfica)!");
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={abrir}
        className={buttonClassName}
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          </svg>
          {label}
        </span>
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl backdrop:bg-black/75 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-lg font-bold tracking-tight">
                  QR Code de Check-in
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    evento.tipoCheckin === "externo"
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {evento.tipoCheckin === "externo" ? "Trabalho Externo / Panfletos" : "Evento Presencial"}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{evento.nome}</p>
            </div>
            <button
              type="button"
              onClick={fechar}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Abas para alternar entre QR Fixo de Panfletos, QR do Evento e Totem */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                setAbaAtiva("externo");
                setStatus("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                abaAtiva === "externo"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span>📄 QR Fixo Panfletos</span>
              <span className="rounded bg-black/20 px-1 py-0.5 text-[9px] font-extrabold uppercase">Gráfica</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAbaAtiva("evento");
                setStatus("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                abaAtiva === "evento"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span>🎯 QR Deste Evento</span>
            </button>

            {qrVinculo ? (
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva("permanente");
                  setStatus("");
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  abaAtiva === "permanente"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                Totem ({qrVinculo.qrNome})
              </button>
            ) : null}
          </div>

          {/* Descrição e Orientações do QR ativo */}
          {abaAtiva === "externo" ? (
            <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <span className="text-base">📢</span>
                <span>QR CODE PERMANENTE PARA GRÁFICA (10.000+ PANFLETOS)</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Destino fixo impresso: <strong>https://www.raconsinop.com.br/qr/externo</strong>
              </p>
              <p className="mt-1 text-emerald-800 dark:text-emerald-300 font-semibold">
                ✅ <strong>Este QR NUNCA MUDA.</strong> Imprima na gráfica uma única vez. Quando você criar novos eventos externos no futuro, o panfleto impresso redirecionará automaticamente para o novo evento ativo!
              </p>
            </div>
          ) : abaAtiva === "evento" ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-200">
                <span className="text-base">🎯</span>
                <span>QR Code Exclusivo Deste Evento Individual</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Destino direto: <code>/eventos/{evento.slug}/sorteio</code>
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-400 font-medium">
                ⚠️ <strong>Atenção:</strong> Use este QR apenas no telão ou banner físico temporário desta reunião. <strong>NÃO imprima em 10.000 panfletos</strong>, pois ele fica fixo só neste evento. Para panfletos em massa, use a aba acima <em>"QR Fixo Panfletos"</em>.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-200">
                <span className="text-base">🏷️</span>
                <span>Totem Permanente Vinculado ({qrVinculo?.qrNome})</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Destino: <code>/qr/{qrVinculo?.qrSlug}</code>
              </p>
              <p className="mt-1 text-zinc-500">
                O material físico permanece o mesmo e pode ser redirecionado para futuros eventos na tela de edição.
              </p>
            </div>
          )}

          {/* Renderização do QR Code */}
          <div className="flex flex-col items-center justify-center">
            <div ref={qrRef} className="rounded-2xl border-4 border-white bg-white p-5 shadow-md">
              <QRCode
                value={urlAtiva}
                size={220}
                level="M"
                style={{ width: "100%", height: "auto", maxWidth: "220px" }}
              />
            </div>
          </div>

          {/* URL para cópia */}
          <div>
            <label className="text-xs font-semibold text-zinc-500">
              {abaAtiva === "externo"
                ? "URL Fixa Permanente (Envie este link para a Gráfica):"
                : "URL do Check-in:"}
            </label>
            <input
              aria-label="Link público de check-in do evento"
              readOnly
              value={urlAtiva}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 p-2.5 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>

          {/* Feedback de status */}
          {status ? (
            <p role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {status}
            </p>
          ) : null}

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <Button
              type="button"
              onClick={() => copiar(urlAtiva)}
              className="w-full"
            >
              Copiar link
            </Button>
            <a
              href={urlAtiva}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Abrir ↗
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={baixarPng}
              disabled={baixando}
              className="w-full text-xs"
            >
              {baixando ? "Gerando…" : "Baixar PNG (1200px)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={baixarSvg}
              className="w-full text-xs"
            >
              Baixar SVG
            </Button>
          </div>

          {/* Informação sobre QR Permanente de Totem caso NÃO esteja vinculado */}
          {!qrVinculo && abaAtiva !== "externo" ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-3 text-xs dark:border-zinc-700">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                Totens ou Materiais Impressos de Mesa?
              </p>
              <p className="mt-1 text-zinc-500">
                Nenhum QR permanente vinculado a este evento. Para vincular um totem físico reutilizável, use as configurações do evento.
              </p>
              <Link
                href={`/admin/eventos/${evento.id}`}
                className="mt-2 inline-block font-semibold text-amber-600 hover:underline"
              >
                Vincular QR permanente na edição do evento →
              </Link>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
