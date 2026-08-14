import Link from "next/link";
import { createGrupoAction } from "../actions";
import { GrupoFormFields } from "@/components/admin/grupo-form-fields";
import { createClient } from "@/lib/supabase/server";

export default async function NovoGrupoPage() {
  const supabase = await createClient();
  const [{ data: tipos }, { data: modalidades }] = await Promise.all([
    supabase.from("administradora_tipos").select("id,nome").eq("ativo", true).order("nome"),
    supabase.from("administradora_modalidades_comissao").select("id,nome").eq("ativo", true).order("nome"),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/grupos" className="text-sm text-amber-600 hover:underline">
        ← Grupos
      </Link>
      <h1 className="text-2xl font-bold">Novo grupo</h1>
      <form id="grupo-form" action={createGrupoAction} className="space-y-6">
        <GrupoFormFields formId="grupo-form" tiposAdministradora={tipos ?? []} modalidadesComissao={modalidades ?? []} />
      </form>
    </div>
  );
}
