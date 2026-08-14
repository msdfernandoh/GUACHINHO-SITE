import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupCatalogForm } from "@/components/erp/group-catalog-form";
import { salvarGrupoGlobalAction } from "@/app/platform/grupos-actions";
export default async function EditarGrupoPlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { id } = await params;
  const { modo } = await searchParams;
  const db = await createClient();
  const [g, a, t, m] = await Promise.all([
    db
      .from("grupos_consorcio")
      .select(
        "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade_comissao_id,status,ativo,prazo_total,taxa_administrativa_percentual,permite_lance_embutido,percentual_lance_embutido,origem_governanca,status_governanca",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("administradoras")
      .select("id,nome")
      .eq("status", "ATIVA")
      .order("nome"),
    db
      .from("administradora_tipos")
      .select("id,nome,administradora_id")
      .eq("ativo", true)
      .order("nome"),
    db
      .from("administradora_modalidades_comissao")
      .select("id,nome,administradora_id")
      .eq("ativo", true)
      .order("nome"),
  ]);
  if (!g.data) notFound();
  const readonly = modo === "visualizar";
  return (
    <div className="space-y-5">
      <Link href="/platform/grupos" className="font-semibold text-cyan-700">
        ← Grupos
      </Link>
      <header>
        <h1 className="text-3xl font-bold">Grupo {g.data.codigo_grupo}</h1>
        <p className="text-slate-500">
          {g.data.origem_governanca === "GLOBAL"
            ? "Estrutura oficial global"
            : "Ajuste de configuração e governança do Grupo local/legado"}
        </p>
      </header>
      <GroupCatalogForm
        action={salvarGrupoGlobalAction}
        administradoras={a.data ?? []}
        tipos={t.data ?? []}
        modalidades={m.data ?? []}
        grupo={g.data}
        readonly={readonly}
        scope="PLATFORM"
      />
    </div>
  );
}
