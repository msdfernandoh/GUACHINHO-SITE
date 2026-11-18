import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getAcesso, podeGerenciar } from "@/lib/contempladas/acesso";
import { getConfig } from "@/lib/contempladas/repo";
import { LoginBox, Shell, Card, Sair } from "@/components/contempladas/ui";
import { ImportarCotas } from "@/components/contempladas/importar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Enviar cotas · Contempladas" }, robots: { index: false } };

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const a = await getAcesso(tenant.empresaId);
  const cfg = await getConfig(tenant.empresaId);
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
        <ImportarCotas usuario={a.nome} agioPadrao={{ tipo: cfg.agio_tipo, valor: cfg.agio_valor }} />
      )}
    </Shell>
  );
}
