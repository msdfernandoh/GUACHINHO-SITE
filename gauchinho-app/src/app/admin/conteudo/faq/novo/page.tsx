import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { saveFaqAction } from "../../actions";
import { FaqForm } from "@/components/admin/conteudo/faq-form";

export default async function NovaFaqPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/faq" className="text-sm text-amber-600 hover:underline">
        ← FAQ
      </Link>
      <h1 className="text-2xl font-bold">Nova pergunta</h1>
      <FaqForm action={saveFaqAction} />
    </div>
  );
}
