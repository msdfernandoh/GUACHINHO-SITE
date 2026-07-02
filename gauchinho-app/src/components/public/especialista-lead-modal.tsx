"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, Textarea, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";

type WhatsappOrigem = {
  exibir_botao_apos_lead?: boolean;
  whatsapp_destino?: string;
  mensagem_padrao?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function EspecialistaLeadModal({ open, onClose }: Props) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoCredito, setTipoCredito] = useState("");
  const [valorCredito, setValorCredito] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setNome("");
    setWhatsapp("");
    setTipoCredito("");
    setValorCredito("");
    setObservacao("");
    setErro(null);
    setSucesso(false);
    setWaLink(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/public/leads/especialista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          tipoCredito: tipoCredito || undefined,
          valorCredito: valorCredito || undefined,
          observacao: observacao || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setSucesso(true);
      const wa = data.whatsappOrigem as WhatsappOrigem | null;
      if (wa?.exibir_botao_apos_lead && wa?.whatsapp_destino) {
        const text = encodeURIComponent(
          wa.mensagem_padrao ?? "Olá! Acabei de me cadastrar como especialista no site Gauchinho.",
        );
        setWaLink(`https://wa.me/${wa.whatsapp_destino.replace(/\D/g, "")}?text=${text}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl">
        {sucesso ? (
          <>
            <h2 className="text-xl font-bold text-white">Cadastro recebido</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Cadastro recebido. Um especialista do Gauchinho vai te chamar para uma análise personalizada.
            </p>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
              >
                Abrir WhatsApp
              </a>
            ) : null}
            <Button type="button" variant="outline" className="w-full min-h-11" onClick={handleClose}>
              Fechar
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-bold text-white">Falar com especialista</h2>
            <p className="text-sm text-slate-400">Conte seu objetivo — retornamos pelo WhatsApp.</p>
            <div>
              <Label className="text-slate-200">Nome *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={cn("mt-1", surfaceInputDarkSlate)}
              />
            </div>
            <div>
              <Label className="text-slate-200">Telefone / WhatsApp *</Label>
              <Input
                required
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsappBrInput(e.target.value))}
                className={cn("mt-1", surfaceInputDarkSlate)}
                placeholder="(51) 99999-9999"
              />
            </div>
            <div>
              <Label className="text-slate-200">Tipo de crédito</Label>
              <select
                value={tipoCredito}
                onChange={(e) => setTipoCredito(e.target.value)}
                className={cn("mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white", surfaceInputDarkSlate)}
              >
                <option value="">Selecione…</option>
                {TIPOS_CREDITO_PUBLICO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-200">Valor do crédito</Label>
              <Input
                inputMode="decimal"
                value={valorCredito}
                onChange={(e) => setValorCredito(e.target.value)}
                className={cn("mt-1", surfaceInputDarkSlate)}
                placeholder="Ex.: 500000"
              />
            </div>
            <div>
              <Label className="text-slate-200">Observação</Label>
              <Textarea
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className={cn("mt-1", surfaceInputDarkSlate)}
              />
            </div>
            {erro ? <p className="text-sm text-red-400">{erro}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                variant="gold"
                disabled={loading || digitsOnlyPhone(whatsapp).length < 10}
                className="min-h-12 flex-1"
              >
                {loading ? "Enviando…" : "Enviar cadastro"}
              </Button>
              <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
