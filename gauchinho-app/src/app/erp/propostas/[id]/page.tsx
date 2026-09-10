import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { fetchProposta } from "@/app/admin/propostas/actions";
import { PropostaForm } from "@/components/admin/proposta-form";
import { PropostaPdfToolbar } from "@/components/admin/proposta-pdf-toolbar";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { MarcarPropostaContratadaButton } from "@/components/admin/marcar-proposta-contratada-button";

export default async function ErpPropostaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireErpRouteAccess("propostas");
  const { id } = await params;

  let proposta;
  try {
    proposta = await fetchProposta(id);
  } catch {
    notFound();
  }

  const p = proposta as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <Link
          href="/erp/propostas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Voltar a Propostas
        </Link>
      </div>

      <header className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              Comercial · ERP · Detalhes da Proposta
            </p>
            <h1 className="mt-1 text-2xl font-black">
              {String(p.nome_cliente ?? "Proposta")}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              {String(p.tipo_proposta ?? "Consórcio")} · {String(p.status ?? "")} · Criada em {formatDate(String(p.created_at))}
            </p>
          </div>
          {p.lead_id ? (
            <Link
              href={`/erp/leads`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
            >
              Ver lead no CRM
            </Link>
          ) : null}
        </div>
      </header>

      {/* Banner de Ação Rápida: Marcar Contratada */}
      <MarcarPropostaContratadaButton
        propostaId={id}
        contratacaoId={p.contratacao_id as string | undefined}
        contratacaoProtocolo={p.contratacao_protocolo as string | undefined}
        isContratada={p.status === "Contratada" || Boolean(p.contratacao_id)}
        origem="erp"
        variant="banner-btn"
      />

      {/* Barra de Ações do PDF */}
      <PropostaPdfToolbar
        propostaId={id}
        pdfUrl={(p.pdf_url as string) ?? null}
        defaults={{
          consultor_nome: p.consultor_nome as string,
          consultor_telefone: p.consultor_telefone as string,
          consultor_email: p.consultor_email as string,
          parceiro_nome: p.parceiro_nome as string,
          validade_dias: p.validade_dias as number,
          validade_data: p.validade_data as string,
          nome_cliente: p.nome_cliente as string,
        }}
      />

      {/* Resumo Financeiro */}
      <div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Crédito Simulado</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatCurrency(Number(p.valor_credito))}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Parcela Estimada</p>
          <p className="mt-1 text-xl font-bold text-blue-700">
            {formatCurrency(Number(p.valor_parcela))}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Prazo</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {String(p.prazo ?? "—")} meses
          </p>
        </div>
      </div>

      {/* Formulário de Edição */}
      <PropostaForm initial={proposta as Record<string, unknown>} origem="erp" />
    </div>
  );
}
