"use client";

import { useMemo, useState } from "react";
import { Check, Download, Gift, MessageCircle, Share2, X } from "lucide-react";
import { mensagemContemplacao, parcelaDaContemplacao, type AvisoContemplacao } from "@/lib/erp/contemplado-mensagem";

type Cota = { cliente: string; grupo: string; cota: string; contratacao: string | null; credito: number | null; contemplacao: string; modalidade: string | null };

function moeda(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 13);
  return d ? (Number(d) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}
const numero = (v: string) => { const d = v.replace(/\D/g, ""); return d ? Number(d) / 100 : null; };

export function AvisoContemplado({ cota }: { cota: Cota }) {
  const [aberto, setAberto] = useState(false);
  const [liquido, setLiquido] = useState("");
  const [parcela, setParcela] = useState(String(parcelaDaContemplacao(cota.contratacao, cota.contemplacao) ?? ""));
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState("");

  const dados: AvisoContemplacao = useMemo(() => ({
    cliente: cota.cliente, grupo: cota.grupo, cota: cota.cota, credito: cota.credito, liquido: numero(liquido),
    parcela: Number(parcela) > 0 ? Number(parcela) : null, modalidade: cota.modalidade, data: cota.contemplacao,
  }), [cota, liquido, parcela]);
  const mensagem = mensagemContemplacao(dados);
  const arte = "/api/erp/contemplados/arte?" + new URLSearchParams({
    cliente: cota.cliente, grupo: cota.grupo, cota: cota.cota, data: cota.contemplacao.slice(0, 10),
    ...(cota.credito ? { credito: String(cota.credito) } : {}), ...(dados.liquido ? { liquido: String(dados.liquido) } : {}),
    ...(dados.parcela ? { parcela: String(dados.parcela) } : {}), ...(cota.modalidade ? { modalidade: cota.modalidade } : {}),
  });
  const arquivo = `parabens-${cota.cliente.split(" ")[0].toLowerCase()}-${cota.grupo}-${cota.cota}.png`.replace(/[^a-z0-9.-]/gi, "-");

  async function copiar() {
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { setAviso("Não foi possível copiar. Selecione o texto e copie."); }
  }
  async function compartilhar() {
    setAviso("");
    try {
      const blob = await (await fetch(arte)).blob();
      const file = new File([blob], arquivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: mensagem }); return; }
      setAviso("Este navegador não compartilha arquivos. Use Baixar imagem e Copiar mensagem.");
    } catch (e) { if ((e as Error).name !== "AbortError") setAviso("Não foi possível compartilhar agora."); }
  }

  const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold";
  return (
    <>
      <button onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">
        <Gift size={14} />Parabenizar
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label={`Aviso de contemplação de ${cota.cliente}`}>
          <div className="grid max-h-[95vh] w-full max-w-4xl gap-5 overflow-y-auto rounded-2xl bg-white p-5 md:grid-cols-[300px_1fr]">
            <div className="flex flex-col items-center gap-2">
              <img src={arte} alt="Arte de parabéns" className="aspect-[9/16] w-full rounded-xl bg-slate-900 object-cover shadow-lg" />
              <p className="text-xs text-slate-500">Imagem 9:16 (1080 × 1920)</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Aviso de contemplação</p>
                  <h3 className="text-xl font-black">{cota.cliente}</h3>
                  <p className="text-sm text-slate-500">Grupo {cota.grupo} · Cota {cota.cota}</p>
                </div>
                <button onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">Crédito líquido (opcional)
                  <input inputMode="numeric" value={liquido} onChange={(e) => setLiquido(moeda(e.target.value))} placeholder="R$ 0,00" className="mt-1 w-full rounded-lg border px-3 py-2" />
                </label>
                <label className="text-sm font-semibold">Parcela da contemplação
                  <input inputMode="numeric" value={parcela} onChange={(e) => setParcela(e.target.value.replace(/\D/g, "").slice(0, 3))} className="mt-1 w-full rounded-lg border px-3 py-2" />
                  <span className="text-xs font-normal text-slate-500">Calculada pelos meses desde a contratação. Ajuste se precisar.</span>
                </label>
              </div>
              <textarea readOnly value={mensagem} rows={13} className="w-full rounded-lg border bg-slate-50 p-3 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button onClick={copiar} className={`${btn} ${copiado ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}>{copiado ? <Check size={16} /> : <MessageCircle size={16} />}{copiado ? "Mensagem copiada!" : "Copiar mensagem WhatsApp"}</button>
                <a href={arte} download={arquivo} className={`${btn} bg-blue-800 text-white hover:bg-blue-900`}><Download size={16} />Baixar imagem</a>
                <button onClick={compartilhar} className={`${btn} border border-slate-300 hover:bg-slate-50`}><Share2 size={16} />Compartilhar (celular)</button>
              </div>
              {aviso && <p className="text-sm text-red-700">{aviso}</p>}
              <p className="text-xs text-slate-500">No celular, “Compartilhar” abre o WhatsApp já com a imagem e a mensagem.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
