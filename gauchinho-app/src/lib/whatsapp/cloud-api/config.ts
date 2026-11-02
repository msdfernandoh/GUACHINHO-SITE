import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential } from "@/lib/automacoes/robos/cryptoService";
import { origemConexao } from "./validation";
export type MetaAppConfig = {
    id: string | null;
    appId: string;
    appSecret: string;
    configId: string;
    graphVersion: string;
    verifyToken: string;
    origem: string;
};
export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v26.0";
let cache: {
    ate: number;
    apps: MetaAppConfig[];
} | null = null;
export function invalidarConfigWhatsapp() { cache = null; }
function envConfig(): MetaAppConfig { return { id: null, appId: process.env.WHATSAPP_APP_ID || "", appSecret: process.env.WHATSAPP_APP_SECRET || "", configId: process.env.WHATSAPP_CONFIG_ID || "", graphVersion: WHATSAPP_GRAPH_VERSION, verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "", origem: origemConexao(process.env.WHATSAPP_DOMINIO_CONEXAO || "admin.gauchinhoconsorcios.com.br") }; }
export async function getMetaApps(): Promise<MetaAppConfig[]> {
    if (cache && cache.ate > Date.now())
        return cache.apps;
    const { data, error } = await createAdminClient().from("whatsapp_apps_meta").select("id,app_id,app_secret_cifrado,config_id,graph_version,webhook_verify_token_cifrado,dominio_conexao").eq("ativo", true);
    if (error && !["42P01", "PGRST205"].includes(error.code))
        throw new Error("Não foi possível carregar a configuração WhatsApp.");
    const fallback = envConfig();
    const apps = (data || []).map(r => { const same = r.app_id === fallback.appId; return { id: r.id, appId: r.app_id, appSecret: r.app_secret_cifrado ? decryptCredential(r.app_secret_cifrado) : same ? fallback.appSecret : "", configId: r.config_id || (same ? fallback.configId : ""), graphVersion: r.graph_version, verifyToken: r.webhook_verify_token_cifrado ? decryptCredential(r.webhook_verify_token_cifrado) : same ? fallback.verifyToken : "", origem: origemConexao(r.dominio_conexao) }; });
    // Fallback somente quando nenhum app foi cadastrado; app inativo nunca é reativado por env.
    if (!apps.length) {
        const all = error ? null : await createAdminClient().from("whatsapp_apps_meta").select("id", { count: "exact", head: true });
        if (!all || all.count === 0)
            apps.push(fallback);
    }
    cache = { ate: Date.now() + 15000, apps };
    return apps;
}
export async function getMetaAppConfig(id?: string | null): Promise<MetaAppConfig> { const apps = await getMetaApps(); const app = id ? apps.find(a => a.id === id) : apps.length === 1 ? apps[0] : undefined; if (!app)
    throw new Error("Selecione um app da Meta ativo e configurado."); return app; }
export function graphBase(app: MetaAppConfig) { return "https://graph.facebook.com/" + app.graphVersion; }
