"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";
import { buildWhatsappLink, buildWhatsappPropostaMessage } from "@/lib/contratacoes-online/whatsapp-message";
import type { ContratacaoDocumentoRow, ContratacaoOnlineRow } from "@/lib/contratacoes-online/types";
import { ContratacaoDocumentosSection } from "./contratacao-documentos-section";

export function ContratacaoDetalheClient({
  contratacao,
  documentos,
  publicUrl,
  statusLabelText,
  podeAcessarDocumentos,
  mensagemSemPermissaoDocumentos,
}: {
  contratacao: ContratacaoOnlineRow;
  documentos: ContratacaoDocumentoRow[];
  publicUrl: string;
  statusLabelText: string;
  podeAcessarDocumentos: boolean;
  mensagemSemPermissaoDocumentos: string;
}) {
  const [copied, setCopied] = useState(false);
  const waMsg = buildWhatsappPropostaMessage(publicUrl);
  const waCliente = buildWhatsappLink(contratacao.telefone ?? "", waMsg);

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/contratacoes" className="text-sm text-amber-400 hover:underline">
            ← Contratações
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">{contratacao.protocolo}</h1>
          <p className="text-sm text-zinc-500">{statusLabelText}</p>
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 font-semibold text-zinc-200">Cliente</h2>
          <dl className="space-y-1 text-sm text-zinc-300">
            <div>Nome: {contratacao.nome ?? "—"}</div>
            <div>Telefone: {contratacao.telefone ?? "—"}</div>
            <div>E-mail: {contratacao.email ?? "—"}</div>
            <div>Tipo: {contratacao.tipo_pessoa?.toUpperCase() ?? "—"}</div>
            {contratacao.tipo_pessoa === "cpf" ? (
              <div>CPF: {contratacao.cpf ?? "—"}</div>
            ) : (
              <>
                <div>Razão social: {contratacao.razao_social ?? "—"}</div>
                <div>CNPJ: {contratacao.cnpj ?? "—"}</div>
                <div>Responsável: {contratacao.responsavel_nome ?? "—"}</div>
                <div>CPF resp.: {contratacao.responsavel_cpf ?? "—"}</div>
              </>
            )}
          </dl>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 font-semibold text-zinc-200">Proposta</h2>
          <dl className="space-y-1 text-sm text-zinc-300">
            <div>Origem: {contratacao.origem}</div>
            <div>Tipo bem: {contratacao.tipo_bem ?? "—"}</div>
            <div>
              Crédito:{" "}
              {contratacao.credito_selecionado != null
                ? formatCurrency(contratacao.credito_selecionado)
                : "—"}
            </div>
            <div>
              Parcela:{" "}
              {contratacao.parcela_estimada != null
                ? formatCurrency(contratacao.parcela_estimada)
                : "—"}
            </div>
            <div>Grupo: {contratacao.grupo_nome ?? "—"}</div>
            <div>Administradora: {contratacao.administradora ?? "—"}</div>
            <div>Gerado por: {contratacao.gerado_por_nome ?? "Cliente no site"}</div>
            <div>
              Link: <span className="break-all text-amber-400/90">{publicUrl}</span>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 font-semibold text-zinc-200">Pagamento</h2>
        <p className="text-sm text-zinc-300 capitalize">
          Forma: {contratacao.forma_pagamento ?? "—"}
        </p>
        {contratacao.forma_pagamento === "pix" ? (
          <p className="mt-2 text-sm text-zinc-400">
            Comprovante: {contratacao.pix_comprovante_url ? "Enviado" : "Não enviado"} (
            {contratacao.pix_status})
          </p>
        ) : null}
      </section>

      <ContratacaoDocumentosSection
        contratacaoId={contratacao.id}
        documentos={documentos}
        podeAcessarDocumentos={podeAcessarDocumentos}
        mensagemSemPermissao={mensagemSemPermissaoDocumentos}
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-2 font-semibold text-zinc-200">Dados simulados (JSON)</h2>
        <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400">
          {JSON.stringify(contratacao.dados_simulacao, null, 2)}
        </pre>
      </section>
    </div>
  );
}
