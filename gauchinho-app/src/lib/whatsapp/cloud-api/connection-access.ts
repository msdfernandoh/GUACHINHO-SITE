import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAuthorizedAccessErpRoute } from "@/lib/erp/erp-acesso";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { getInstancia } from "./conexoes";
import { getMetaAppConfig } from "./config";
import { lerTokenConexao } from "./connection-token";
export async function autorizarLinkConexao(token: string, origem: string) {
    const c = lerTokenConexao(token);
    const db = createAdminClient();
    const [u, v, e, t] = await Promise.all([db.from("usuarios").select("id").eq("id", c.usuario_id).eq("ativo", true).maybeSingle(), db.from("empresa_usuarios").select("papel_id,erp_modulos_visiveis,papel:papeis(codigo,ativo)").eq("empresa_id", c.empresa_id).eq("usuario_id", c.usuario_id).eq("ativo", true).maybeSingle(), db.from("empresas").select("ativo,status,configuracoes").eq("id", c.empresa_id).maybeSingle(), db.from("whatsapp_conexao_tentativas").select("id,consumido_em").eq("id", c.jti).eq("empresa_id", c.empresa_id).eq("instancia_id", c.instancia_id).eq("usuario_id", c.usuario_id).maybeSingle()]);
    if (u.error || v.error || e.error || t.error || !u.data || !v.data || !e.data?.ativo || e.data.status !== "ativo" || !t.data || t.data.consumido_em)
        throw new Error("Link indisponível ou já utilizado. Reabra pelo ERP.");
    const papel = Array.isArray(v.data.papel) ? v.data.papel[0] : v.data.papel;
    const p = await db.from("papel_permissoes").select("permissao:permissoes(codigo)").eq("papel_id", v.data.papel_id);
    const permissoes = (p.data || []).flatMap(r => { const p = Array.isArray(r.permissao) ? r.permissao[0] : r.permissao; return p ? [p.codigo] : []; });
    if (p.error || !papel?.ativo || !canAuthorizedAccessErpRoute(getErpSistemaConfig(e.data.configuracoes), v.data.erp_modulos_visiveis, "whatsapp", { papelCodigo: papel.codigo, permissoes }))
        throw new Error("Acesso ao WhatsApp não autorizado nesta franquia.");
    const i = await getInstancia(c.empresa_id, c.instancia_id);
    const app = await getMetaAppConfig(i.app_meta_id);
    if (origem !== app.origem || i.revisao !== c.revisao || i.status === "suspenso" || !i.modelo?.ativo || i.modelo.modo === "meta_teste")
        throw new Error("Conexão indisponível. Confira a configuração no SaaS.");
    return { claims: c, instancia: i, app };
}
