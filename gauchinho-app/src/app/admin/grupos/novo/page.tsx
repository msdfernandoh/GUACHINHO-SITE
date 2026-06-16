import Link from "next/link";
import { createGrupoAction } from "../actions";
import { GrupoFormFields } from "@/components/admin/grupo-form-fields";

export default function NovoGrupoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/grupos" className="text-sm text-amber-600 hover:underline">
        ← Grupos
      </Link>
      <h1 className="text-2xl font-bold">Novo grupo</h1>
      <form id="grupo-form" action={createGrupoAction} className="space-y-6">
        <GrupoFormFields formId="grupo-form" />
      </form>
    </div>
  );
}
