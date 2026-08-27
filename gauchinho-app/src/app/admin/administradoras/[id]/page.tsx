import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { Card } from "@/components/ui/form-primitives";
import {
  fetchAdministradoraGlobal,
  fetchEmpresasFranqueadasDaAdministradora,
} from "../actions";

export default async function VisualizarAdministradoraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isPlatformSuperadmin())) redirect("/admin");
  const { id } = await params;
  const administradora = await fetchAdministradoraGlobal(id).catch(() => null);
  if (!administradora) notFound();
  const empresas = await fetchEmpresasFranqueadasDaAdministradora(id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/administradoras" className="text-sm font-semibold text-cyan-700 hover:underline">
          ← Voltar ao catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{administradora.nome}</h1>
        <p className="text-sm text-zinc-500">
          Consulta do cadastro global. Inclusões e alterações são realizadas somente no SaaS.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Dados oficiais</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Nome fantasia" value={administradora.nome_fantasia} />
          <Item label="Razão social" value={administradora.razao_social} />
          <Item label="CNPJ" value={administradora.cnpj} />
          <Item label="Slug" value={administradora.slug} />
          <Item label="Status" value={administradora.status} />
          <Item label="Site" value={administradora.site_url} />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Franquias autorizadas</h2>
        <p className="mb-4 text-sm text-zinc-500">Vínculos publicados pela governança do SaaS.</p>
        {empresas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma franquia vinculada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr><th className="py-2 pr-4">Franquia</th><th className="py-2 pr-4">Slug</th><th className="py-2">Vínculo</th></tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.empresa_id} className="border-t dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{empresa.nome_fantasia}</td>
                    <td className="py-2 pr-4">{empresa.slug}</td>
                    <td className="py-2">{empresa.status_vinculo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value || "—"}</dd></div>;
}
