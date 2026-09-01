"use client";

import { Copy, ExternalLink, Image, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";
import { buildWhatsappPropostaMessage } from "@/lib/contratacoes-online/whatsapp-message";
import {
  buildPropostaVisualizacaoUrl,
  type VisualizacaoProposta,
} from "@/lib/contratacoes-online/proposta-visualizacao";
import {
  extrairTokenProposta,
  montarLinhasImagemProposta,
  type PropostaImagemPayload,
} from "@/lib/contratacoes-online/proposta-imagem";

type Props = {
  open: boolean;
  onClose: () => void;
  protocolo: string;
  url: string;
  credito?: number | null;
  parcela?: number | null;
  tipoBem?: string | null;
  whatsappDestino?: string;
};

export function PropostaLinkModal({
  open,
  onClose,
  protocolo,
  url,
  credito,
  parcela,
  tipoBem,
  whatsappDestino,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [imageStatus, setImageStatus] = useState<"idle" | "copied" | "error">("idle");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoProposta>("completa");
  if (!open) return null;

  const publicUrl = buildPropostaVisualizacaoUrl(url, visualizacao);
  const msg = buildWhatsappPropostaMessage(publicUrl);
  const waPhone = whatsappDestino?.replace(/\D/g, "") ?? "";
  const waHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyProposalImage() {
    try {
      setImageStatus("idle");
      const token = extrairTokenProposta(publicUrl);
      if (!token) throw new Error("Token da proposta não identificado");
      const response = await fetch(`/api/public/contratacoes/${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error("Não foi possível carregar a proposta");
      const payload = await response.json() as PropostaImagemPayload;
      const linhas = montarLinhasImagemProposta(payload, visualizacao);
      if (!linhas.length) throw new Error("Proposta sem dados para imagem");

      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = Math.max(1350, 365 + linhas.length * 94 + 150);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      const gradient = context.createLinearGradient(0, 0, 1080, canvas.height);
      gradient.addColorStop(0, "#020617");
      gradient.addColorStop(1, "#172554");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fbbf24";
      context.fillRect(80, 82, 110, 8);
      context.font = "700 30px Arial";
      context.fillText("PROPOSTA DE CONSÓRCIO", 80, 145);
      context.fillStyle = "#ffffff";
      context.font = "800 52px Arial";
      context.fillText(payload.contratacao.tipo_bem || tipoBem || "Plano personalizado", 80, 220, 920);
      context.fillStyle = "#cbd5e1";
      context.font = "700 24px Arial";
      context.fillText(`${visualizacao === "resumida" ? "VERSÃO RESUMIDA" : "VERSÃO DETALHADA"} · PROTOCOLO ${payload.contratacao.protocolo || protocolo}`, 80, 270);

      let secaoAtual = "";
      let y = 350;
      linhas.forEach((linha) => {
        if (linha.secao !== secaoAtual) {
          secaoAtual = linha.secao;
          context.fillStyle = "#fbbf24";
          context.font = "800 22px Arial";
          context.fillText(secaoAtual, 80, y);
          y += 34;
        }
        context.fillStyle = "#94a3b8";
        context.font = "700 22px Arial";
        context.fillText(linha.label, 80, y);
        context.fillStyle = "#ffffff";
        context.font = "800 34px Arial";
        context.fillText(linha.value, 390, y, 610);
        context.strokeStyle = "rgba(148,163,184,.22)";
        context.beginPath();
        context.moveTo(80, y + 26);
        context.lineTo(1000, y + 26);
        context.stroke();
        y += 72;
      });
      context.fillStyle = "#67e8f9";
      context.font = "700 27px Arial";
      context.fillText("Gauchinho Consórcios", 80, canvas.height - 70);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Clipboard indisponível");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setImageStatus("copied");
      setTimeout(() => setImageStatus("idle"), 2500);
    } catch {
      setImageStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-lg space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100">
        <button
          type="button"
          className="absolute right-4 top-4 text-zinc-400 hover:text-white"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-white">Link da proposta gerado</h2>
        <dl className="space-y-1 text-sm text-zinc-300">
          <div>
            <dt className="text-zinc-500">Protocolo</dt>
            <dd className="font-medium text-amber-400">{protocolo}</dd>
          </div>
          {credito != null ? (
            <div>
              <dt className="text-zinc-500">Crédito</dt>
              <dd>{formatCurrency(credito)}</dd>
            </div>
          ) : null}
          {parcela != null ? (
            <div>
              <dt className="text-zinc-500">Parcela</dt>
              <dd>{formatCurrency(parcela)}</dd>
            </div>
          ) : null}
          {tipoBem ? (
            <div>
              <dt className="text-zinc-500">Tipo do bem</dt>
              <dd>{tipoBem}</dd>
            </div>
          ) : null}
        </dl>
        <div>
          <p className="mb-2 block text-xs text-zinc-500">Formato do link</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                visualizacao === "resumida"
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
              onClick={() => {
                setVisualizacao("resumida");
                setCopied(false);
              }}
            >
              Link resumido
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                visualizacao === "completa"
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
              onClick={() => {
                setVisualizacao("completa");
                setCopied(false);
              }}
            >
              Link detalhado
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Link público</label>
          <input
            readOnly
            value={publicUrl}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="gold" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button type="button" variant="outlineGold" onClick={() => void copyProposalImage()} className="border-zinc-600 bg-zinc-900">
            <Image className="mr-2 h-4 w-4" />
            {imageStatus === "copied" ? "Imagem copiada!" : imageStatus === "error" ? "Não foi possível copiar" : "Copiar imagem"}
          </Button>
          <a href={waHref} target="_blank" rel="noreferrer">
            <Button type="button" variant="outlineGold" className="border-zinc-600 bg-zinc-900">
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar pelo WhatsApp
            </Button>
          </a>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="outlineGold" className="border-zinc-600 bg-zinc-900">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir proposta
            </Button>
          </a>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
