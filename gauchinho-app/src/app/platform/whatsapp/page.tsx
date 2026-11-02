import { notFound } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSTANCIA_COLUNAS, type InstanciaView, type ModeloInstancia } from "@/lib/whatsapp/cloud-api/types";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import WhatsappAdmin, { type AppView } from "./ui";
export const dynamic = "force-dynamic";
export default async function WhatsappPlatformPage({ searchParams }: {
    searchParams: Promise<{
        empresa_id?: string;
    }>;
}) {
    if (!await isPlatformSuperadmin())
        notFound();
    const sp = await searchParams;
    const db = createAdminClient();
    const [apps, modelos, instancias, empresas] = await Promise.all([db.from("whatsapp_apps_meta").select("id,nome,app_id,config_id,graph_version,dominio_conexao,ativo,app_secret_cifrado,webhook_verify_token_cifrado").order("nome"), db.from("whatsapp_instancia_modelos").select("*").order("created_at"), db.from("whatsapp_instancias").select(INSTANCIA_COLUNAS).order("created_at", { ascending: false }).limit(500), db.from("empresas").select("id,nome_fantasia,configuracoes").order("nome_fantasia").limit(500)]);
    const erro = [apps, modelos, instancias, empresas].some(r => r.error) ? "Configuração indisponível. Aplique a migration 332_whatsapp_instancias.sql antes de usar esta tela." : null;
    // Nunca serializar ciphertext, token ou segredo para o navegador.
    const publicApps: AppView[] = (apps.data || []).map(a => ({ id: a.id, nome: a.nome, app_id: a.app_id, config_id: a.config_id || "", graph_version: a.graph_version, dominio_conexao: a.dominio_conexao, ativo: a.ativo, secretConfigurado: Boolean(a.app_secret_cifrado), verifyConfigurado: Boolean(a.webhook_verify_token_cifrado) }));
    return <WhatsappAdmin apps={publicApps} modelos={(modelos.data || []) as ModeloInstancia[]} instancias={(instancias.data || []) as unknown as InstanciaView[]} empresas={(empresas.data || []).map(e => ({ id: e.id, nome: e.nome_fantasia, whatsapp: getErpSistemaConfig(e.configuracoes).modulos.includes("whatsapp") }))} empresaInicial={sp.empresa_id || ""} erro={erro}/>;
}
