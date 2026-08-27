import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { GroupCatalogForm } from "@/components/erp/group-catalog-form";
import { salvarGrupoLocalAction } from "../actions";
import { getGrupoAutorizadoForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function GrupoErpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  try {
    await getGrupoAutorizadoForEmpresa(empresaAtiva.id, id);
  } catch {
    notFound();
  }
  const db = await createClient();
  const platformSuperadmin = await isPlatformSuperadmin();

  const [grupoRes, cotasRes, configRes] = await Promise.all([
    db
      .from("grupos_consorcio")
      .select(
        "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade_comissao_id,status,ativo,prazo_total,taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,permite_lance_embutido,percentual_lance_embutido,vagas_disponiveis,origem_governanca,status_governanca,empresa_origem_id,administradora:administradoras(id,nome),tipo:administradora_tipos(id,nome),modalidade:administradora_modalidades_comissao(id,nome)"
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("grupos_cotas")
      .select(
        "id,valor_credito,vagas_texto,vagas_percentual,status,ativo,ordem"
      )
      .eq("grupo_id", id)
      .order("valor_credito", { ascending: true })
      .order("ordem", { ascending: true }),
    db
      .from("empresa_grupos_config")
      .select("modalidade_integral_habilitada,modalidade_reduzida_habilitada,modalidade_personalizada_habilitada,status_vagas_local,alteracao_catalogo_status")
      .eq("empresa_id", empresaAtiva.id)
      .eq("grupo_id", id)
      .maybeSingle(),
  ]);

  const g = grupoRes.data;
  if (!g) notFound();

  if (
    g.origem_governanca === "LOCAL" &&
    g.empresa_origem_id &&
    g.empresa_origem_id !== empresaAtiva?.id
  ) {
    notFound();
  }

  const { data: grants } = await db
    .from("empresa_administradoras")
    .select("administradora:administradoras(id,nome)")
    .eq("empresa_id", empresaAtiva?.id ?? "")
    .eq("status", "ATIVA");

  const admins = (grants ?? []).flatMap((x) => {
    const a = x.administradora as unknown as { id: string; nome: string } | null;
    return a ? [a] : [];
  });

  const ids = admins.map((x) => x.id);

  const [t, m, modulosHabilitadosRes] = await Promise.all([
    db
      .from("administradora_tipos")
      .select("id,nome,administradora_id")
      .in("administradora_id", ids)
      .eq("ativo", true),
    db
      .from("administradora_modalidades_comissao")
      .select("id,nome,administradora_id")
      .in("administradora_id", ids)
      .eq("ativo", true),
    db
      .from("grupos_modalidades_disponiveis")
      .select("administradora_modalidade_id")
      .eq("grupo_id", id)
      .eq("ativo", true),
  ]);

  const cotas = cotasRes.data ?? [];
  const modalidadesHabilitadasIds = (modulosHabilitadosRes.data ?? []).map(
    (x) => x.administradora_modalidade_id
  );

  const grupoComModalidades = {
    ...g,
    modalidades_habilitadas_ids: modalidadesHabilitadasIds,
    modalidade_integral_habilitada: configRes.data?.modalidade_integral_habilitada ?? true,
    modalidade_reduzida_habilitada: configRes.data?.modalidade_reduzida_habilitada ?? true,
    modalidade_personalizada_habilitada: configRes.data?.modalidade_personalizada_habilitada ?? true,
    status_vagas_local: configRes.data?.status_vagas_local ?? "HERDAR",
    alteracao_catalogo_status: configRes.data?.alteracao_catalogo_status ?? "SEM_ALTERACAO",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/erp/grupos" className="text-sm font-semibold text-blue-700 hover:underline">
            ← Voltar para listagem de Grupos
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Grupo {g.codigo_grupo}
            </h1>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${
                g.origem_governanca === "LOCAL"
                  ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
              }`}
            >
              {g.origem_governanca === "LOCAL" ? "Empresa Local" : "Catálogo Global SaaS"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Administradora: <strong>{(g.administradora as any)?.nome ?? "Racon"}</strong> · Tipo: <strong>{(g.tipo as any)?.nome ?? "Imóvel"}</strong> · Prazo Total: <strong>{g.prazo_total ?? 180} meses</strong>
          </p>
        </div>

        {platformSuperadmin ? (
          <Link
            href={`/platform/grupos/${g.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            ⚙️ Abrir no Editor da Platform
          </Link>
        ) : null}
      </div>

      {/* 1. FORMULÁRIO DE CONFIGURAÇÃO DO GRUPO */}
      <GroupCatalogForm
        action={salvarGrupoLocalAction}
        administradoras={admins}
        tipos={t.data ?? []}
        modalidades={m.data ?? []}
        grupo={grupoComModalidades as any}
        readonly={false}
        scope="ERP"
      />

      {/* 2. TABELA DE TODAS AS COTAS COMERCIAIS DO GRUPO */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Créditos disponíveis neste Grupo ({cotas.length})
            </h2>
            <p className="text-xs text-slate-500">
              O SaaS guarda somente os créditos. O site calcula as parcelas com prazo, taxas, seguro e modalidade escolhida.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {cotas.filter((c) => c.ativo !== false && !["Inativo", "Esgotado"].includes(c.status)).length} Ativas
            </span>
          </div>
        </div>

        {cotas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            <p className="font-semibold">Nenhuma cota/produto cadastrado para este grupo no momento.</p>
            <p className="mt-1 text-xs text-slate-400">
              As cotas são sincronizadas a partir do catálogo oficial SaaS na Platform.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3">Crédito</th>
                  <th className="p-3 text-center">Prazo</th>
                  <th className="p-3 text-center">Vagas</th>
                  <th className="p-3 text-center">Status da Cota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cotas.map((c) => {
                  const isAtiva = c.ativo !== false && !["Inativo", "Esgotado"].includes(c.status);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 font-mono text-sm font-extrabold text-blue-700 dark:text-blue-400">
                        {money.format(Number(c.valor_credito))}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {g.prazo_total ? `${g.prazo_total}m` : "—"}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                        {Number(g.vagas_disponiveis ?? 0) <= 0
                          ? "Aguardando novas vagas"
                          : c.vagas_texto || (c.vagas_percentual != null ? `${c.vagas_percentual}%` : "Disponível")}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            isAtiva
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {c.status || (isAtiva ? "Disponível" : "Inativo")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
