import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { CrmMateriaisLibrary } from "@/components/admin/crm/crm-materiais-library";
import { ArrowLeft, LayoutDashboard, Kanban } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export const dynamic = "force-dynamic";

export default async function CrmMateriaisPage() {
  await requireStaffAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/crm"
            className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Dashboard CRM
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">Materiais & Scripts de Abordagem</h1>
          <p className="text-xs text-zinc-400">
            Roteiros de vendas para WhatsApp, contorno de objeções frequentes e convites para eventos comerciais
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/crm">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/crm/pipeline">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <Kanban className="h-4 w-4" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      <CrmMateriaisLibrary />
    </div>
  );
}
