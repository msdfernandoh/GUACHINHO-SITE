import { notFound } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { erpModuleEnabled, getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { erpOperationalRouteEnabled } from "@/lib/erp/erp-operational";
import Leads from "@/app/admin/leads/page";
import Propostas from "@/app/admin/propostas/page";
import Contratacoes from "@/app/admin/contratacoes/page";
import Vendas from "@/app/admin/vendas/page";
import Grupos from "@/app/admin/grupos/page";
import Comissoes from "@/app/admin/comissoes/page";
import Financeiro from "@/app/admin/financeiro/page";
import Relatorios from "@/app/admin/relatorios/page";
import Metas from "@/app/admin/metas/page";
import Tarefas from "@/app/admin/tarefas/page";
import Usuarios from "@/app/admin/usuarios/page";
import Participantes from "@/app/admin/participantes/page";
import { ErpClientesPage, ErpLancesPage, ErpRegrasComissaoPage, ErpRepasseFranquiaPage } from "@/components/erp/erp-operational-pages";
import { ErpAssembleiasPage } from "@/components/erp/erp-assembleias-page";
import ContasPagar from "@/app/erp/contas-pagar/page";
import { canAccessErpRoute } from "@/lib/erp/erp-acesso";

const PAGES = { leads: Leads, propostas: Propostas, contratacoes: Contratacoes, vendas: Vendas, grupos: Grupos, comissoes: Comissoes, financeiro: Financeiro, relatorios: Relatorios, metas: Metas, tarefas: Tarefas, usuarios: Usuarios } as const;
const OPERATIONAL_PAGES = { clientes: ErpClientesPage, consultores: Participantes, lances: ErpLancesPage, assembleias: ErpAssembleiasPage, "regras-comissao": ErpRegrasComissaoPage, "repasse-franquia": ErpRepasseFranquiaPage, "contas-pagar": ContasPagar } as const;

export default async function ErpModuloPage({ params, searchParams }: { params: Promise<{ modulo: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { modulo } = await params;
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  const config = getErpSistemaConfig(empresaAtiva?.configuracoes);
  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaAtiva?.id);
  const isBase = modulo in PAGES && erpModuleEnabled(config, modulo);
  const isOperational = modulo in OPERATIONAL_PAGES && erpOperationalRouteEnabled(config, modulo);
  if ((!isBase && !isOperational) || !canAccessErpRoute(config, vinculo?.erp_modulos_visiveis, modulo)) notFound();
  const Page = (isBase ? PAGES[modulo as keyof typeof PAGES] : OPERATIONAL_PAGES[modulo as keyof typeof OPERATIONAL_PAGES]) as unknown as React.ComponentType<{
    searchParams: Promise<Record<string, string | undefined>>;
  }>;
  return <Page searchParams={searchParams} />;
}
