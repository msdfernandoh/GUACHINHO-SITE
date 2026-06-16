import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isImobiliaria, isStaff } from "@/lib/auth/permissions";
import { fetchImovel, updateImovelAction } from "../actions";
import { ImovelForm } from "@/components/admin/imovel-form";

export default async function EditarImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!u || (!isStaff(u.perfil) && !isImobiliaria(u.perfil))) redirect("/login");
  const { id } = await params;
  const imovel = await fetchImovel(id).catch(() => null);
  if (!imovel) notFound();
  if (isImobiliaria(u.perfil) && u.imobiliaria_id !== imovel.imobiliaria_id) {
    redirect("/admin/imoveis");
  }

  const update = updateImovelAction.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar imóvel</h1>
      <ImovelForm action={update} imovel={imovel} defaultImobiliariaId={imovel.imobiliaria_id} />
    </div>
  );
}
