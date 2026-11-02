import { headers } from "next/headers";
import { autorizarLinkConexao } from "@/lib/whatsapp/cloud-api/connection-access";
import ConectarClient from "./ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar WhatsApp", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ConectarWhatsappPage({ searchParams }: {
    searchParams: Promise<{
        t?: string;
    }>;
}) {
    const { t } = await searchParams;
    let autorizado: Awaited<ReturnType<typeof autorizarLinkConexao>> | null = null;
    let mensagem = "Abra esta página pelo botão Conectar do ERP da franquia.";
    try {
        if (t) {
            const host = (await headers()).get("host");
            autorizado = await autorizarLinkConexao(t, "https://" + host);
        }
    }
    catch (e) {
        mensagem = e instanceof Error ? e.message : "Abra uma nova conexão pelo ERP.";
    }
    if (!autorizado || !t)
        return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Conexão indisponível</h1><p className="mt-4">{mensagem}</p></main>;
    const a = autorizado;
    return <ConectarClient token={t} instancia={{ id: a.instancia.id, nome: a.instancia.nome, numero: a.instancia.numero_celular, coexistencia: a.instancia.coexistencia }} meta={{ appId: a.app.appId, configId: a.app.configId, graphVersion: a.app.graphVersion }} retorno={a.claims.retorno}/>;
}
