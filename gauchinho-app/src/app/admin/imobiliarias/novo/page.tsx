import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createImobiliariaAction } from "../actions";
import { ImobiliariaForm } from "@/components/admin/imobiliaria-form";

export default async function NovaImobiliariaPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova imobiliária</h1>
      <ImobiliariaForm action={createImobiliariaAction} masterFields />
    </div>
  );
}
