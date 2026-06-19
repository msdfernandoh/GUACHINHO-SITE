import Link from "next/link";
import { fetchLeadsKanban } from "../actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { LeadKanban } from "@/components/admin/crm/lead-kanban";

export default async function LeadsFunilPage() {
  await requireStaffAdmin();
  const leads = await fetchLeadsKanban();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-sm text-amber-400 hover:underline">
            ← Lista de leads
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">Funil comercial</h1>
          <p className="text-sm text-zinc-500">Altere o status pelo seletor em cada card</p>
        </div>
      </div>
      <LeadKanban leads={leads} />
    </div>
  );
}
