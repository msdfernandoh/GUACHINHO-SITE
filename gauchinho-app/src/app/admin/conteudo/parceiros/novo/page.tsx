import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { saveParceiroAction } from "../../actions";
import { ParceiroForm } from "@/components/admin/conteudo/parceiro-form";

export default async function NovoParceiroPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/parceiros" className="text-sm text-amber-600 hover:underline">
        ← Parceiros
      </Link>
      <h1 className="text-2xl font-bold">Novo parceiro</h1>
      <ParceiroForm action={saveParceiroAction} />
    </div>
  );
}
