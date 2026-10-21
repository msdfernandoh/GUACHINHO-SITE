"use client";

import { useId, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { getEventoQrFixoPath } from "@/lib/eventos-sorteio/qr-fixo";
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
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
  label = "QR Check-in",
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [urlAtiva, setUrlAtiva] = useState("");
  const externo = evento.tipoCheckin === "externo";
  const [status, setStatus] = useState("");
  const [baixando, setBaixando] = useState(false);

  function abrir() {
    setUrlAtiva(new URL(getEventoQrFixoPath(evento.tipoCheckin), window.location.origin).href);
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

      const filename = externo
        ? "qr-fixo-panfletos-externo-1200px.png"
        : "qr-fixo-palestras-network-1200px.png";

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
    // Zona branca de impressão também no arquivo vetorial (4+ módulos).
    exportedSvg.setAttribute("viewBox", "-16 -16 252 252");
    const fundo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    fundo.setAttribute("x", "-16");
    fundo.setAttribute("y", "-16");
    fundo.setAttribute("width", "252");
    fundo.setAttribute("height", "252");
    fundo.setAttribute("fill", "#ffffff");
    exportedSvg.prepend(fundo);
    const svgBlob = new Blob([new XMLSerializer().serializeToString(exportedSvg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const filename = externo
      ? "qr-fixo-panfletos-externo.svg"
      : "qr-fixo-palestras-network.svg";

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

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-100">
            <p className="font-bold">
              {externo ? "QR fixo — Trabalho externo / Panfletos" : "QR fixo — Palestras / Eventos presenciais"}
            </p>
            <p className="mt-2 leading-relaxed">
              Este QR Code é permanente e pode ser impresso uma única vez.
              {externo
                ? " O mesmo endereço abre automaticamente a ação externa ativa."
                : " O mesmo endereço abre automaticamente o evento presencial ativo de data mais recente, respeitando seu horário de check-in."}
            </p>
            <p className="mt-2 font-semibold">Ao trocar de evento, reutilize este mesmo QR Code.</p>
          </div>

          {/* Renderização do QR Code */}
          <div className="flex flex-col items-center justify-center">
            <div ref={qrRef} className="rounded-2xl border-4 border-white bg-white p-5 shadow-md">
              {urlAtiva && <QRCode
                value={urlAtiva}
                size={220}
                level="M"
                style={{ width: "100%", height: "auto", maxWidth: "220px" }}
              />}
            </div>
          </div>

          {/* URL para cópia */}
          <div>
            <label className="text-xs font-semibold text-zinc-500">
              URL fixa permanente (envie este link para a gráfica):
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


        </div>
      </dialog>
    </>
  );
}
