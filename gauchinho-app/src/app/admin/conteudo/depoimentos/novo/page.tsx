import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { saveDepoimentoAction } from "../../actions";
import { DepoimentoForm } from "@/components/admin/conteudo/depoimento-form";

export default async function NovoDepoimentoPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/depoimentos" className="text-sm text-amber-600 hover:underline">
        ← Depoimentos
      </Link>
      <h1 className="text-2xl font-bold">Novo depoimento</h1>
      <DepoimentoForm action={saveDepoimentoAction} />
    </div>
  );
}
