"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { registrarEnvioExtrato, resumoMensagemExtrato } from "./actions";
import { CHAVE_MODELO_EXTRATO, MODELO_MENSAGEM_EXTRATO, montarMensagemExtrato } from "@/lib/erp/extrato-mensagem";

function modeloSalvo() {
  try { return localStorage.getItem(CHAVE_MODELO_EXTRATO) || MODELO_MENSAGEM_EXTRATO; } catch { return MODELO_MENSAGEM_EXTRATO; }
}

const botao = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50";

export function AcoesLinha({ clienteId, mes, enviadoInicial }: { clienteId: string; mes: string; enviadoInicial: boolean }) {
  const [estado, setEstado] = useState<"" | "copiando" | "copiado" | "erro">("");
  const [enviado, setEnviado] = useState(enviadoInicial);
  const [marcando, setMarcando] = useState(false);
  const pdf = `/api/erp/extrato-clientes/${clienteId}/pdf?historico=12&mes=${mes}`;

  async function copiar() {
    setEstado("copiando");
    const texto = resumoMensagemExtrato(clienteId, mes).then((d) => montarMensagemExtrato(modeloSalvo(), d));
    try {
      // ClipboardItem com promessa mantém o clique válido no Safari e no Chrome.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": texto.then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await texto);
      }
      setEstado("copiado");
      setTimeout(() => setEstado(""), 2500);
    } catch {
      setEstado("erro");
    }
  }

  async function marcar() {
    setMarcando(true);
    try { await registrarEnvioExtrato(clienteId, mes); setEnviado(true); } catch { /* mantém pendente */ } finally { setMarcando(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={copiar} disabled={estado === "copiando"} title="Copiar mensagem de WhatsApp"
        className={`${botao} ${estado === "copiado" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : estado === "erro" ? "border-red-300 text-red-700" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`}>
        {estado === "copiando" ? <Loader2 size={14} className="animate-spin" /> : estado === "copiado" ? <Check size={14} /> : <MessageCircle size={14} />}
        {estado === "copiado" ? "Copiada!" : estado === "erro" ? "Falhou, abra" : "Copiar mensagem"}
      </button>
      <a href={pdf + "&baixar=1"} title="Baixar PDF" className={`${botao} border-blue-200 text-blue-800 hover:bg-blue-50`}><Download size={14} />Baixar PDF</a>
      <Link href={`/erp/extrato-clientes/${clienteId}?mes=${mes}`} title="Abrir extrato" className={`${botao} border-slate-200 text-slate-700 hover:bg-slate-50`}><ExternalLink size={14} />Abrir</Link>
      <button onClick={marcar} disabled={enviado || marcando} title={enviado ? "Envio registrado" : "Marcar como enviado"}
        className={`${botao} ${enviado ? "border-emerald-600 bg-emerald-600 text-white disabled:opacity-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
        {marcando ? <Loader2 size={14} className="animate-spin" /> : enviado ? <Check size={14} /> : null}
        {enviado ? "Enviado" : "Marcar enviado"}
      </button>
    </div>
  );
}
