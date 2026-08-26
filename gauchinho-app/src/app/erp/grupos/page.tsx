import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ErpGruposSyncButton } from "@/components/erp/erp-grupos-sync-button";
import { listAdministradoraIdsAutorizadasForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

export default async function ErpGruposPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const f = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const db = await createClient();
  const administradoraIds = empresaAtiva
    ? await listAdministradoraIdsAutorizadasForEmpresa(empresaAtiva.id)
    : [];

  let q = db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,status,ativo,prazo_total,vagas_disponiveis,data_primeira_assembleia,origem_governanca,status_governanca,empresa_origem_id,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome),cotas:grupos_cotas(id,valor_credito,ativo,status)"
    )
    .in("administradora_id", administradoraIds.length ? administradoraIds : ["00000000-0000-0000-0000-000000000000"])
    .order("codigo_grupo");

  if (f.busca) q = q.ilike("codigo_grupo", `%${f.busca}%`);
  if (f.status) q = q.eq("status_governanca", f.status);

  const { data: rawData, error } = await q;
  const data = (rawData ?? []).filter(
    (g: any) =>
      g.origem_governanca !== "LOCAL" ||
      g.empresa_origem_id === empresaAtiva?.id ||
      !g.empresa_origem_id
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Catálogo Operacional de Grupos
          </p>
          <h1 className="text-3xl font-bold">Grupos de Consórcio</h1>
          <p className="text-slate-500">
            Grupos oficiais do SaaS liberados para a Master Franquia em leitura e grupos locais gerenciados pela empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ErpGruposSyncButton />
          <Link
            href="/erp/grupos/novo"
            className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white shadow hover:bg-blue-800 text-sm"
          >
            + Novo Grupo Local
          </Link>
        </div>
      </header>

      <form className="flex flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          name="busca"
          defaultValue={f.busca}
          placeholder="Buscar por grupo..."
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          name="status"
          defaultValue={f.status ?? ""}
        >
          <option value="">Todos os status</option>
          <option value="CONFIGURACAO_PENDENTE">CONFIGURACAO_PENDENTE</option>
          <option value="PENDENTE_PLATFORM">PENDENTE_PLATFORM</option>
          <option value="LOCAL">LOCAL</option>
          <option value="GLOBAL">GLOBAL</option>
        </select>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Filtrar
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-800">{error.message}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="p-3">Grupo</th>
              <th className="p-3">Administradora</th>
              <th className="p-3">Tipo / Segmento</th>
              <th className="p-3">Modalidade</th>
              <th className="p-3 text-center">Prazo Total</th>
              <th className="p-3 text-center">Vagas</th>
              <th className="p-3 text-center">Cotas</th>
              <th className="p-3 text-center">Origem</th>
              <th className="p-3 text-center">Status / Prontidão</th>
              <th className="p-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data ?? []).map((g) => {
              const cotasAtivas = ((g.cotas ?? []) as any[]).filter(
                (c) => c.ativo && !["Inativo", "Esgotado"].includes(c.status)
              );
              const isPronto = cotasAtivas.length > 0 && g.ativo !== false && g.status !== "Inativo";

              return (
                <tr key={g.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                    Grupo {g.codigo_grupo}
                  </td>
                  <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                    {(g.administradora as unknown as { nome?: string })?.nome ?? "—"}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {(g.tipo as unknown as { nome?: string })?.nome ?? "Imóvel"}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                    {(g.modalidade_comissao as unknown as { nome?: string })?.nome ?? "Todas Habilitadas (Integral / Reduzida)"}
                  </td>
                  <td className="p-3 text-center font-mono font-semibold">
                    {g.prazo_total ? `${g.prazo_total}m` : "—"}
                  </td>
                  <td className="p-3 text-center font-mono">
                    {g.vagas_disponiveis != null ? g.vagas_disponiveis : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {cotasAtivas.length} cotas
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        g.origem_governanca === "LOCAL"
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}
                    >
                      {g.origem_governanca === "LOCAL" ? "LOCAL" : "GLOBAL (SaaS)"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        isPronto
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {isPronto ? "Disponível para Venda" : "Aguardando Cotas"}
                    </span>
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <Link
                      className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                      href={`/erp/grupos/${g.id}`}
                    >
                      {g.origem_governanca === "LOCAL" ? "Editar" : "Ver Detalhes"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
