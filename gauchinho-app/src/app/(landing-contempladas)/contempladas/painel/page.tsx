import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import * as repo from "@/lib/contempladas/repo";
import { getAcesso, listarGerentes, listarUsuariosPortal, meusDados, podeGerenciar, situacaoCadastro } from "@/lib/contempladas/acesso";
import { LoginBox, Sair, Shell } from "@/components/contempladas/ui";
import { Painel } from "@/components/contempladas/painel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Painel · Cotas Contempladas" }, robots: { index: false } };

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const a = await getAcesso(tenant.empresaId);
  if (!a) {
    const sit = await situacaoCadastro(tenant.empresaId);
    return (
      <Shell titulo="Painel" sub="Administradores de cotas e revendas">
        {sit && sit.status !== "ATIVO" ? (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-3xl">⏳</p>
            <p className="font-bold text-amber-900">{sit.status === "RECUSADO" ? "Cadastro não aprovado" : "Cadastro em aprovação"}</p>
            <p className="mt-1 text-sm text-amber-900/80">{sit.status === "RECUSADO" ? "Fale com o responsável pelo portal." : `${sit.nome}, seu acesso será liberado após a aprovação.`}</p>
            <div className="mt-3"><Sair /></div>
          </div>
        ) : (
          <>
            <LoginBox motivo="Entre com o usuário do portal (ou do ERP)." />
            <p className="mt-4 text-center text-sm text-slate-500">Ainda não tem acesso? <a className="font-semibold text-[#0047bb] underline" href="/contempladas/solicitar">Solicitar acesso</a></p>
          </>
        )}
      </Shell>
    );
  }
  const gerencia = podeGerenciar(a);
  const empresaId = tenant.empresaId;
  // Gerente vê só as cotas e reservas da unidade dele; o dono vê todas.
  const meuEscopo = a.papel === "DONO" ? undefined : a.authUserId;
  const [reservas, cotas, cfg, stats, propostas, equipe, usuariosErp, vendas, dados] = await Promise.all([
    gerencia ? repo.listarReservas(empresaId, meuEscopo) : Promise.resolve([]),
    gerencia ? repo.listarCotas(empresaId, { incluirVendidas: true, dono: meuEscopo }) : Promise.resolve([]),
    a.papel === "DONO" ? repo.getConfig(empresaId) : repo.getConfigGerente(empresaId, a.authUserId),
    repo.estatisticas(empresaId),
    repo.listarPropostasVendedor(empresaId, gerencia ? null : a.authUserId),
    gerencia ? listarUsuariosPortal(empresaId) : Promise.resolve([]),
    a.papel === "DONO" ? repo.listarUsuariosEnvio(empresaId) : Promise.resolve([]),
    gerencia ? repo.resumoVendas(empresaId, meuEscopo) : Promise.resolve(null),
    meusDados(empresaId, a),
  ]);
  // Dono vê e edita a configuração de cada administrador de cotas.
  const configsAdmins =
    a.papel === "DONO"
      ? await Promise.all(
          (await listarGerentes(empresaId)).map(async (g) => ({ authUserId: g.authUserId, nome: g.nome, cfg: await repo.getConfigGerente(empresaId, g.authUserId) })),
        )
      : [];
  const papelTxt = a.papel === "DONO" ? "dono do portal" : a.papel === "GERENTE" ? "administrador de cotas" : "revenda";
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
        vendas={vendas}
        dados={dados}
        configsAdmins={configsAdmins}
        origem={a.origem}
      />
    </Shell>
  );
}
