import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { fetchCompromissosRange } from "@/app/admin/agenda/actions";
import { fetchMinhaDisponibilidade } from "./actions";
import { DisponibilidadeForm } from "./disponibilidade-form";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/components/admin/admin-contrast";

export default async function AgendaDisponibilidadePage() {
  const u = await requireStaffAdmin();
  const { slots, bloqueios, observacao, modalidadePadrao } = await fetchMinhaDisponibilidade();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59).toISOString();
  const compromissos = await fetchCompromissosRange(from, to, u.id).catch(() => []);
  const datasComCompromisso = [
    ...new Set(
      compromissos
        .filter((c) => c.status !== "cancelado")
        .map((c) => c.data_inicio.slice(0, 10)),
    ),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={adminPageTitleClass}>Configurar disponibilidade</h1>
          <p className={adminPageSubtitleClass}>
            Calendário do mês: verde livre, amarelo com compromisso, vermelho bloqueado.
          </p>
        </div>
        <Link href="/admin/agenda" className="text-sm text-amber-400 hover:underline">
          Voltar à Agenda
        </Link>
      </div>

      <DisponibilidadeForm
        initialSlots={slots}
        initialBloqueios={bloqueios}
        initialObservacao={observacao}
        initialModalidade={modalidadePadrao}
        datasComCompromisso={datasComCompromisso}
      />
    </div>
  );
}
