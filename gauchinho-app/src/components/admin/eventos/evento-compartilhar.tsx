"use client";

import { useId, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/form-primitives";

type Props = { slug: string; nome: string; publicado: boolean };

export function EventoCompartilhar({ slug, nome, publicado }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const qr = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [baixando, setBaixando] = useState(false);

  function eventUrl() {
    return new URL(`/eventos/${encodeURIComponent(slug)}`, window.location.origin).href;
  }

  function abrir() {
    setUrl(eventUrl());
    setStatus("");
    dialog.current?.showModal();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(eventUrl());
      setStatus("Link copiado!");
    } catch {
      abrir();
      setStatus("Não foi possível copiar automaticamente. Selecione e copie o link abaixo.");
    }
  }

  async function baixar() {
    const svg = qr.current?.querySelector("svg");
    if (!svg) return;
    setBaixando(true);
    const exportedSvg = svg.cloneNode(true) as SVGSVGElement;
    exportedSvg.removeAttribute("style");
    exportedSvg.setAttribute("width", "1040");
    exportedSvg.setAttribute("height", "1040");
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(exportedSvg)], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1200, 1200);
      context.drawImage(img, 80, 80, 1040, 1040);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-evento-${slug.replace(/[^a-z0-9_-]/gi, "-")}.png`;
      a.click();
      setStatus("Imagem PNG gerada.");
    } catch {
      setStatus("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      URL.revokeObjectURL(source);
      setBaixando(false);
    }
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={abrir}>QR Code</Button>
      <Button type="button" variant="outline" size="sm" onClick={copiar}>Copiar link</Button>
      <span role="status" className="text-xs">{status}</span>
      <dialog ref={dialog} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-white backdrop:bg-black/75">
        <div className="space-y-4">
          <h2 id={titleId} className="text-lg font-semibold">QR Code do evento</h2>
          <p className="whitespace-normal font-medium">{nome}</p>
          <p className="whitespace-normal text-sm text-zinc-300">Use este QR Code no convite para abrir a página do evento.</p>
          {!publicado && <p className="whitespace-normal text-sm text-amber-300">Este evento ainda não está publicado. Publique-o antes de divulgar o convite.</p>}
          <div ref={qr} className="mx-auto w-fit max-w-full bg-white p-6">
            {url && <QRCode value={url} size={256} level="M" style={{ width: "100%", height: "auto" }} />}
          </div>
          <input aria-label="Link público do evento" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-lg border border-zinc-600 bg-zinc-900 p-3 text-sm text-white" />
          <p role="status" className="whitespace-normal text-sm">{status}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={baixar} disabled={baixando}>{baixando ? "Gerando…" : "Baixar PNG"}</Button>
            <Button type="button" variant="outline" onClick={copiar}>Copiar link</Button>
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Fechar</Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
