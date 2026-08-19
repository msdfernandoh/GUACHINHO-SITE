import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  type GrupoRecord,
  formatBRL,
  formatPercent,
  formatDateBR,
  computeGrupoMetrics,
  validateGrupoProntidao,
} from "@/lib/platform/grupos-prontidao";

export default async function PlatformGruposListingPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; administradora_id?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  let query = db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade,status,ativo,prazo_total,data_primeira_assembleia,parcelas_realizadas,prazo_restante,taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,capacidade_total,vagas_disponiveis,vagas_atualizado_em,dados_estatisticos,origem_governanca,status_governanca,updated_at,administradora:administradoras(id,nome),tipo:administradora_tipos(id,nome,codigo),modalidades:grupos_modalidades_disponiveis(id,administradora_modalidade_id,ativo,modalidade:administradora_modalidades_comissao(id,nome,codigo)),produtos:grupos_cotas(id,valor_credito,ativo,grupo_cota_modalidade_valores(id,administradora_modalidade_id,valor_parcela,habilitado,ativo))",
    )
    .order("codigo_grupo");

  if (filters.busca) {
    query = query.ilike("codigo_grupo", `%${filters.busca}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.administradora_id) {
    query = query.eq("administradora_id", filters.administradora_id);
  }

  const [{ data: grupos }, { data: administradoras }] = await Promise.all([
    query.limit(200),
    db.from("administradoras").select("id,nome").eq("status", "ATIVA").order("nome"),
  ]);

  const rows = (grupos ?? []) as unknown as GrupoRecord[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
            Catálogo Operacional de Grupos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Grupos oficiais das Administradoras com produtos de crédito, modalidades de pagamento, assembleias e vagas.
          </p>
        </div>
        <Link
          href="/platform/grupos/novo"
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-cyan-800"
        >
          + Novo Grupo Global
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input
          name="busca"
          defaultValue={filters.busca || ""}
          placeholder="Buscar por número do grupo..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <select
          name="administradora_id"
          defaultValue={filters.administradora_id || ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Todas as Administradoras</option>
          {(administradoras ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filters.status || ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Todos os status</option>
          <option value="Disponível">Disponível</option>
          <option value="Em Andamento">Em Andamento</option>
          <option value="Encerrado">Encerrado</option>
          <option value="Inativo">Inativo</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Filtrar
        </button>
      </form>

      {/* Tabela Compacta de Grupos */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3">Administradora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-center">Prazo</th>
                <th className="px-4 py-3 text-center">1ª Assembleia</th>
                <th className="px-4 py-3 text-right">Taxa Adm</th>
                <th className="px-4 py-3 text-right">FR</th>
                <th className="px-4 py-3 text-right">Taxa Total</th>
                <th className="px-4 py-3 text-right">Cota Mín.</th>
                <th className="px-4 py-3 text-right">Cota Máx.</th>
                <th className="px-4 py-3 text-center">Capacidade</th>
                <th className="px-4 py-3 text-center">Vagas</th>
                <th className="px-4 py-3 text-center">Prontidão</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-sm text-slate-400">
                    Nenhum grupo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                rows.map((grupo) => {
                  const metrics = computeGrupoMetrics(grupo);
                  const prontidao = validateGrupoProntidao(grupo);
                  const adminNome =
                    typeof grupo.administradora === "object"
                      ? grupo.administradora?.nome
                      : grupo.administradora || "—";
                  const tipoNome = grupo.tipo?.nome || grupo.modalidade || "—";

                  return (
                    <tr key={grupo.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        <Link
                          href={`/platform/grupos/${grupo.id}`}
                          className="text-cyan-700 hover:underline dark:text-cyan-400"
                        >
                          {grupo.codigo_grupo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {adminNome}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{tipoNome}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                        <span title={metrics.temporal.legenda} className="cursor-help">
                          {metrics.temporal.resumoPrazo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
                        {formatDateBR(grupo.data_primeira_assembleia)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPercent(grupo.taxa_administrativa_percentual)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatPercent(grupo.fundo_reserva_percentual)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatPercent(metrics.taxaTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {formatBRL(metrics.cotaMinima)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {formatBRL(metrics.cotaMaxima)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
                        {grupo.capacidade_total ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-900 dark:text-white">
                        {grupo.vagas_disponiveis ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            prontidao.ready
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {prontidao.ready ? "✓ Pronto" : `⚠ ${prontidao.issues.length}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/platform/grupos/${grupo.id}`}
                          className="rounded bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
