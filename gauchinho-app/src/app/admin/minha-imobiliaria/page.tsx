import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isImobiliaria } from "@/lib/auth/permissions";
import { fetchImobiliaria } from "../imobiliarias/actions";
import { updateMinhaImobiliariaAction } from "../imobiliarias/actions";
import { ImobiliariaForm } from "@/components/admin/imobiliaria-form";

export default async function MinhaImobiliariaPage() {
  const u = await getUsuarioNegocio();
  if (!isImobiliaria(u?.perfil) || !u?.imobiliaria_id) redirect("/login");

  const imob = await fetchImobiliaria(u.imobiliaria_id).catch(() => null);
  if (!imob) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minha imobiliária</h1>
      <p className="text-sm text-zinc-500">Atualize logo, banner e contatos visíveis no site.</p>
      <ImobiliariaForm action={updateMinhaImobiliariaAction} imob={imob} />
    </div>
  );
}
