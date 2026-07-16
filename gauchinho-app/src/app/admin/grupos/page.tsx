import Link from "next/link";
import { fetchGruposList } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { PopularGruposTesteButton } from "@/components/admin/popular-grupos-teste-button";
import { GruposListClient } from "@/components/admin/grupos-list-client";

export default async function GruposAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ modalidade?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const grupos = await fetchGruposList(sp);
  const usuario = await getUsuarioNegocio();
  const showPopular = canEditSettings(usuario?.perfil);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Grupos</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Consórcio — grupos e cotas. Destaque âmbar = prazo em marco de 12 meses (reajuste de crédito).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showPopular ? <PopularGruposTesteButton /> : null}
          <Link
            href="/admin/grupos/sorteios"
            className="text-sm text-amber-600 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
          >
            Sorteios Loteria Federal
          </Link>
          <Link href="/admin/grupos/novo">
            <Button>Novo grupo</Button>
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
