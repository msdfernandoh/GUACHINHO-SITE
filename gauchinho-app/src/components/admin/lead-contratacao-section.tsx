import Link from "next/link";
import { ContratacaoGruposResumo } from "@/components/contratacao/contratacao-grupos-resumo";
import {
  linhasGrupoResumoFromDados,
  resumoFinanceiroFromDados,
} from "@/lib/contratacoes-online/extract-fields";
import { dadosSimulacaoGruposFromLead } from "@/lib/contratacoes-online/ficha-administradora";
import { formatCurrency } from "@/lib/utils/format";
import type { ContratacaoOnlineRow } from "@/lib/contratacoes-online/types";

export function LeadContratacaoOnlineSection({
  lead,
  contratacao,
}: {
  lead: Record<string, unknown>;
  contratacao: ContratacaoOnlineRow | null;
}) {
  const origem = String(lead.origem ?? "");
  const isContratacao =
    origem === "contratacao_online" || Boolean(contratacao) || Boolean(dsLead.contratacao_id);

  if (!isContratacao) return null;

  const dsLead = (lead.dados_simulacao ?? {}) as Record<string, unknown>;
  const dadosGrupos = dadosSimulacaoGruposFromLead(lead.dados_simulacao);
  const origemFluxo =
    contratacao?.origem ??
    (dsLead.origem_fluxo === "grupos" || dsLead.origem_fluxo === "simulador"
      ? (dsLead.origem_fluxo as "grupos" | "simulador")
      : "grupos");
  const gruposLinhas = linhasGrupoResumoFromDados(origemFluxo, dadosGrupos);
  const fin = resumoFinanceiroFromDados(origemFluxo, dadosGrupos);

  const protocolo =
    contratacao?.protocolo ??
    (typeof (lead.dados_simulacao as Record<string, unknown>)?.protocolo === "string"
      ? String((lead.dados_simulacao as Record<string, unknown>).protocolo)
      : null);

  const contratacaoId =
    contratacao?.id ??
    (typeof (lead.dados_simulacao as Record<string, unknown>)?.contratacao_id === "string"
      ? String((lead.dados_simulacao as Record<string, unknown>).contratacao_id)
      : null);

  return (
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-emerald-200">Proposta online (contratação)</h2>
        {contratacaoId ? (
          <Link
            href={`/admin/contratacoes/${contratacaoId}`}
            className="text-sm font-medium text-amber-400 hover:underline"
          >
            Abrir contratação {protocolo ? `· ${protocolo}` : ""} →
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Resumo da proposta online vinculada a este lead (grupos, cotas e meses decorridos).
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {lead.valor_simulado != null ? (
          <div>
            <dt className="text-zinc-500">Crédito</dt>
            <dd className="text-zinc-100">{formatCurrency(Number(lead.valor_simulado))}</dd>
          </div>
        ) : null}
        {lead.parcela_estimada != null || contratacao?.parcela_estimada != null ? (
          <div>
            <dt className="text-zinc-500">Parcela inicial</dt>
            <dd className="text-zinc-100">
              {formatCurrency(Number(contratacao?.parcela_estimada ?? lead.parcela_estimada ?? 0))}
            </dd>
          </div>
        ) : null}
        {fin.parcelaReduzida != null ? (
          <div>
            <dt className="text-zinc-500">Parcela reduzida</dt>
            <dd className="text-zinc-100">{formatCurrency(Number(fin.parcelaReduzida))}</dd>
          </div>
        ) : null}
      </dl>
      {gruposLinhas.length > 0 ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <ContratacaoGruposResumo linhas={gruposLinhas} />
        </div>
      ) : null}
    </section>
  );
}
