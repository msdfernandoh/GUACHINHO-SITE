import Link from "next/link";
import { formatDateTime } from "@/lib/utils/format";
import {
  labelVeiculo,
  labelMoradia,
  labelCapacidade,
  labelAvaliacaoEncontro,
  labelMomentoOportunidade,
} from "@/lib/eventos-sorteio/checkin-conversacional";

export type QualificacaoEventoItem = {
  id: string;
  lead_id: string;
  evento_id: string | null;
  evento_nome: string | null;
  codigo_sorteio: string | number | null;
  qualificacao_respostas: {
    veiculo?: string;
    moradia?: string;
    capacidade_mensal?: string;
    avaliacao_encontro?: string;
    avaliacao_melhoria?: string;
    momento_oportunidade?: string;
    [key: string]: unknown;
  } | null;
  lgpd_termo_versao: string | null;
  lgpd_consentimento_at: string | null;
  checkin_at: string | null;
  created_at: string;
};

export function LeadCheckinQualificacao({
  qualificacoes,
}: {
  qualificacoes: QualificacaoEventoItem[];
}) {
  if (!qualificacoes || qualificacoes.length === 0) return null;

  const [recente, ...historico] = qualificacoes;
  const respRecente = (recente.qualificacao_respostas ?? {}) as {
    veiculo?: string;
    moradia?: string;
    capacidade_mensal?: string;
    avaliacao_encontro?: string;
    avaliacao_melhoria?: string;
    momento_oportunidade?: string;
  };

  return (
    <section className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-zinc-900/90 to-zinc-950 p-5 shadow-lg shadow-amber-500/5">
      {/* Cabeçalho do Card Comercial */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-xl font-bold text-amber-400">
            🎯
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100">
                Resumo Comercial do Check-in
              </h2>
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                Mais recente
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Respostas fornecidas no check-in interativo do evento com número da sorte gerado.
            </p>
          </div>
        </div>

        {historico.length > 0 ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            Total de {qualificacoes.length} participações em eventos
          </span>
        ) : null}
      </div>

      {(respRecente.avaliacao_encontro || respRecente.momento_oportunidade) ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-sky-300">
              <span>💬</span>
              <span>Avaliação do encontro</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">
              {labelAvaliacaoEncontro(respRecente.avaliacao_encontro)}
            </p>
            {respRecente.avaliacao_melhoria ? (
              <p className="mt-2 rounded-md bg-zinc-950/50 p-2 text-xs leading-relaxed text-zinc-300">
                {respRecente.avaliacao_melhoria}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span>🚀</span>
              <span>Momento atual / próximo passo</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">
              {labelMomentoOportunidade(respRecente.momento_oportunidade)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Destaque do Evento e Número da Sorte Mais Recente */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-500/25 bg-amber-950/20 px-4 py-3">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-400/80 font-semibold">
            Evento Associado
          </span>
          <p className="text-base font-bold text-zinc-100">
            {recente.evento_nome || "Evento sem nome"}
          </p>
          {recente.evento_id ? (
            <Link
              href={`/admin/eventos/${recente.evento_id}/participantes`}
              className="mt-0.5 inline-block text-xs text-amber-400 hover:underline"
            >
              Ver lista de participantes do evento →
            </Link>
          ) : null}
        </div>

        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-amber-400/80 font-semibold">
            Número da Sorte
          </span>
          <div className="mt-0.5">
            <span className="inline-block rounded-lg border border-amber-400/50 bg-amber-400/20 px-3 py-1 font-mono text-xl font-black text-amber-300 shadow-inner">
              {recente.codigo_sorteio ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Blocos de Respostas Comerciais */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* Veículo Atual */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3.5 transition hover:border-zinc-700">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span>🚗</span>
            <span>Veículo Atual</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {labelVeiculo(respRecente.veiculo)}
          </p>
        </div>

        {/* Situação de Moradia */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3.5 transition hover:border-zinc-700">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span>🏠</span>
            <span>Situação de Moradia</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {labelMoradia(respRecente.moradia)}
          </p>
        </div>

        {/* Capacidade de Investimento */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 transition hover:border-amber-500/50">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <span>💰</span>
            <span>Capacidade Mensal</span>
          </div>
          <p className="mt-2 text-sm font-bold text-amber-200">
            {labelCapacidade(respRecente.capacidade_mensal)}
          </p>
        </div>
      </div>

      {/* Rodapé: Data de Check-in e LGPD */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
        <div>
          <span>Check-in realizado em: </span>
          <span className="font-medium text-zinc-200">
            {recente.checkin_at ? formatDateTime(recente.checkin_at, null) : "—"}
          </span>
        </div>
        {recente.lgpd_consentimento_at ? (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span>✓</span>
            <span>Consentimento LGPD aceito</span>
            {recente.lgpd_termo_versao ? (
              <span className="text-zinc-500">({recente.lgpd_termo_versao})</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Histórico em outros eventos anteriores (se houver) */}
      {historico.length > 0 ? (
        <details className="group mt-4 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-zinc-300 hover:text-amber-300 flex items-center justify-between">
            <span>
              📋 Participações em Eventos Anteriores ({historico.length})
            </span>
            <span className="text-xs text-zinc-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-3 space-y-3 pt-2 border-t border-zinc-800">
            {historico.map((h, idx) => {
              const hResp = (h.qualificacao_respostas ?? {}) as {
                veiculo?: string;
                moradia?: string;
                capacidade_mensal?: string;
                avaliacao_encontro?: string;
                avaliacao_melhoria?: string;
                momento_oportunidade?: string;
              };
              return (
                <div
                  key={h.id || idx}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-200">
                        {h.evento_nome || "Evento sem nome"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Check-in: {h.checkin_at ? formatDateTime(h.checkin_at, null) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Nº da Sorte
                      </span>
                      <p className="font-mono text-sm font-bold text-amber-400">
                        {h.codigo_sorteio ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="text-zinc-400">
                      <span className="text-zinc-500">Veículo: </span>
                      <span className="text-zinc-200">{labelVeiculo(hResp.veiculo)}</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-500">Moradia: </span>
                      <span className="text-zinc-200">{labelMoradia(hResp.moradia)}</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-500">Investimento: </span>
                      <span className="text-amber-300 font-medium">
                        {labelCapacidade(hResp.capacidade_mensal)}
                      </span>
                    </div>
                  </div>
                  {(hResp.avaliacao_encontro || hResp.momento_oportunidade) ? (
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="text-zinc-400">
                        <span className="text-zinc-500">Avaliação: </span>
                        <span className="text-zinc-200">{labelAvaliacaoEncontro(hResp.avaliacao_encontro)}</span>
                        {hResp.avaliacao_melhoria ? <p className="mt-1 text-zinc-400">{hResp.avaliacao_melhoria}</p> : null}
                      </div>
                      <div className="text-zinc-400">
                        <span className="text-zinc-500">Próximo passo: </span>
                        <span className="text-emerald-300">{labelMomentoOportunidade(hResp.momento_oportunidade)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
