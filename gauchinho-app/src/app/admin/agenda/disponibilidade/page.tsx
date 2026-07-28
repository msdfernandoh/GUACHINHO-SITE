import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { fetchMinhaDisponibilidade } from "./actions";
import { DisponibilidadeForm } from "./disponibilidade-form";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/components/admin/admin-contrast";

export default async function AgendaDisponibilidadePage() {
  await requireStaffAdmin();
  const { slots, observacao } = await fetchMinhaDisponibilidade();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={adminPageTitleClass}>Configurar disponibilidade</h1>
          <p className={adminPageSubtitleClass}>
            Deixe claro para o SDR em quais dias e horários você está livre para agendamentos.
          </p>
        </div>
        <Link href="/admin/agenda" className="text-sm text-amber-400 hover:underline">
          Voltar à Agenda
        </Link>
      </div>

      <DisponibilidadeForm initialSlots={slots} initialObservacao={observacao} />
    </div>
  );
}
