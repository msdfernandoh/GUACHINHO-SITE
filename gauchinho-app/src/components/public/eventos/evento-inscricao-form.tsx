"use client";

import { useState } from "react";
import type { InscricaoEventoPayload } from "@/lib/comercial-eventos/types";
import { Button, Input, Label, Textarea, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { formatWhatsappBrInput, digitsOnlyPhone } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Props = {
  slug: string;
  permitirAcompanhante: boolean;
  exigirConvidou: boolean;
  className?: string;
};

export function EventoInscricaoForm({ slug, permitirAcompanhante, exigirConvidou, className }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [temAcompanhante, setTemAcompanhante] = useState(false);
  const [nomeAcompanhante, setNomeAcompanhante] = useState("");
  const [telefoneAcompanhante, setTelefoneAcompanhante] = useState("");
  const [nomeConvidou, setNomeConvidou] = useState("");
  const [empresaConvidou, setEmpresaConvidou] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setSucesso(null);
    try {
      const payload: InscricaoEventoPayload & { slug: string } = {
        slug,
        nomeParticipante: nome,
        telefoneParticipante: digitsOnlyPhone(telefone) || telefone,
        temAcompanhante: permitirAcompanhante && temAcompanhante,
        nomeAcompanhante: temAcompanhante ? nomeAcompanhante : undefined,
        telefoneAcompanhante: temAcompanhante ? telefoneAcompanhante : undefined,
        nomeConvidou: nomeConvidou || undefined,
        empresaConvidou: empresaConvidou || undefined,
        observacao: observacao || undefined,
      };
      const res = await fetch("/api/public/eventos/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na inscrição");
      setSucesso(data.mensagem ?? "Inscrição registrada.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8", className)}
    >
      <h2 className="text-xl font-bold text-white">Inscrição</h2>
      <p className="mt-1 text-sm text-zinc-400">Preencha seus dados para participar.</p>

      <div className="mt-6 space-y-4">
        <div>
          <Label>Nome do participante *</Label>
          <Input className={surfaceInputDarkSlate} value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div>
          <Label>Telefone / WhatsApp *</Label>
          <Input
            className={surfaceInputDarkSlate}
            value={telefone}
            onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
            required
          />
        </div>

        {permitirAcompanhante ? (
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={temAcompanhante} onChange={(e) => setTemAcompanhante(e.target.checked)} />
              Levar acompanhante
            </label>
            {temAcompanhante ? (
              <>
                <div>
                  <Label>Nome do acompanhante *</Label>
                  <Input
                    className={surfaceInputDarkSlate}
                    value={nomeAcompanhante}
                    onChange={(e) => setNomeAcompanhante(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Telefone do acompanhante (opcional)</Label>
                  <Input
                    className={surfaceInputDarkSlate}
                    value={telefoneAcompanhante}
                    onChange={(e) => setTelefoneAcompanhante(formatWhatsappBrInput(e.target.value))}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        <div>
          <Label>Quem convidou você?{exigirConvidou ? " *" : ""}</Label>
          <Input
            className={surfaceInputDarkSlate}
            value={nomeConvidou}
            onChange={(e) => setNomeConvidou(e.target.value)}
            required={exigirConvidou}
          />
        </div>
        <div>
          <Label>Empresa de quem convidou</Label>
          <Input className={surfaceInputDarkSlate} value={empresaConvidou} onChange={(e) => setEmpresaConvidou(e.target.value)} />
        </div>
        <div>
          <Label>Observação</Label>
          <Textarea className={surfaceInputDarkSlate} rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
      </div>

      {erro ? <p className="mt-4 text-sm text-red-400">{erro}</p> : null}
      {sucesso ? <p className="mt-4 text-sm text-emerald-400">{sucesso}</p> : null}

      <Button type="submit" variant="gold" className="mt-6 min-h-12 w-full" disabled={loading}>
        {loading ? "Enviando…" : "Confirmar inscrição"}
      </Button>
    </form>
  );
}
