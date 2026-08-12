import { fetchContratacoesList } from "./actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { ContratacoesListClient } from "@/components/admin/contratacoes/contratacoes-list-client";

export default async function ContratacoesAdminPage() {
  await requireStaffAdmin();
  const rows = await fetchContratacoesList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contratações online</h1>
        <p className="text-sm font-medium text-zinc-400">
          Somente confirmações finais formalizadas pelo cliente, após documento persistido.
        </p>
      </div>
      <ContratacoesListClient rows={rows} />
    </div>
  );
}
