"use client";

import { useState } from "react";
import { CheckCircle2, FileWarning, Loader2, Upload } from "lucide-react";
import { Label } from "@/components/ui/form-primitives";
import { Input } from "@/components/ui/form-primitives";
import { Button } from "@/components/ui/form-primitives";
import { formatTamanhoArquivo } from "@/lib/contratacoes-online/documentos-labels";
import type { DocumentoContratacaoPublico } from "@/lib/contratacoes-online/sanitize-public";
import { cn } from "@/lib/utils/cn";

const wizardLabelClass = "text-sm font-semibold text-white";

type Props = {
  label: string;
  tipo: string;
  obrigatorio?: boolean;
  enviado: DocumentoContratacaoPublico | null;
  onUpload: (tipo: string, file: File | null) => Promise<void>;
};

export function ContratacaoDocUploadField({
  label,
  tipo,
  obrigatorio,
  enviado,
  onUpload,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setErro(null);
    setBusy(true);
    try {
      await onUpload(tipo, file);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Label className={wizardLabelClass}>
          {label}
          {obrigatorio ? <span className="ml-1 text-amber-400">*</span> : null}
        </Label>
        {!enviado && !busy ? (
          <span className="text-xs font-medium text-slate-500">Aguardando envio</span>
        ) : null}
      </div>

      {enviado ? (
        <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-emerald-200">{label} enviado</p>
              <p className="mt-1 break-all text-emerald-100/90">Arquivo: {enviado.arquivo_nome ?? "—"}</p>
              <p className="text-emerald-200/80">
                Tamanho: {formatTamanhoArquivo(enviado.tamanho_bytes)}
              </p>
              <p className="text-emerald-300/90">Status: Enviado com sucesso</p>
            </div>
          </div>
        </div>
      ) : busy ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-amber-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando arquivo…
        </div>
      ) : null}

      {erro ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </div>
      ) : null}

      <div className="mt-3">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          className="text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-amber-500/90 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-950"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0] ?? null;
            await handleFile(file);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG ou WEBP — máx. 5 MB</p>
        {enviado ? (
          <Button
            type="button"
            variant="outlineGold"
            className="mt-2 h-9 border-slate-600 text-xs text-slate-200"
            disabled={busy}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*";
              input.onchange = () => {
                void handleFile(input.files?.[0] ?? null);
              };
              input.click();
            }}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Substituir arquivo
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function wizardFieldLabelClass() {
  return wizardLabelClass;
}

export function wizardSectionTitleClass() {
  return "text-lg font-bold text-white";
}

export function wizardCardHintClass() {
  return cn("text-sm text-slate-400");
}
