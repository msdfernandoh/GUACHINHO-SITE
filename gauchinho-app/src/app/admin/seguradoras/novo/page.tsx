import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createSeguradoraAction } from "../actions";
import { SeguradoraForm } from "@/components/admin/seguradora-form";

export default async function NovaSeguradoraPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova seguradora</h1>
      <SeguradoraForm action={createSeguradoraAction} />
    </div>
  );
}
