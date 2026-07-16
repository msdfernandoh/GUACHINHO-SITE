"use client";

import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import {
  buildFichaAdministradoraCampos,
  formatFichaAdministradoraText,
  type FichaCampo,
} from "@/lib/contratacoes-online/ficha-administradora";
import type { ContratacaoOnlineRow } from "@/lib/contratacoes-online/types";
import type { LinhaGrupoPropostaResumo } from "@/lib/contratacoes-online/extract-fields";
import {
  adminSectionClass,
  adminSectionTitleClass,
  adminDtClass,
  adminDdClass,
} from "@/components/admin/admin-contrast";

function CopyableRow({ label, value }: FichaCampo) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(140px,180px)_1fr_auto] sm:items-center sm:gap-2">
      <dt className={adminDtClass}>{label}</dt>
      <dd className={`${adminDdClass} break-all font-mono text-sm`}>{value}</dd>
      <Button type="button" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={() => void copy()}>
        <Copy className="mr-1 h-3.5 w-3.5" />
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function ContratacaoCopyPanel({
  contratacao,
  resumoFinanceiro,
  gruposLinhas,
}: {
  contratacao: ContratacaoOnlineRow;
  resumoFinanceiro: Record<string, number | string | null>;
  gruposLinhas: LinhaGrupoPropostaResumo[];
}) {
  const campos = useMemo(
    () =>
      buildFichaAdministradoraCampos({
        contratacao,
        resumoFinanceiro,
        gruposLinhas,
      }),
    [contratacao, resumoFinanceiro, gruposLinhas],
  );
  const [allCopied, setAllCopied] = useState(false);

  async function copyAll() {
    await navigator.clipboard.writeText(formatFichaAdministradoraText(campos));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  function downloadTxt() {
    const blob = new Blob([formatFichaAdministradoraText(campos)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ficha-administradora-${contratacao.protocolo.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={adminSectionClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Cadastro na administradora</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 text-xs" onClick={() => void copyAll()}>
            <Copy className="mr-1 h-4 w-4" />
            {allCopied ? "Tudo copiado" : "Copiar tudo"}
          </Button>
          <Button type="button" variant="gold" className="h-9 text-xs" onClick={downloadTxt}>
            <Download className="mr-1 h-4 w-4" />
            Baixar ficha (.txt)
          </Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        Copie campo a campo ou baixe a ficha com cliente, proposta e grupos (número, cotas e meses
        decorridos) para colar no sistema da administradora.
      </p>
      <dl className="space-y-3">
        {campos.map((c) => (
          <CopyableRow key={c.label} label={c.label} value={c.value} />
        ))}
      </dl>
    </section>
  );
}
