import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import * as repo from "@/lib/contempladas/repo";
import { getAcesso, listarUsuariosPortal, podeGerenciar } from "@/lib/contempladas/acesso";
import { LoginBox, Shell } from "@/components/contempladas/ui";
import { Painel } from "@/components/contempladas/painel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Painel · Cotas Contempladas" }, robots: { index: false } };

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const a = await getAcesso(tenant.empresaId);
  if (!a)
    return (
      <Shell titulo="Painel" sub="Gerência e vendedores">
        <LoginBox motivo="Entre com o usuário do portal (ou do ERP)." />
      </Shell>
    );
  const gerencia = podeGerenciar(a);
  const empresaId = tenant.empresaId;
  const [reservas, cotas, cfg, stats, propostas, equipe, usuariosErp] = await Promise.all([
    gerencia ? repo.listarReservas(empresaId) : Promise.resolve([]),
    gerencia ? repo.listarCotas(empresaId, { incluirVendidas: true }) : Promise.resolve([]),
    repo.getConfig(empresaId),
    repo.estatisticas(empresaId),
    repo.listarPropostasVendedor(empresaId, gerencia ? null : a.authUserId),
    gerencia ? listarUsuariosPortal(empresaId) : Promise.resolve([]),
    a.papel === "DONO" ? repo.listarUsuariosEnvio(empresaId) : Promise.resolve([]),
  ]);
  const papelTxt = a.papel === "DONO" ? "dono do portal" : a.papel === "GERENTE" ? "gerente" : "vendedor";
  return (
    <Shell titulo="Painel" sub={`${a.nome} · ${papelTxt}`} papel={a.papel}>
      <Painel
        papel={a.papel}
        adicional={a.adicional}
        telefone={a.telefone}
        logoUrl={a.logoUrl}
        reservas={reservas}
        cotas={cotas}
        config={gerencia ? cfg : null}
        stats={stats}
        propostas={propostas}
        equipe={equipe}
        usuariosErp={usuariosErp}
      />
    </Shell>
  );
}
