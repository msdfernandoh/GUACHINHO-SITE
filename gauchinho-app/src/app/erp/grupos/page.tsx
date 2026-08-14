import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
export default async function ErpGruposPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const f = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const db = await createClient();
  let q = db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,status,ativo,origem_governanca,status_governanca,empresa_origem_id,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome)",
    )
    .or(`origem_governanca.eq.GLOBAL,empresa_origem_id.eq.${empresaAtiva?.id}`)
    .order("codigo_grupo");
  if (f.busca) q = q.ilike("codigo_grupo", `%${f.busca}%`);
  if (f.status) q = q.eq("status_governanca", f.status);
  const { data, error } = await q;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Catálogo operacional
          </p>
          <h1 className="text-3xl font-bold">Grupos</h1>
          <p className="text-slate-500">
            Globais em leitura; locais gerenciados pela empresa.
          </p>
        </div>
        <Link
          href="/erp/grupos/novo"
          className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white"
        >
          Novo Grupo Local
        </Link>
      </header>
      <form className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
        <input
          className="rounded-lg border px-3 py-2"
          name="busca"
          defaultValue={f.busca}
          placeholder="Grupo"
        />
        <select
          className="rounded-lg border px-3 py-2"
          name="status"
          defaultValue={f.status ?? ""}
        >
          <option value="">Todos</option>
          <option>CONFIGURACAO_PENDENTE</option>
          <option>PENDENTE_PLATFORM</option>
          <option>LOCAL</option>
          <option>GLOBAL</option>
        </select>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-white">
          Filtrar
        </button>
      </form>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-800">{error.message}</p>
      )}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Grupo</th>
              <th>Administradora</th>
              <th>Tipo</th>
              <th>Modalidade</th>
              <th>Configuração</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((g) => (
              <tr key={g.id} className="border-t">
                <td className="p-3 font-bold">Grupo {g.codigo_grupo}</td>
                <td>
                  {(g.administradora as unknown as { nome?: string })?.nome ??
                    "—"}
                </td>
                <td>
                  {(g.tipo as unknown as { nome?: string })?.nome ?? "Pendente"}
                </td>
                <td>
                  {(g.modalidade_comissao as unknown as { nome?: string })
                    ?.nome ?? "Pendente"}
                </td>
                <td>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${g.tipo && g.modalidade_comissao ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {g.tipo && g.modalidade_comissao
                      ? "PRONTO PARA VENDA"
                      : "CONFIGURAÇÃO PENDENTE"}
                  </span>
                </td>
                <td>
                  <Link
                    className="font-semibold text-blue-700"
                    href={`/erp/grupos/${g.id}`}
                  >
                    {g.origem_governanca === "GLOBAL" ? "Visualizar" : "Editar"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
