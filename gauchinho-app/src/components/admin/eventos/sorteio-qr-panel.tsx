"use client";

import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/form-primitives";

type Props = {
  url: string;
  eventoNome: string;
};

export function SorteioQrPanel({ url, eventoNome }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const svgId = useMemo(() => `sorteio-qr-${Math.random().toString(36).slice(2)}`, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  };

  const downloadQr = () => {
    const svg = document.getElementById(svgId)?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-sorteio-${eventoNome.replace(/\s+/g, "-").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const qrBlock = (size: number) => (
    <div id={svgId} className="rounded-xl bg-white p-4">
      <QRCode value={url} size={size} level="M" />
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border p-4 dark:border-zinc-800">
      <h3 className="font-semibold">QR Code do formulário</h3>
      <p className="break-all text-xs text-zinc-500">{url}</p>
      <div className="flex justify-center">{qrBlock(200)}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setFullscreen(true)}>
          Exibir QR Code em tela cheia
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          Copiar link
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Abrir página
        </a>
        <Button type="button" variant="outline" size="sm" onClick={downloadQr}>
          Baixar QR Code
        </Button>
      </div>

      {fullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-white">
          <p className="text-lg font-semibold">{eventoNome}</p>
          <p className="mt-2 max-w-md text-center text-sm text-zinc-300">
            Aponte a câmera do celular e participe do sorteio.
          </p>
          <div className="mt-8">{qrBlock(320)}</div>
          <Button type="button" className="mt-8" variant="outline" onClick={() => setFullscreen(false)}>
            Fechar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
