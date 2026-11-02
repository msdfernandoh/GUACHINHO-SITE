import "server-only";
import { graphBase, type MetaAppConfig } from "./config";
// Erros da Meta podem ecoar credenciais. Expor apenas código/subcódigo, nunca payload bruto.
export async function graph<T>(app: MetaAppConfig, path: string, token: string, body?: object): Promise<T> {
    const res = await fetch(graphBase(app) + "/" + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(20000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error)
        throw new Error("Meta: falha na operação (código " + (Number(json.error?.code) || res.status) + ", subcódigo " + (Number(json.error?.error_subcode) || 0) + "). Confira token, permissões e ativos no painel da Meta.");
    return json as T;
}
export async function trocarCodePorToken(code: string, app: MetaAppConfig) { if (!app.appId || !app.appSecret || !app.configId)
    throw new Error("App da Meta incompleto no SaaS."); return graph<{
    access_token: string;
    expires_in?: number;
}>(app, "oauth/access_token", app.appId + "|" + app.appSecret, { client_id: app.appId, client_secret: app.appSecret, code }); }
export type TelefoneMeta = {
    id: string;
    display_phone_number: string;
    verified_name?: string;
    quality_rating?: string;
};
export async function validarAtivos(app: MetaAppConfig, waba: string, phone: string, token: string) {
    const dados = await graph<{
        data: TelefoneMeta[];
    }>(app, waba + "/phone_numbers?fields=id,display_phone_number,verified_name&limit=100", token);
    // Só aceitar ID comprovadamente pertencente à WABA autorizada. Não seguir URLs arbitrárias.
    const telefone = dados.data?.find(p => p.id === phone);
    if (!telefone?.display_phone_number)
        throw new Error("Número não encontrado na WABA informada. Confira os IDs na Meta.");
    return telefone;
}
export async function assinarWaba(app: MetaAppConfig, waba: string, token: string) { const r = await graph<{
    success: boolean;
}>(app, waba + "/subscribed_apps", token, {}); if (r.success !== true)
    throw new Error("A Meta não confirmou a assinatura da WABA."); }
export async function sincronizarCoexistencia(app: MetaAppConfig, phone: string, token: string) { for (const sync_type of ["smb_app_state_sync", "history"])
    await graph(app, phone + "/smb_app_data", token, { messaging_product: "whatsapp", sync_type }); }
export async function enviarMensagem(app: MetaAppConfig, phone: string, token: string, body: object) { const r = await graph<{
    messages?: {
        id: string;
    }[];
}>(app, phone + "/messages", token, { messaging_product: "whatsapp", ...body }); const id = r.messages?.[0]?.id; if (!id)
    throw new Error("A Meta não confirmou o identificador da mensagem."); return id; }
