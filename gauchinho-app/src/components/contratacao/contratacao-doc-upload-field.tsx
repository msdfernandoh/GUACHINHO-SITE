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
  hint?: string;
  /** Todos os arquivos já enviados deste tipo (frente, verso, etc.). */
  enviados: DocumentoContratacaoPublico[];
  onUpload: (tipo: string, file: File | null) => Promise<void>;
};

export function ContratacaoDocUploadField({
  label,
  tipo,
  obrigatorio,
  hint,
  enviados,
  onUpload,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const temArquivos = enviados.length > 0;

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

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*";
    input.onchange = () => {
      void handleFile(input.files?.[0] ?? null);
    };
    input.click();
  }

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className={wizardLabelClass}>
            {label}
            {obrigatorio ? <span className="ml-1 text-amber-400">*</span> : null}
          </Label>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {!temArquivos && !busy ? (
          <span className="text-xs font-medium text-slate-500">Aguardando envio</span>
        ) : temArquivos ? (
          <span className="text-xs font-medium text-emerald-400">
            {enviados.length} arquivo{enviados.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {temArquivos ? (
        <ul className="mt-3 space-y-2">
          {enviados.map((doc, idx) => (
            <li
              key={doc.id}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-200">
                    Arquivo {idx + 1}
                    {enviados.length > 1 && idx === 0 ? " (ex.: frente)" : null}
                    {enviados.length > 1 && idx === 1 ? " (ex.: verso)" : null}
                  </p>
                  <p className="mt-1 break-all text-emerald-100/90">
                    {doc.arquivo_nome ?? "—"}
                  </p>
                  <p className="text-emerald-200/80">
                    Tamanho: {formatTamanhoArquivo(doc.tamanho_bytes)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? (
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
        {!temArquivos ? (
          <>
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
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outlineGold"
              className="mt-1 h-9 border-slate-600 text-xs text-slate-200"
              disabled={busy}
              onClick={openFilePicker}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Adicionar outro arquivo
            </Button>
            <p className="mt-1 text-xs text-slate-500">
              Use para frente e verso ou outro arquivo do mesmo documento. PDF, JPG, PNG ou WEBP —
              máx. 5 MB cada.
            </p>
          </>
        )}
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
