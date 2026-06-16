import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { fetchIndicesAdmin } from "./actions";
import { IndicesFinanceirosAdmin } from "@/components/admin/indices-financeiros/indices-admin";

export default async function IndicesFinanceirosPage() {
  const usuario = await getUsuarioNegocio();
  if (!canEditSettings(usuario?.perfil)) {
    redirect("/admin");
  }

  const indices = await fetchIndicesAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Índices financeiros</h1>
        <p className="text-sm text-zinc-500">
          Alimentam as calculadoras de aluguel e aplicação. Fallback manual quando a fonte externa falhar.
        </p>
      </div>
      <IndicesFinanceirosAdmin initial={indices} />
    </div>
  );
}
