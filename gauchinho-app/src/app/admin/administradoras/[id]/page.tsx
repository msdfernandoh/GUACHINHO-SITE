import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { Card } from "@/components/ui/form-primitives";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getAdministradoraAutorizadaById } from "@/lib/administradoras/service";

export default async function VisualizarAdministradoraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isPlatformSuperadmin())) redirect("/admin");
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const administradora = await getAdministradoraAutorizadaById(empresaAtiva.id, id).catch(() => null);
  if (!administradora) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/administradoras" className="text-sm font-semibold text-cyan-700 hover:underline">
          ← Voltar ao catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{administradora.nome}</h1>
        <p className="text-sm text-zinc-500">
          Consulta da concessão ativa para {empresaAtiva.nome_fantasia}. Inclusões e alterações são realizadas somente no SaaS.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Dados oficiais</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Nome fantasia" value={administradora.nome_fantasia} />
          <Item label="Slug" value={administradora.slug} />
          <Item label="Status" value={administradora.status} />
          <Item label="Site" value={administradora.site_url} />
          <Item label="Concessão da franquia" value={administradora.concessao.status} />
        </dl>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value || "—"}</dd></div>;
}
