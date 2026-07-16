"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NpsDashboardData, NpsDashboardEventoOption, NpsDistribuicao } from "@/lib/eventos-sorteio/nps-dashboard";
import { formatDateTime, formatWhatsappBrInput } from "@/lib/utils/format";

type Props = {
  eventos: NpsDashboardEventoOption[];
  selectedEventoId: string | null;
  data: NpsDashboardData | null;
};

function BarChart({ dist, maxHint }: { dist: NpsDistribuicao[]; maxHint?: number }) {
  const max = Math.max(maxHint ?? 0, ...dist.map((d) => d.total), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {dist.map((d) => (
        <div key={d.nota} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-zinc-500">{d.total || ""}</span>
          <div
            className="w-full min-h-[2px] rounded-t bg-amber-500/80"
            style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
            title={`${d.nota}: ${d.total}`}
          />
          <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{d.nota}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function NpsDashboardClient({ eventos, selectedEventoId, data }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <label className="text-sm font-medium">Evento</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={selectedEventoId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              router.push(id ? `/admin/eventos/nps?evento_id=${id}` : "/admin/eventos/nps");
            }}
          >
            <option value="">Selecione um evento…</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
                {ev.data_evento ? ` — ${new Date(ev.data_evento).toLocaleDateString("pt-BR")}` : ""}
              </option>
            ))}
          </select>
        </div>
        {selectedEventoId ? (
          <Link
            href={`/admin/eventos/${selectedEventoId}/sorteio#nps-config`}
            className="text-sm text-amber-600 hover:underline"
          >
            Configurar perguntas NPS deste evento →
          </Link>
        ) : null}
      </div>

      {!selectedEventoId ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Selecione um evento para ver o dashboard de NPS, respostas e indicações.
        </p>
      ) : !data ? (
        <p className="text-sm text-zinc-500">Evento não encontrado ou sem dados.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Respostas NPS" value={String(data.totalComNps)} hint={`${data.totalCadastros} cadastros`} />
            <StatCard
              label="Score NPS"
              value={data.scoreNps != null ? String(data.scoreNps) : "—"}
              hint="Promotores − Detratores (%)"
            />
            <StatCard
              label="Média recomendação"
              value={data.mediaRecomendacao != null ? String(data.mediaRecomendacao) : "—"}
              hint="De 0 a 10"
            />
            <StatCard
              label="Indicações"
              value={String(data.totalIndicacoes)}
              hint={`${data.totalCuponsIndicacao} cupons gerados`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Promotores (9–10)" value={String(data.promotores)} />
            <StatCard label="Passivos (7–8)" value={String(data.passivos)} />
            <StatCard label="Detratores (0–6)" value={String(data.detratores)} />
          </div>

          <section className="rounded-xl border p-4 dark:border-zinc-800">
            <h2 className="font-semibold">Distribuição — recomendação do evento</h2>
            <p className="mt-1 text-xs text-zinc-500">Quantidade de respostas por nota (0 a 10)</p>
            <div className="mt-4">
              <BarChart dist={data.distribuicaoRecomendacao} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Médias por dimensão</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.dimensoes
                .filter((d) => d.chave !== "recomendacao_evento")
                .map((d) => (
                  <div key={d.chave} className="rounded-xl border p-4 dark:border-zinc-800">
                    <p className="text-sm font-medium">{d.titulo}</p>
                    <p className="mt-2 text-2xl font-bold">{d.media != null ? d.media : "—"}</p>
                    <p className="text-xs text-zinc-500">{d.respostas} respostas</p>
                    <div className="mt-3">
                      <BarChart dist={d.distribuicao} />
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Aceitam diagnóstico gratuito" value={String(data.contatoSim)} />
            <StatCard label="Não aceitam contato diagnóstico" value={String(data.contatoNao)} />
          </div>

          <section className="space-y-3">
            <h2 className="font-semibold">Respostas individuais ({data.respostas.length})</h2>
            <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-zinc-50 text-xs uppercase dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Rec.</th>
                    <th className="px-3 py-2">Diagnóstico</th>
                    <th className="px-3 py-2">Comentário</th>
                  </tr>
                </thead>
                <tbody>
                  {data.respostas.map((r) => (
                    <tr key={r.participanteId} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.npsCompletoEm ? formatDateTime(r.npsCompletoEm, null) : "—"}
                      </td>
                      <td className="px-3 py-2">{r.nome}</td>
                      <td className="px-3 py-2">{formatWhatsappBrInput(r.telefone)}</td>
                      <td className="px-3 py-2 font-mono">{r.codigo}</td>
                      <td className="px-3 py-2 font-semibold">{r.recomendacao ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.contatoDiagnostico === true ? "Sim" : r.contatoDiagnostico === false ? "Não" : "—"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-zinc-500" title={r.comentario ?? ""}>
                        {r.comentario || "—"}
                      </td>
                    </tr>
                  ))}
                  {data.respostas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                        Nenhuma resposta NPS neste evento ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Indicações ({data.totalIndicacoes})</h2>
            <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-zinc-50 text-xs uppercase dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Indicado</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Quem indicou</th>
                    <th className="px-3 py-2">Cupom</th>
                  </tr>
                </thead>
                <tbody>
                  {data.indicacoes.map((i) => (
                    <tr key={i.id} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(i.createdAt, null)}</td>
                      <td className="px-3 py-2">{i.nome}</td>
                      <td className="px-3 py-2 capitalize">{i.tipo}</td>
                      <td className="px-3 py-2">{formatWhatsappBrInput(i.telefone)}</td>
                      <td className="px-3 py-2">
                        {i.indicadorNome}
                        <span className="block text-xs text-zinc-500">
                          {formatWhatsappBrInput(i.indicadorTelefone)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{i.cupomGerado ? "Gerado" : "Não gerado"}</td>
                    </tr>
                  ))}
                  {data.indicacoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Nenhuma indicação neste evento ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
