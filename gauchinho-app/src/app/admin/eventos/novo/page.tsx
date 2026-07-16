import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createEventoAction, fetchUsuariosStaffAtivos } from "../actions";
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";
import { listQrCodesDisponiveisParaEvento } from "@/lib/eventos-sorteio/qr-unico";

export default async function NovoEventoPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const usuariosStaff = await fetchUsuariosStaffAtivos();
  let qrDisponiveis: Awaited<ReturnType<typeof listQrCodesDisponiveisParaEvento>> = [];
  try {
    qrDisponiveis = await listQrCodesDisponiveisParaEvento("");
  } catch {
    qrDisponiveis = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novo evento</h1>
        <p className="text-sm text-zinc-500">
          Cadastre QR Codes únicos em{" "}
          <Link href="/admin/configuracoes/qr-codes" className="text-amber-600 hover:underline">
            Configurações → QR Codes únicos
          </Link>
          .
        </p>
      </div>
      <EventoAdminForm
        action={createEventoAction}
        usuariosStaff={usuariosStaff}
        qrDisponiveis={qrDisponiveis}
      />
    </div>
  );
}
