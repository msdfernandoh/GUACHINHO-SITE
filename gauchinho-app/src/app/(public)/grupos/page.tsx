import type { Metadata } from "next";
import { fetchPublicGruposAggregates } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios, isStaff } from "@/lib/auth/permissions";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { getCatalogEmpresaIdFromHeaders } from "@/lib/grupos/resolve-catalog-empresa";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { createClient } from "@/lib/supabase/server";

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

export default async function GruposPublicPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
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
  const leadId = sp.lead_id;
  const isUuid = Boolean(leadId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leadId));
  let leadPrefill: { nome: string; whatsapp: string } | undefined;

  // O identificador vem do card, mas os dados só são lidos após confirmar a
  // sessão e o tenant atual. A URL não carrega nome ou telefone do cliente.
  if (isConsultor && empresaId && isUuid) {
    const supabase = await createClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("nome, whatsapp")
      .eq("id", leadId!)
      .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      .maybeSingle();
    if (lead?.whatsapp) {
      leadPrefill = { nome: lead.nome || "", whatsapp: lead.whatsapp };
    }
  }

  return (
    <GruposPublicClient
      aggregates={aggregates}
      isStaff={staff}
      isConsultor={isConsultor}
      isLoggedIn={Boolean(usuario)}
      gruposSorteio={gruposSorteio}
      canManageSorteios={canManageSorteios}
      leadPrefill={leadPrefill}
    />
  );
}
