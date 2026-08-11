import { notFound } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { erpModuleEnabled, getErpSistemaConfig } from "@/lib/erp/erp-modulos";
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

const PAGES = { leads: Leads, propostas: Propostas, contratacoes: Contratacoes, vendas: Vendas, grupos: Grupos, comissoes: Comissoes, financeiro: Financeiro, relatorios: Relatorios, metas: Metas, tarefas: Tarefas, usuarios: Usuarios } as const;

export default async function ErpModuloPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  const config = getErpSistemaConfig(empresaAtiva?.configuracoes);
  if (!erpModuleEnabled(config, modulo) || !(modulo in PAGES)) notFound();
  const Page = PAGES[modulo as keyof typeof PAGES] as unknown as React.ComponentType<{
    searchParams: Promise<Record<string, string | undefined>>;
  }>;
  return <Page searchParams={Promise.resolve({})} />;
}
