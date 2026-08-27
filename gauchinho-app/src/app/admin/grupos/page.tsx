import Link from "next/link";
import { fetchGruposList } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { GruposListClient } from "@/components/admin/grupos-list-client";

export default async function GruposAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ modalidade?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const grupos = await fetchGruposList(sp);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Grupos</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Catálogo oficial em somente leitura. Alterações estruturais são feitas no SaaS; configurações da franquia ficam no ERP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/grupos/sorteios"
            className="text-sm text-amber-600 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
          >
            Sorteios Loteria Federal
          </Link>
        </div>
      </div>
      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/90"
      >
        <div>
          <Label>Modalidade</Label>
          <Select name="modalidade" defaultValue={sp.modalidade ?? ""}>
            <option value="">Todas</option>
            {MODALIDADES_GRUPO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Input name="status" defaultValue={sp.status ?? ""} />
        </div>
        <div>
          <Label>Código</Label>
          <Input name="q" defaultValue={sp.q ?? ""} />
        </div>
        <Button type="submit" size="sm" className="self-end">
          Filtrar
        </Button>
      </form>
      <GruposListClient grupos={grupos} />
    </div>
  );
}
