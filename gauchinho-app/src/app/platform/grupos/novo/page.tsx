import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GroupCatalogForm } from "@/components/erp/group-catalog-form";
import { salvarGrupoGlobalAction } from "@/app/platform/grupos-actions";
export default async function NovoGrupoGlobalPage() {
  const db = await createClient();
  const [a, t, m] = await Promise.all([
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
  return (
    <div className="space-y-5">
      <Link href="/platform/grupos" className="font-semibold text-cyan-700">
        ← Grupos
      </Link>
      <header>
        <h1 className="text-3xl font-bold">Novo Grupo Global</h1>
        <p className="text-slate-500">
          Catálogo oficial da Administradora, pronto para consumo pelos ERPs.
        </p>
      </header>
      <GroupCatalogForm
        action={salvarGrupoGlobalAction}
        administradoras={a.data ?? []}
        tipos={t.data ?? []}
        modalidades={m.data ?? []}
        scope="PLATFORM"
      />
    </div>
  );
}
