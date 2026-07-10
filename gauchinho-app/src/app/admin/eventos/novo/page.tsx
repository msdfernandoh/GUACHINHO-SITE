import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createEventoAction, fetchUsuariosStaffAtivos } from "../actions";
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";

export default async function NovoEventoPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const usuariosStaff = await fetchUsuariosStaffAtivos();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novo evento</h1>
      <EventoAdminForm action={createEventoAction} usuariosStaff={usuariosStaff} />
    </div>
  );
}
