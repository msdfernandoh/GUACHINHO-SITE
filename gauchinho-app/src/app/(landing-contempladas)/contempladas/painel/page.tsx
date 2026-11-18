import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import * as repo from "@/lib/contempladas/repo";
import { LoginBox, Shell } from "@/components/contempladas/ui";
import { Painel } from "@/components/contempladas/painel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Painel · Cotas Contempladas" }, robots: { index: false } };

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const u = await getUsuarioNegocio();
  if (!u)
    return (
      <Shell titulo="Painel" sub="Reservas, PIX e vendidas">
        <LoginBox motivo="Entre com seu usuário do ERP." />
      </Shell>
    );
  const master = u.perfil === "master";
  const [reservas, cotas, cfg, stats, usuarios] = await Promise.all([
    repo.listarReservas(tenant.empresaId),
    repo.listarCotas(tenant.empresaId, { incluirVendidas: true }),
    repo.getConfig(tenant.empresaId),
    repo.estatisticas(tenant.empresaId),
    master ? repo.listarUsuariosEnvio(tenant.empresaId) : Promise.resolve([]),
  ]);
  return (
    <Shell titulo="Painel" sub={`${u.nome}${master ? " · dono do portal" : ""}`}>
      <Painel reservas={reservas} cotas={cotas} config={cfg} stats={stats} usuarios={usuarios} master={master} />
    </Shell>
  );
}
