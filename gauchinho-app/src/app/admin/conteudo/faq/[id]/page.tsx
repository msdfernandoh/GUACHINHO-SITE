import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { deleteFaqAction, fetchAdminFaqItem, saveFaqAction } from "../../actions";
import { FaqForm } from "@/components/admin/conteudo/faq-form";
import type { PerguntaFrequente } from "@/lib/conteudo/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditarFaqPage({ params }: Props) {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let row: PerguntaFrequente;
  try {
    row = (await fetchAdminFaqItem(id)) as PerguntaFrequente;
  } catch {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/faq" className="text-sm text-amber-600 hover:underline">
        ← FAQ
      </Link>
      <h1 className="text-2xl font-bold">Editar FAQ</h1>
      <FaqForm
        action={saveFaqAction}
        initial={row}
        deleteAction={canDeleteRecords(u?.perfil) ? deleteFaqAction : undefined}
      />
    </div>
  );
}
