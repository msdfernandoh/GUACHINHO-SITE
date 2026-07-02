"use client";

import type { AcaoCaptura } from "./simulador-types";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";

const TITULOS: Record<AcaoCaptura, string> = {
  analise: "Ver análise completa",
  proposta: "Gerar proposta",
  especialista: "Falar com especialista",
};

type Props = {
  open: boolean;
  acao: AcaoCaptura;
  nome: string;
  whatsapp: string;
  cidade: string;
  email: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onNome: (v: string) => void;
  onWhatsapp: (v: string) => void;
  onCidade: (v: string) => void;
  onEmail: (v: string) => void;
};

export function LeadCaptureModal({
  open,
  acao,
  nome,
  whatsapp,
  cidade,
  email,
  loading,
  onClose,
  onSubmit,
  onNome,
  onWhatsapp,
  onCidade,
  onEmail,
}: Props) {
  useLockBodyScroll(open);

  if (!open) return null;

  const cancelClass =
    "border-zinc-500 bg-zinc-900 text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800 hover:text-zinc-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold text-white">{TITULOS[acao]}</h2>
        <p className="text-sm text-slate-400">Informe seus dados para continuar com segurança.</p>
        <div>
          <Label className="text-slate-200">Nome</Label>
          <Input required value={nome} onChange={(e) => onNome(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
        </div>
        <div>
          <Label className="text-slate-200">WhatsApp</Label>
          <Input
            required
            inputMode="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => onWhatsapp(formatWhatsappBrInput(e.target.value))}
            className={cn("mt-1", surfaceInputDarkSlate)}
            placeholder="(51) 99999-9999"
          />
        </div>
        <div>
          <Label className="text-slate-200">Cidade (opcional)</Label>
          <Input value={cidade} onChange={(e) => onCidade(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
        </div>
        <div>
          <Label className="text-slate-200">E-mail (opcional)</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            className={cn("mt-1", surfaceInputDarkSlate)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="gold" disabled={loading || digitsOnlyPhone(whatsapp).length < 10} className="min-h-12 flex-1 text-base">
            {loading ? "Enviando…" : "Continuar"}
          </Button>
          <Button type="button" variant="outlineGold" className={`min-h-12 ${cancelClass}`} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
