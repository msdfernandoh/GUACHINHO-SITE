import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { GroupCatalogForm } from "@/components/erp/group-catalog-form";
import { salvarGrupoLocalAction } from "../actions";
export default async function NovoGrupoLocalPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  const db = await createClient();
  const { data: grants } = await db
    .from("empresa_administradoras")
    .select("administradora_id,administradora:administradoras(id,nome)")
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
      <h1 className="text-3xl font-bold">Novo Grupo Local</h1>
      <GroupCatalogForm
        action={salvarGrupoLocalAction}
        administradoras={admins}
        tipos={t.data ?? []}
        modalidades={m.data ?? []}
        scope="ERP"
      />
    </div>
  );
}
