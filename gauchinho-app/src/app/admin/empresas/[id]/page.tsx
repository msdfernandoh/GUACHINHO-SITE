import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/form-primitives";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { getSitePublicoConfig } from "@/lib/tenant/site-public-config";
import { fetchEmpresaComDetalhes } from "../actions";
import { fetchEmpresaAdministradorasAction } from "../administradoras-actions";

export default async function VisualizarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isPlatformSuperadmin())) redirect("/admin");
  const { id } = await params;
  const detalhes = await fetchEmpresaComDetalhes(id).catch(() => null);
  if (!detalhes) notFound();
  const { empresa, branding, dominios } = detalhes;
  const concessoes = await fetchEmpresaAdministradorasAction(id);
  const erp = getErpSistemaConfig(empresa.configuracoes);
  const site = getSitePublicoConfig(empresa.configuracoes);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/empresas" className="text-sm font-semibold text-cyan-700 hover:underline">← Voltar às empresas</Link>
        <h1 className="mt-2 text-2xl font-bold">{empresa.nome_fantasia}</h1>
        <p className="text-sm text-zinc-500">Consulta do cadastro SaaS. Alterações são feitas exclusivamente na Plataforma SaaS.</p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Identificação</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Razão social" value={empresa.razao_social} />
          <Item label="CNPJ" value={empresa.cnpj} />
          <Item label="Slug" value={empresa.slug} />
          <Item label="Status" value={empresa.status} />
          <Item label="Ativa" value={empresa.ativo ? "Sim" : "Não"} />
          <Item label="Site operacional" value={site.operacionalHabilitado ? "Habilitado" : "Desabilitado"} />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Recursos publicados</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label="ERP" value={erp.habilitado ? "Habilitado" : "Desabilitado"} />
          <Item label="Módulos ERP" value={erp.modulos.length ? erp.modulos.join(", ") : "Nenhum"} />
          <Item label="Modelo / nome do site" value={branding?.nome_site} />
          <Item label="Status do site" value={branding?.status_publicacao} />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Administradoras autorizadas</h2>
        {concessoes.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma administradora vinculada.</p> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2 pr-4">Administradora</th><th className="py-2 pr-4">Status</th><th className="py-2">Código da franquia</th></tr></thead>
            <tbody>{concessoes.map((v) => <tr key={v.id} className="border-t dark:border-zinc-800"><td className="py-2 pr-4 font-medium">{v.administradora.nome}</td><td className="py-2 pr-4">{v.status}</td><td className="py-2">{v.codigo_franquia || "—"}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Domínios publicados</h2>
        {dominios.length === 0 ? <p className="text-sm text-zinc-500">Nenhum domínio cadastrado.</p> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2 pr-4">Domínio</th><th className="py-2 pr-4">Tipo</th><th className="py-2 pr-4">Principal</th><th className="py-2">DNS</th></tr></thead>
            <tbody>{dominios.map((d) => <tr key={d.id} className="border-t dark:border-zinc-800"><td className="py-2 pr-4 font-mono">{d.valor}</td><td className="py-2 pr-4">{d.tipo}</td><td className="py-2 pr-4">{d.principal ? "Sim" : "Não"}</td><td className="py-2">{d.verificado ? "Verificado" : "Pendente"}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value || "—"}</dd></div>;
}
