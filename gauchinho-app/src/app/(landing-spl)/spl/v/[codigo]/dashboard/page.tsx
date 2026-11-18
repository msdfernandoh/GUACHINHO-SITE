import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { acessoDashboardVendedorValido } from "@/lib/spl/acesso-dashboard-vendedor";
import { caminhoPortfolio } from "@/lib/spl/links";
import { listarClientes, vendedorPorCodigo } from "@/lib/spl/repo";
import { SplDashboardImobiliaria } from "@/components/spl/spl-dashboard-imobiliaria";
import { SplShell } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard do vendedor · SPL",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DashboardVendedorPage({ params, searchParams }: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ acesso?: string }>;
}) {
  const [{ codigo }, { acesso }, tenant] = await Promise.all([params, searchParams, getResolvedTenant()]);
  if (!tenant || !acesso) notFound();
  const vinculo = await vendedorPorCodigo(tenant.empresaId, codigo);
  if (!vinculo) notFound();
  const { vendedor, imobiliaria } = vinculo;
  if (imobiliaria.empresa_id !== tenant.empresaId || !acessoDashboardVendedorValido(imobiliaria.token_painel, vendedor.id, acesso)) notFound();
  const clientes = await listarClientes(imobiliaria.id, { empresaId: tenant.empresaId, vendedorId: vendedor.id });

  return (
    <SplShell>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <a href={caminhoPortfolio(imobiliaria.nome, vendedor.codigo)} className="inline-flex min-h-[48px] items-center rounded-xl bg-[#153E90] px-4 py-2 font-bold text-white shadow-md hover:bg-[#12284C]">← Voltar ao portfólio</a>
        <h1 className="text-2xl font-black text-[#0A1931]">{vendedor.nome}</h1>
        <SplDashboardImobiliaria clientes={clientes} vendedores={[vendedor]} modelo={imobiliaria.modelo_parceria} individual={vendedor} />
      </main>
    </SplShell>
  );
}
