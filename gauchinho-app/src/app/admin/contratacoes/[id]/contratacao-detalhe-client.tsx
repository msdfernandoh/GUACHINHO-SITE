"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency, formatWhatsappBrInput } from "@/lib/utils/format";
import { formatCpfBrInput, formatCnpjBrInput } from "@/lib/utils/format";
import { buildWhatsappLink, buildWhatsappPropostaMessage } from "@/lib/contratacoes-online/whatsapp-message";
import type { ContratacaoDocumentoRow, ContratacaoOnlineRow } from "@/lib/contratacoes-online/types";
import { ContratacaoDocumentosSection } from "./contratacao-documentos-section";
import {
  adminDdClass,
  adminDtClass,
  adminSectionClass,
  adminSectionTitleClass,
} from "@/components/admin/admin-contrast";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className={adminDtClass}>{label}</dt>
      <dd className={adminDdClass}>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function money(v: number | null | undefined) {
  return v != null && Number.isFinite(v) ? formatCurrency(v) : "—";
}

export function ContratacaoDetalheClient({
  contratacao,
  documentos,
  publicUrl,
  statusLabelText,
  resumoFinanceiro,
  podeAcessarDocumentos,
  mensagemSemPermissaoDocumentos,
}: {
  contratacao: ContratacaoOnlineRow;
  documentos: ContratacaoDocumentoRow[];
  publicUrl: string;
  statusLabelText: string;
  resumoFinanceiro: Record<string, number | string | null>;
  podeAcessarDocumentos: boolean;
  mensagemSemPermissaoDocumentos: string;
}) {
  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const waMsg = buildWhatsappPropostaMessage(publicUrl);
  const waCliente = buildWhatsappLink(contratacao.telefone ?? "", waMsg);
  const fin = resumoFinanceiro;

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(contratacao.dados_simulacao, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  }

  const telFmt = contratacao.telefone ? formatWhatsappBrInput(contratacao.telefone) : null;
  const cpfFmt = contratacao.cpf ? formatCpfBrInput(contratacao.cpf) : null;
  const cnpjFmt = contratacao.cnpj ? formatCnpjBrInput(contratacao.cnpj) : null;
  const respCpfFmt = contratacao.responsavel_cpf
    ? formatCpfBrInput(contratacao.responsavel_cpf)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/contratacoes" className="text-sm font-medium text-amber-400 hover:underline">
            ← Contratações
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{contratacao.protocolo}</h1>
          <p className="text-sm font-medium text-zinc-400">{statusLabelText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copyLink}>
            {copied ? "Link copiado" : "Copiar link"}
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer">
            <Button type="button" variant="outline">
              Enviar WhatsApp (link)
            </Button>
          </a>
          {waCliente ? (
            <a href={waCliente} target="_blank" rel="noreferrer">
              <Button type="button">WhatsApp do cliente</Button>
            </a>
          ) : null}
          {contratacao.email ? (
            <a href={`mailto:${contratacao.email}`}>
              <Button type="button" variant="outline">
                E-mail do cliente
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={adminSectionClass}>
          <h2 className={adminSectionTitleClass}>Cliente</h2>
          <dl className="space-y-3">
            <Field label="Nome" value={contratacao.nome} />
            <Field label="Telefone" value={telFmt} />
            <Field label="E-mail" value={contratacao.email} />
            <Field label="Tipo pessoa" value={contratacao.tipo_pessoa?.toUpperCase()} />
            {contratacao.tipo_pessoa === "cpf" ? (
              <Field label="CPF" value={cpfFmt} />
            ) : (
              <>
                <Field label="Razão social" value={contratacao.razao_social} />
                <Field label="CNPJ" value={cnpjFmt} />
                <Field label="Responsável" value={contratacao.responsavel_nome} />
                <Field label="CPF responsável" value={respCpfFmt} />
              </>
            )}
          </dl>
        </div>
        <div className={adminSectionClass}>
          <h2 className={adminSectionTitleClass}>Proposta</h2>
          <dl className="space-y-3">
            <Field label="Origem" value={contratacao.origem} />
            <Field label="Tipo do bem" value={contratacao.tipo_bem} />
            <Field label="Crédito" value={money(contratacao.credito_selecionado)} />
            <Field label="Parcela inicial" value={money(contratacao.parcela_estimada)} />
            <Field label="Parcela integral" value={money(fin.parcelaIntegral as number)} />
            <Field label="Parcela reduzida" value={money(fin.parcelaReduzida as number)} />
            <Field
              label="Parcela após contemplação"
              value={money(fin.parcelaPosContemplacao as number)}
            />
            <Field label="Grupo" value={contratacao.grupo_nome} />
            <Field label="Administradora" value={contratacao.administradora} />
            <Field label="Gerado por" value={contratacao.gerado_por_nome ?? "Cliente no site"} />
            <div className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-3">
              <dt className={adminDtClass}>Link público</dt>
              <dd className="break-all text-sm font-semibold text-amber-300">{publicUrl}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={adminSectionClass}>
        <h2 className={adminSectionTitleClass}>Pagamento</h2>
        <dl className="space-y-3">
          <Field label="Forma" value={contratacao.forma_pagamento ?? "—"} />
          {contratacao.forma_pagamento === "pix" ? (
            <Field
              label="Comprovante Pix"
              value={
                contratacao.pix_comprovante_url ? `Enviado (${contratacao.pix_status})` : "Não enviado"
              }
            />
          ) : null}
        </dl>
      </section>

      <ContratacaoDocumentosSection
        contratacaoId={contratacao.id}
        documentos={documentos}
        podeAcessarDocumentos={podeAcessarDocumentos}
        mensagemSemPermissao={mensagemSemPermissaoDocumentos}
      />

      <section className={adminSectionClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className={adminSectionTitleClass}>Dados simulados (JSON)</h2>
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={copyJson}>
            {jsonCopied ? "Copiado" : "Copiar JSON"}
          </Button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
          {JSON.stringify(contratacao.dados_simulacao, null, 2)}
        </pre>
      </section>
    </div>
  );
}
