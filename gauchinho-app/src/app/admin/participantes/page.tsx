import { redirect } from "next/navigation";
import { canAccessParticipantesAdmin, fetchParticipantesList } from "./actions";
import { ParticipantesManagerView } from "@/components/admin/participantes/participantes-manager-view";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig, erpModuleEnabled } from "@/lib/erp/erp-modulos";

export default async function ParticipantesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const allowed = await canAccessParticipantesAdmin();
  if (!allowed) redirect("/admin");

  const params = await searchParams;
  const { ready, message, rows, empresaId } = await fetchParticipantesList({
    status: params.status,
    q: params.q,
  });

  const { empresaAtiva } = await getCurrentTenantContext();
  const config = getErpSistemaConfig(empresaAtiva?.configuracoes);
  const modulosDisponiveis = [
    "clientes",
    "leads",
    "propostas",
    "contratacoes",
    "lances",
    "assembleias",
    "minhas-comissoes",
    "grupos",
  ].filter((m) => erpModuleEnabled(config, m));

  return (
    <div className="space-y-6">
      {!ready ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Módulo em preparação</p>
          <p className="mt-1">{message}</p>
        </div>
      ) : (
        <ParticipantesManagerView
          empresaId={empresaId || empresaAtiva?.id || ""}
          initialRows={rows}
          modulosDisponiveis={modulosDisponiveis}
        />
      )}
    </div>
  );
}
