import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { deleteDepoimentoAction, fetchAdminDepoimento, saveDepoimentoAction } from "../../actions";
import { DepoimentoForm } from "@/components/admin/conteudo/depoimento-form";
import type { Depoimento } from "@/lib/conteudo/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditarDepoimentoPage({ params }: Props) {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let row: Depoimento;
  try {
    row = (await fetchAdminDepoimento(id)) as Depoimento;
  } catch {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/depoimentos" className="text-sm text-amber-600 hover:underline">
        ← Depoimentos
      </Link>
      <h1 className="text-2xl font-bold">Editar depoimento</h1>
      <DepoimentoForm
        action={saveDepoimentoAction}
        initial={row}
        deleteAction={canDeleteRecords(u?.perfil) ? deleteDepoimentoAction : undefined}
      />
    </div>
  );
}
