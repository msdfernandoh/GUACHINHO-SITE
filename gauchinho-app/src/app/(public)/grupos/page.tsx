import type { Metadata } from "next";
import { fetchPublicGruposAggregates } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios, isStaff } from "@/lib/auth/permissions";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { getCatalogEmpresaIdFromHeaders } from "@/lib/grupos/resolve-catalog-empresa";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

export const metadata: Metadata = {
  title: "Tabela de Grupos de Consórcio em Andamento | Gauchinho & Racon",
  description:
    "Consulte grupos de consórcio disponíveis, valores de crédito, parcelas, prazos e modalidades de lance livre e embutido para imóveis, veículos e pesados.",
  keywords: [
    "grupos de consórcio disponíveis",
    "cotas de consórcio",
    "consórcio parcela reduzida",
    "grupo de consórcio imóvel",
    "grupos racon sinop",
  ],
  alternates: { canonical: "/grupos" },
  openGraph: {
    title: "Tabela de Grupos de Consórcio em Andamento",
    description: "Consulte grupos abertos e cotas de consórcio para imóveis, veículos e agronegócio.",
    url: "/grupos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grupos de Consórcio Disponíveis | Gauchinho Consórcios",
    description: "Encontre o grupo ideal com parcelas e prazos planejados.",
  },
};

export default async function GruposPublicPage() {
  const aggregates = await fetchPublicGruposAggregates();
  const usuario = await getUsuarioNegocio();
  const staff = isStaff(usuario?.perfil);
  const tenantContext = await getCurrentTenantContext();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  const canManageSorteios = canManageGruposSorteios(
    usuario?.perfil,
    leadsConfig.srdPodeEditarGrupos,
  );

  const empresaId = await getCatalogEmpresaIdFromHeaders();
  // Mesmo vínculo e permissão exigidos pela API, independentemente do modelo.
  const isConsultor = Boolean(usuario && empresaId &&
    tenantContext.empresaAtiva?.id === empresaId &&
    tenantContext.permissoes.has("gerenciar_propostas"));
  const gruposAutorizados = empresaId
    ? await listGruposAutorizadosForEmpresa(empresaId)
    : [];
  const gruposSorteio = gruposAutorizados.map((g) => ({
    id: g.id,
    codigo_grupo: g.codigo_grupo,
    modalidade: g.modalidade,
    quantidade_cotas_sorteio: g.quantidade_cotas_sorteio ?? null,
  }));

  return (
    <GruposPublicClient
      aggregates={aggregates}
      isStaff={staff}
      isConsultor={isConsultor}
      isLoggedIn={Boolean(usuario)}
      gruposSorteio={gruposSorteio}
      canManageSorteios={canManageSorteios}
    />
  );
}
