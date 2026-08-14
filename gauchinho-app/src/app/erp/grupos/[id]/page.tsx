import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { GroupCatalogForm } from "@/components/erp/group-catalog-form";
import { salvarGrupoLocalAction } from "../actions";
export default async function GrupoErpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  const db = await createClient();
  const { data: g } = await db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade_comissao_id,status,ativo,prazo_total,taxa_administrativa_percentual,permite_lance_embutido,percentual_lance_embutido,origem_governanca,status_governanca,empresa_origem_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!g) notFound();
  if (
    g.origem_governanca !== "GLOBAL" &&
    g.empresa_origem_id !== empresaAtiva?.id
  )
    notFound();
  const { data: grants } = await db
    .from("empresa_administradoras")
    .select("administradora:administradoras(id,nome)")
    .eq("empresa_id", empresaAtiva?.id ?? "")
    .eq("status", "ATIVA");
  const admins = (grants ?? []).flatMap((x) => {
    const a = x.administradora as unknown as {
      id: string;
      nome: string;
    } | null;
    return a ? [a] : [];
  });
  const ids = admins.map((x) => x.id);
  const [t, m] = await Promise.all([
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
  ]);
  return (
    <div className="space-y-5">
      <Link href="/erp/grupos" className="font-semibold text-blue-700">
        ← Grupos
      </Link>
      <header>
        <h1 className="text-3xl font-bold">Grupo {g.codigo_grupo}</h1>
        <p className="text-slate-500">
          {g.origem_governanca === "GLOBAL"
            ? "Catálogo oficial da Platform"
            : "Configuração local da empresa"}
        </p>
      </header>
      <GroupCatalogForm
        action={salvarGrupoLocalAction}
        administradoras={admins}
        tipos={t.data ?? []}
        modalidades={m.data ?? []}
        grupo={g}
        readonly={g.origem_governanca === "GLOBAL"}
        scope="ERP"
      />
    </div>
  );
}
