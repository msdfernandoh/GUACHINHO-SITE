"use client";

import { Copy, ExternalLink, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";
import { buildWhatsappPropostaMessage } from "@/lib/contratacoes-online/whatsapp-message";
import {
  buildPropostaVisualizacaoUrl,
  type VisualizacaoProposta,
} from "@/lib/contratacoes-online/proposta-visualizacao";

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
