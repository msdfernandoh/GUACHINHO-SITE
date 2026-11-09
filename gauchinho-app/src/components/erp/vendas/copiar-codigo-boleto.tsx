"use client";
import { useState } from "react";

export function CopiarCodigoBoleto({ pdfUrl }: { pdfUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [linha, setLinha] = useState("");
  const [mensagem, setMensagem] = useState("");
  async function copiar() {
    setBusy(true); setLinha(""); setMensagem("");
    try {
      const url = new URL(pdfUrl, window.location.origin);
      url.searchParams.set("codigo", "1");
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro || "Não foi possível ler o boleto.");
      setLinha(result.linha_digitavel);
      try {
        await navigator.clipboard.writeText(result.linha_digitavel);
        setMensagem("Código copiado. Confira beneficiário e valor no banco antes de pagar.");
      } catch { setMensagem("Selecione e copie o código abaixo."); }
    } catch (error) { setMensagem(error instanceof Error ? error.message : "Não foi possível ler o boleto."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col gap-1 text-[11px]">
    <button type="button" disabled={busy} onClick={copiar} className="font-semibold text-blue-700 hover:underline disabled:opacity-50">{busy ? "Conferindo PDF…" : "Copiar código de barras"}</button>
    {linha && <input aria-label="Linha digitável do boleto" readOnly value={linha} onFocus={(e) => e.currentTarget.select()} className="w-full min-w-64 rounded border p-1 font-mono" />}
    {mensagem && <span role="status" className="max-w-72 text-slate-600">{mensagem}</span>}
  </span>;
}
