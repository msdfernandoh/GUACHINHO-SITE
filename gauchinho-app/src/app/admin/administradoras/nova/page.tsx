import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AdministradoraForm } from "@/components/admin/administradora-form";
import { createAdministradoraAction } from "../actions";

export default async function NovaAdministradoraPage() {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/administradoras" className="text-sm text-amber-600 hover:underline">
          ← Voltar ao catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Nova administradora global</h1>
        <p className="text-sm text-zinc-500">
          Cadastro no catálogo da plataforma. Não cria concessão para empresas/franqueadas.
        </p>
      </div>
      <AdministradoraForm action={createAdministradoraAction} />
    </div>
  );
}
