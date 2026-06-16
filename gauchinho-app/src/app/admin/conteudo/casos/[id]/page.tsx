import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo, canDeleteRecords } from "@/lib/auth/permissions";
import { deleteCasoSucessoAction, fetchAdminCaso, saveCasoSucessoAction } from "../../actions";
import { CasoSucessoForm } from "@/components/admin/conteudo/caso-sucesso-form";
import type { CasoSucesso } from "@/lib/conteudo/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditarCasoPage({ params }: Props) {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");

  const { id } = await params;
  let row: CasoSucesso;
  try {
    row = (await fetchAdminCaso(id)) as CasoSucesso;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/conteudo/casos" className="text-sm text-amber-600 hover:underline">
        ← Casos
      </Link>
      <h1 className="text-2xl font-bold">Editar caso</h1>
      {row.publicado ? (
        <p className="text-sm text-zinc-500">
          Público:{" "}
          <a href={`/casos-de-sucesso/${row.slug}`} className="text-amber-600 hover:underline" target="_blank">
            /casos-de-sucesso/{row.slug}
          </a>
        </p>
      ) : null}
      <CasoSucessoForm
        action={saveCasoSucessoAction}
        initial={row}
        deleteAction={canDeleteRecords(u?.perfil) ? deleteCasoSucessoAction : undefined}
      />
    </div>
  );
}
