"use client";

import { useState } from "react";
import {
  generatePropostaPdfAction,
  getPropostaDownloadUrlAction,
} from "@/app/admin/propostas/actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PARCEIROS_SUGERIDOS } from "@/lib/proposta/pdf/types";
import { registrarEventoClient } from "@/lib/eventos/registrar-client";

type Props = {
  propostaId: string;
  pdfUrl: string | null;
  defaults: {
    consultor_nome?: string | null;
    consultor_telefone?: string | null;
    consultor_email?: string | null;
    parceiro_nome?: string | null;
    validade_dias?: number | null;
    validade_data?: string | null;
    nome_cliente?: string | null;
  };
};

export function PropostaPdfToolbar({ propostaId, pdfUrl, defaults }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("proposta_id", propostaId);
      const res = await generatePropostaPdfAction(fd);
      setDownloadUrl(res.signedUrl);
      setMsg("PDF gerado com sucesso.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const url = await getPropostaDownloadUrlAction(propostaId);
      window.open(url, "_blank");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao baixar");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    try {
      const url = downloadUrl ?? (await getPropostaDownloadUrlAction(propostaId));
      await navigator.clipboard.writeText(url);
      setMsg("Link copiado.");
      await registrarEventoClient({
        tipo_evento: "proposta_link_copiado",
        entidade_tipo: "proposta",
        entidade_id: propostaId,
      });
    } catch {
      setMsg("Não foi possível copiar o link.");
    }
  }

  function whatsAppLink() {
    const tel = defaults.consultor_telefone?.replace(/\D/g, "");
    if (!tel) return null;
    const nome = defaults.nome_cliente ?? "Cliente";
    const text = encodeURIComponent(
      `Olá, gerei uma proposta no site Gauchinho Escritório de Soluções Financeiras. Meu nome é ${nome} e gostaria de falar com um especialista. Proposta: ${propostaId}`,
    );
    return `https://wa.me/${tel}?text=${text}`;
  }

  const wa = whatsAppLink();

  return (
    <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="font-semibold">PDF premium</h2>
      {pdfUrl ? (
        <p className="text-sm text-zinc-500">Arquivo: {pdfUrl}</p>
      ) : (
        <p className="text-sm text-zinc-500">Nenhum PDF gerado ainda.</p>
      )}
      <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="proposta_id" value={propostaId} />
        <div>
          <Label>Parceiro</Label>
          <Select name="parceiro_nome" defaultValue={defaults.parceiro_nome ?? ""}>
            <option value="">—</option>
            {PARCEIROS_SUGERIDOS.map((p) => (
              <option key={p} value={p === "Outro" ? "" : p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Validade (dias)</Label>
          <Input name="validade_dias" type="number" defaultValue={String(defaults.validade_dias ?? 7)} />
        </div>
        <div>
          <Label>Validade manual</Label>
          <Input name="validade_data" type="date" defaultValue={defaults.validade_data ?? ""} />
        </div>
        <div>
          <Label>Consultor</Label>
          <Input name="consultor_nome" defaultValue={defaults.consultor_nome ?? ""} />
        </div>
        <div>
          <Label>WhatsApp consultor</Label>
          <Input name="consultor_telefone" defaultValue={defaults.consultor_telefone ?? ""} />
        </div>
        <div>
          <Label>E-mail consultor</Label>
          <Input name="consultor_email" defaultValue={defaults.consultor_email ?? ""} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" variant="gold" disabled={loading}>
            {loading ? "Gerando…" : "Gerar PDF"}
          </Button>
          {pdfUrl || downloadUrl ? (
            <>
              <Button type="button" variant="outline" onClick={handleDownload} disabled={loading}>
                Baixar PDF
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyLink}>
                Copiar link
              </Button>
            </>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-700"
              onClick={() =>
                registrarEventoClient({
                  tipo_evento: "proposta_enviada_whatsapp",
                  entidade_tipo: "proposta",
                  entidade_id: propostaId,
                })
              }
            >
              Falar com especialista
            </a>
          ) : null}
        </div>
      </form>
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}
    </div>
  );
}
