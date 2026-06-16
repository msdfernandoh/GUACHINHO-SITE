import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { deleteParceiroAction, fetchAdminParceiro, saveParceiroAction } from "../../actions";
import { ParceiroForm } from "@/components/admin/conteudo/parceiro-form";
import type { ParceiroInstitucional } from "@/lib/conteudo/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditarParceiroPage({ params }: Props) {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let row: ParceiroInstitucional;
  try {
    row = (await fetchAdminParceiro(id)) as ParceiroInstitucional;
  } catch {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/parceiros" className="text-sm text-amber-600 hover:underline">
        ← Parceiros
      </Link>
      <h1 className="text-2xl font-bold">Editar parceiro</h1>
      <ParceiroForm
        action={saveParceiroAction}
        initial={row}
        deleteAction={canDeleteRecords(u?.perfil) ? deleteParceiroAction : undefined}
      />
    </div>
  );
}
