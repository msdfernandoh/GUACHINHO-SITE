import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createEventoAction } from "../actions";
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";

export default async function NovoEventoPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novo evento</h1>
      <EventoAdminForm action={createEventoAction} />
    </div>
  );
}
