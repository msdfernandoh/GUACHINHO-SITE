import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarGruposLegados } from "@/lib/platform/vinculacoes-legadas-service";
import { VinculacoesLegadasView } from "@/components/platform/vinculacoes-legadas-view";

export default async function VinculacoesLegadasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const db = await createClient();
  const { data: empresas } = await db
    .from("empresas")
    .select("id,nome_fantasia,slug,status")
    .order("nome_fantasia");
  const requested = (await searchParams).empresa;
  const empresaId = requested && (empresas ?? []).some((empresa) => empresa.id === requested)
    ? requested
    : empresas?.[0]?.id;
  if (!empresaId) redirect("/platform/empresas");

  const dataLegados = await listarGruposLegados(empresaId);

  const { data: gruposSaas } = await db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,status,ativo,prazo_total,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome),cotas:grupos_cotas(id,valor_credito,ativo,status)"
    )
    .order("codigo_grupo");

  const gruposSaasDisponiveis = ((gruposSaas ?? []) as any[]).map((g) => ({
    id: g.id,
    codigo_grupo: g.codigo_grupo,
    administradora_nome: g.administradora?.nome || "Administradora",
    tipo_nome: g.tipo?.nome || null,
    modalidade_nome: g.modalidade_comissao?.nome || null,
    prazo_total: g.prazo_total ?? null,
    status: g.status ?? (g.ativo ? "Disponível" : "Inativo"),
    ativo: Boolean(g.ativo),
    cotas: ((g.cotas ?? []) as any[])
      .filter((c) => c.ativo && !["Inativo", "Esgotado"].includes(c.status))
      .map((c) => ({
        id: c.id,
        valor_credito: Number(c.valor_credito),
      }))
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Empresa alvo da correção legada
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(empresas ?? []).map((empresa) => (
            <Link
              key={empresa.id}
              href={`/platform/grupos/vinculacoes?empresa=${empresa.id}`}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                empresa.id === empresaId
                  ? "bg-amber-700 text-white"
                  : "border border-amber-300 bg-white text-amber-900 dark:bg-slate-900 dark:text-amber-200"
              }`}
            >
              {empresa.nome_fantasia} ({empresa.slug})
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/80">
          Toda leitura, alteração e auditoria abaixo fica limitada à empresa selecionada.
        </p>
      </div>
      <VinculacoesLegadasView
        empresaId={empresaId}
        itens={dataLegados.itens}
        historico={dataLegados.historico}
        totalPendentes={dataLegados.totalPendentes}
        totalSugestoes={dataLegados.totalSugestoes}
        gruposSaasDisponiveis={gruposSaasDisponiveis}
      />
    </div>
  );
}
