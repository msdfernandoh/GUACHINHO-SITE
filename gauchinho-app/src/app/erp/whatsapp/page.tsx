import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { getConexaoPorEmpresa } from "@/lib/whatsapp/cloud-api/conexoes";
import { createAdminClient } from "@/lib/supabase/admin";
import WhatsappClient, { type MensagemView } from "./ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ErpWhatsappPage() {
  const access = await requireErpRouteAccess("whatsapp");
  const empresaId = access.empresaAtiva.id;

  const conexao = await getConexaoPorEmpresa(empresaId);

  const admin = createAdminClient();
  const { data: msgs } = await admin
    .from("whatsapp_mensagens")
    .select("id,direcao,contato_numero,contato_nome,tipo,conteudo,template_nome,status,criada_em")
    .eq("empresa_id", empresaId)
    .order("criada_em", { ascending: false })
    .limit(50);

  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID ?? process.env.WHATSAPP_APP_ID ?? "";
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID ?? process.env.WHATSAPP_CONFIG_ID ?? "";
  const graphVersion =
    process.env.NEXT_PUBLIC_WHATSAPP_GRAPH_VERSION ?? process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";

  return (
    <WhatsappClient
      conexao={
        conexao
          ? {
              numero: conexao.numero_exibicao,
              verifiedName: conexao.verified_name,
              status: conexao.status,
              coexistencia: conexao.coexistencia,
            }
          : null
      }
      mensagens={(msgs ?? []) as MensagemView[]}
      meta={{ appId, configId, graphVersion }}
    />
  );
}
