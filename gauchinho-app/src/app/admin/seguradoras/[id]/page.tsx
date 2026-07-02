import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchSeguradora, updateSeguradoraAction } from "../actions";
import { SeguradoraForm } from "@/components/admin/seguradora-form";

export default async function EditarSeguradoraPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const { id } = await params;
  const seg = await fetchSeguradora(id).catch(() => null);
  if (!seg) notFound();
  const update = updateSeguradoraAction.bind(null, id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{seg.nome}</h1>
        <p className="text-sm text-zinc-500">Slug: {seg.slug ?? "—"}</p>
      </div>
      <SeguradoraForm action={update} seguradora={seg} />
    </div>
  );
}
