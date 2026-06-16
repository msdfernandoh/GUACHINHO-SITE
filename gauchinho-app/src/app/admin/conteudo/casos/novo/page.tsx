import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { saveCasoSucessoAction } from "../../actions";
import { CasoSucessoForm } from "@/components/admin/conteudo/caso-sucesso-form";

export default async function NovoCasoPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/casos" className="text-sm text-amber-600 hover:underline">
        ← Casos
      </Link>
      <h1 className="text-2xl font-bold">Novo caso</h1>
      <CasoSucessoForm action={saveCasoSucessoAction} />
    </div>
  );
}
