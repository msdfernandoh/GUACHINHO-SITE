import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { ListaConvidadosCreateForm } from "@/components/admin/eventos/lista-convidados-create-form";
import { fetchEventosOptionsForListas } from "../actions";

export default async function NovaListaConvidadosPage({
  searchParams,
}: {
  searchParams: Promise<{ evento_id?: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) redirect("/admin");

  const sp = await searchParams;
  const eventos = await fetchEventosOptionsForListas();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/eventos/listas-convidados" className="text-sm text-amber-600 hover:underline">
          ← Listas de convidados
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Nova lista</h1>
        <p className="text-sm text-zinc-500">
          Escolha o evento e o consultor, cadastre o primeiro convidado e use + para incluir os demais.
        </p>
      </div>
      <ListaConvidadosCreateForm
        eventos={eventos}
        defaultConsultorNome={u?.nome ?? ""}
        prefillEventoId={sp.evento_id}
      />
    </div>
  );
}
