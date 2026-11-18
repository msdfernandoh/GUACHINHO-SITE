import type { Metadata } from "next";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { usuarioPodeEnviar } from "@/lib/contempladas/repo";
import { LoginBox, Shell, Card, Sair } from "@/components/contempladas/ui";
import { ImportarCotas } from "@/components/contempladas/importar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Enviar cotas · Contempladas" }, robots: { index: false } };

export default async function Page() {
  const u = await getUsuarioNegocio();
  const pode = u ? await usuarioPodeEnviar(u.id, u.perfil) : false;
  return (
    <Shell titulo="Enviar cotas" sub="Cole a mensagem ou as linhas da planilha">
      {!u ? (
        <LoginBox motivo="O envio exige usuário do ERP com autorização de envio." />
      ) : !pode ? (
        <Card className="mx-auto max-w-md text-center">
          <p className="font-semibold">{u.nome}, seu usuário não tem autorização de envio.</p>
          <p className="mt-1 text-sm text-white/60">Peça ao dono do portal para liberar em Painel → Autorizações.</p>
          <div className="mt-3"><Sair /></div>
        </Card>
      ) : (
        <ImportarCotas usuario={u.nome} />
      )}
    </Shell>
  );
}
