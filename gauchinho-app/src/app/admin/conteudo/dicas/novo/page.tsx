import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { saveDicaTcheAction } from "../../actions";
import { DicaTcheForm } from "@/components/admin/conteudo/dica-tche-form";

export default async function NovaDicaPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/dicas" className="text-sm text-amber-600 hover:underline">
        ← Dicas
      </Link>
      <h1 className="text-2xl font-bold">Nova dica</h1>
      <DicaTcheForm action={saveDicaTcheAction} />
    </div>
  );
}
