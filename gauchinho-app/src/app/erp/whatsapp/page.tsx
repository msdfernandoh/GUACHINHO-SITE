import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { listarInstancias } from "@/lib/whatsapp/cloud-api/conexoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
import type { MensagemView } from "@/lib/whatsapp/cloud-api/types";
import WhatsappClient from "./ui";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ErpWhatsappPage({ searchParams }: {
    searchParams: Promise<{
        instancia_id?: string;
    }>;
}) {
    const access = await requireErpRouteAccess("whatsapp");
    const empresa = access.empresaAtiva.id;
    const instancias = await listarInstancias(empresa);
    const sp = await searchParams;
    const selecionada = instancias.find(i => i.id === uuid.safeParse(sp.instancia_id).data) || instancias.find(i => i.status === "conectado") || instancias[0];
    let mensagens: MensagemView[] = [];
    let erro: string | null = null;
    if (selecionada) {
        const r = await createAdminClient().from("whatsapp_mensagens").select("id,instancia_id,direcao,contato_numero,contato_nome,tipo,conteudo,template_nome,status,erro,wa_message_id,criada_em").eq("empresa_id", empresa).eq("instancia_id", selecionada.id).order("criada_em", { ascending: false }).limit(50);
        if (r.error)
            erro = "Não foi possível atualizar o histórico. Tente novamente.";
        else
            mensagens = r.data as MensagemView[];
    }
    return <WhatsappClient instancias={instancias} selecionadaId={selecionada?.id || ""} mensagens={mensagens} erroHistorico={erro}/>;
}
