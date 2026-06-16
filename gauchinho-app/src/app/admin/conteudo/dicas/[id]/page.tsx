import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { deleteDicaTcheAction, fetchAdminDica, saveDicaTcheAction } from "../../actions";
import { DicaTcheForm } from "@/components/admin/conteudo/dica-tche-form";
import type { DicaTche } from "@/lib/conteudo/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditarDicaPage({ params }: Props) {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let row: DicaTche;
  try {
    row = (await fetchAdminDica(id)) as DicaTche;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/dicas" className="text-sm text-amber-600 hover:underline">
        ← Dicas
      </Link>
      <h1 className="text-2xl font-bold">Editar dica</h1>
      {row.publicado ? (
        <a href={`/dicas-do-tche/${row.slug}`} className="text-sm text-amber-600 hover:underline" target="_blank">
          Ver no site
        </a>
      ) : null}
      <DicaTcheForm
        action={saveDicaTcheAction}
        initial={row}
        deleteAction={canDeleteRecords(u?.perfil) ? deleteDicaTcheAction : undefined}
      />
    </div>
  );
}
