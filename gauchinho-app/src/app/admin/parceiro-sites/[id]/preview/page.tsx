import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InstitucionalV1Site } from "@/components/parceiro-site/institucional-v1";
import { buildPartnerPublicViewModel } from "@/lib/parceiros/public-site-data";
import {
  canAccessParceiroSitesAdmin,
  fetchParceiroSiteDetalhe,
} from "../../actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Preview site parceiro",
};

export default async function ParceiroSiteAdminPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await canAccessParceiroSitesAdmin();
  if (!allowed) redirect("/admin");

  const { id } = await params;
  let detalhe;
  try {
    detalhe = await fetchParceiroSiteDetalhe(id);
  } catch {
    notFound();
  }

  const { site, organizacao, empresaId } = detalhe;
  if (!organizacao) notFound();

  const vm = buildPartnerPublicViewModel({
    site: {
      id: site.id,
      empresa_id: site.empresa_id,
      organizacao_parceira_id: site.organizacao_parceira_id,
      slug: site.slug,
      nome_site: site.nome_site,
      descricao: site.descricao,
      template_codigo: site.template_codigo,
      status_publicacao: site.status_publicacao,
      canal_principal: site.canal_principal,
      whatsapp_modo: site.whatsapp_modo,
      whatsapp: site.whatsapp,
      branding: site.branding,
      menus: site.menus,
      seo: site.seo,
    },
    org: {
      id: organizacao.id,
      nome_fantasia: organizacao.nome_fantasia,
      logo_url: null,
      telefone: organizacao.telefone,
      whatsapp: organizacao.whatsapp,
      email: organizacao.email,
      instagram: organizacao.instagram,
    },
    empresa: {
      id: empresaId,
      slug: "gauchinho",
      nome: "Gauchinho Consórcios",
      logo_url: null,
      telefone: null,
      whatsapp: null,
      email: null,
    },
    isPreview: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div>
          <Link
            href={`/admin/parceiro-sites/${id}`}
            className="text-sm text-amber-600 hover:underline"
          >
            ← Voltar ao editor
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            Preview autenticado · status {site.status_publicacao} · noindex · não publica · sem
            domínio obrigatório
          </p>
        </div>
      </div>
      <InstitucionalV1Site vm={vm} />
    </div>
  );
}
