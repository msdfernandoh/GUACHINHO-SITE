import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateProgramRule, type ProgramRule } from "@/lib/platform/homologacao";

export default async function ProgramaPlatformPage({
  params,
}: {
  params: Promise<{ id: string; programaId: string }>;
}) {
  const { id, programaId } = await params;
  const db = await createClient();

  const { data } = await db
    .from("comissao_programas")
    .select(
      "id,nome,descricao,versao,status,ativo,administradora_id,programa_origem_id,administradora:administradoras(nome,nome_fantasia),empresa:empresas(nome_fantasia),regras:comissao_regras_franquia(id,versao,percentual_total_comissao,valor_fixo_total,base_calculo,vigencia_inicio,vigencia_fim,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id,curva_estorno_id,tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome),curva:administradora_curvas_estorno(nome,versao),etapas:comissao_regra_etapas(id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda))",
    )
    .eq("id", programaId)
    .eq("administradora_id", id)
    .maybeSingle();

  if (!data) notFound();

  const regras = (data.regras ?? []) as unknown as ProgramRule[];
  const admin = data.administradora as { nome?: string; nome_fantasia?: string } | null;
  const empresa = data.empresa as { nome_fantasia?: string } | null;
  const isHistorical = data.status === "SUBSTITUIDO";
  const isHomologado = data.status === "ATIVO";
  const isRascunho = data.status === "RASCUNHO";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/platform/administradoras/${id}?tab=programas`}
          className="text-sm font-bold text-cyan-700 hover:underline"
        >
          ← Programas da Administradora
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-cyan-600">
          Platform · Programa oficial
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">{data.nome}</h1>
          <span className="rounded-md bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
            v{data.versao}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isHomologado
                ? "bg-emerald-100 text-emerald-800"
                : isHistorical
                  ? "bg-slate-200 text-slate-700"
                  : "bg-amber-100 text-amber-900"
            }`}
          >
            {isHistorical
              ? "SUBSTITUÍDA · HISTÓRICO"
              : isHomologado
                ? "HOMOLOGADO"
                : "RASCUNHO"}
          </span>
        </div>
        <p className="mt-1 text-slate-500">
          {admin?.nome_fantasia || admin?.nome} · versão {data.versao} · {data.status}
        </p>
      </header>

      <div
        className={`rounded-xl border p-4 text-sm ${
          isHomologado
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : isHistorical
              ? "border-slate-200 bg-slate-100 text-slate-700"
              : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <strong>
          {isRascunho
            ? "RASCUNHO — Versão em edição/revisão. Não participa do motor de novas vendas até ser homologada."
            : isHistorical
              ? "VERSÃO SUBSTITUÍDA — Somente histórico preservado; não pode ser alterada ou re-homologada."
              : "PROGRAMA HOMOLOGADO — Ativo e elegível para o motor de novas vendas dentro do período de vigência."}
        </strong>
        <p className="mt-1 text-xs">
          {isRascunho
            ? "Você pode revisar regras, cronogramas e curvas diretamente nesta versão antes de homologar."
            : isHistorical
              ? "Uma versão posterior substituiu este programa. Os fatos históricos e snapshots anteriores permanecem intactos."
              : "Regras canônicas oficiais aplicáveis a vendas elegíveis da franqueadora."}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Administradora", admin?.nome_fantasia || admin?.nome || "—"],
          ["Status", isHomologado ? "HOMOLOGADO" : isHistorical ? "SUBSTITUÍDO" : "RASCUNHO"],
          ["Versão", `v${data.versao}`],
          ["Franqueadora", empresa?.nome_fantasia || "Não informada"],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border bg-white p-4">
            <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
          </article>
        ))}
      </section>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900">
          Regras Internas do Programa ({regras.length} modalidade{regras.length === 1 ? "" : "s"})
        </h2>

        {regras.map((r) => {
          const check = validateProgramRule(r);
          const etapas = (r.etapas ?? []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
          const totalScheduled = etapas.reduce((sum, item) => sum + Number(item.percentual_venda || 0), 0);
          const expectedCommission =
            r.base_calculo === "valor_fixo" ? r.valor_fixo_total : r.percentual_total_comissao;

          return (
            <article key={r.id} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {r.tipo?.nome || "Tipo pendente"} · {r.modalidade?.nome || "Modalidade pendente"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Vigência: {r.vigencia_inicio} → {r.vigencia_fim || "aberta"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isHistorical
                        ? "bg-slate-200 text-slate-700"
                        : r.configuracao_homologada
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {isHistorical
                      ? "HISTÓRICO"
                      : r.configuracao_homologada
                        ? "HOMOLOGADA"
                        : "RASCUNHO"}
                  </span>
                  {check.ready ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      ✓ Validação OK
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                      ⚠ {check.issues[0]}
                    </span>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-500">Comissão Total</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">
                    {r.base_calculo === "valor_fixo"
                      ? `R$ ${r.valor_fixo_total ?? "—"}`
                      : `${r.percentual_total_comissao ?? "—"}%`}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-500">Cronograma (Soma)</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">
                    {totalScheduled}% de {expectedCommission ?? "—"}%
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-500">Curva de Estorno</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-800">
                    {r.curva ? `${r.curva.nome} · v${r.curva.versao}` : "Nenhuma vinculada"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-500">Origem de Configuração</dt>
                  <dd className="mt-1 text-xs font-mono text-slate-700">
                    {r.origem_configuracao || "PLATFORM"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <h4 className="font-bold text-slate-900">Cronograma de Repasse</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-bold uppercase text-slate-500">
                        <th className="p-2">Ordem</th>
                        <th className="p-2">Gatilho</th>
                        <th className="p-2">Mês Relativo</th>
                        <th className="p-2">Nome da Etapa</th>
                        <th className="p-2">Percentual sobre Venda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {etapas.map((e) => (
                        <tr key={e.id ?? String(e.ordem)}>
                          <td className="p-2 font-medium">{e.ordem}</td>
                          <td className="p-2">{e.tipo_gatilho}</td>
                          <td className="p-2">{e.mes_relativo != null ? `${e.mes_relativo}º mês` : "Contemplação"}</td>
                          <td className="p-2 font-medium text-slate-900">{e.nome}</td>
                          <td className="p-2 font-bold text-slate-900">{e.percentual_venda}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-slate-50">
                        <td colSpan={4} className="p-2 text-right">
                          Total do Cronograma:
                        </td>
                        <td className="p-2 text-emerald-800">
                          {totalScheduled}% {expectedCommission != null && `(Comissão: ${expectedCommission}%)`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
