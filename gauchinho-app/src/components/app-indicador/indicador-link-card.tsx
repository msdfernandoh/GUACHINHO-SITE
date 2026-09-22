"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";

export function IndicadorLinkCard({ url, titulo = "Meu link de indicação", descricao = "Envie este link. Todo cadastro por ele fica vinculado a você." }: { url: string; titulo?: string; descricao?: string }) {
  const [copied, setCopied] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return <section className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
    <div className="flex gap-3"><span className="mt-0.5 rounded-xl bg-amber-400 p-2 text-zinc-950"><Link2 className="h-5 w-5" /></span><div><h2 className="font-black">{titulo}</h2><p className="mt-1 text-sm text-zinc-300">{descricao}</p></div></div>
    <div className="mt-4 flex gap-2"><input readOnly value={url} aria-label="Meu link de indicação" className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-zinc-200 outline-none" /><button type="button" onClick={() => void copiar()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</button></div>
  </section>;
}
