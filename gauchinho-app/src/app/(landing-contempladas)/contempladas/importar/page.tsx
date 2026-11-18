import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getAcesso, listarGerentes, podeGerenciar } from "@/lib/contempladas/acesso";
import { getConfig, getConfigGerente } from "@/lib/contempladas/repo";
import { LoginBox, Shell, Card, Sair } from "@/components/contempladas/ui";
import { ImportarCotas } from "@/components/contempladas/importar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Enviar cotas · Contempladas" }, robots: { index: false } };

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const a = await getAcesso(tenant.empresaId);
  const gerentes = a?.papel === "DONO" ? await listarGerentes(tenant.empresaId) : [];
  const cfg = a?.papel === "DONO" || !a ? await getConfig(tenant.empresaId) : await getConfigGerente(tenant.empresaId, a.authUserId);
  return (
    <Shell titulo="Enviar cotas" sub="Cole a mensagem ou as linhas da planilha" papel={a?.papel ?? null}>
      {!a ? (
        <LoginBox motivo="O envio é feito pela gerência do portal." />
      ) : !podeGerenciar(a) ? (
        <Card className="mx-auto max-w-md text-center">
          <p className="font-semibold">{a.nome}, o envio de cotas é feito pela gerência.</p>
          <div className="mt-3"><Sair /></div>
        </Card>
      ) : (
        <ImportarCotas usuario={a.nome} agioPadrao={{ tipo: cfg.agio_tipo, valor: cfg.agio_valor }} agioAuto={{ tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor }} gerentes={gerentes} ehDono={a.papel === "DONO"} />
      )}
    </Shell>
  );
}
