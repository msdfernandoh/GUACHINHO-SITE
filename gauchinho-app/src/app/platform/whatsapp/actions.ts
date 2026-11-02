"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential } from "@/lib/automacoes/robos/cryptoService";
import { getMetaAppConfig, invalidarConfigWhatsapp } from "@/lib/whatsapp/cloud-api/config";
import { getInstancia, salvarConexao, tokenDaInstancia } from "@/lib/whatsapp/cloud-api/conexoes";
import { assinarWaba, validarAtivos, graph, type TelefoneMeta } from "@/lib/whatsapp/cloud-api/client";
import { uuid, metaId, numeroE164, origemConexao } from "@/lib/whatsapp/cloud-api/validation";
export type WhatsappFormState = {
    status: "IDLE" | "SUCCESS" | "ERROR";
    message: string;
};
const str = (f: FormData, k: string) => String(f.get(k) || "").trim();
const bool = (f: FormData, k: string) => f.get(k) === "on";
async function autorizado() { if (!await isPlatformSuperadmin())
    throw new Error("Acesso restrito ao Platform Superadmin."); const u = await getUsuarioNegocio(); if (!u)
    throw new Error("Sessão inválida."); return u; }
async function audit(usuario: string, acao: string, tipo: string, id: string, campos: string[]) { const { error } = await createAdminClient().from("plataforma_auditoria").insert({ usuario_id: usuario, acao, entidade_tipo: tipo, entidade_id: id, campos_alterados: campos }); if (error)
    throw new Error("Alteração realizada; registro da autoria pendente. Confira a auditoria."); }
async function executar(f: () => Promise<string>): Promise<WhatsappFormState> { try {
    const message = await f();
    invalidarConfigWhatsapp();
    revalidatePath("/platform/whatsapp");
    revalidatePath("/erp/whatsapp");
    return { status: "SUCCESS", message };
}
catch (e) {
    return { status: "ERROR", message: e instanceof z.ZodError ? "Confira os campos obrigatórios e o formato dos IDs." : e instanceof Error ? e.message : "Não foi possível concluir a operação." };
} }
export async function salvarApp(_s: WhatsappFormState, f: FormData) {
    return executar(async () => {
        const u = await autorizado();
        const id = str(f, "id");
        const db = createAdminClient();
        const appId = metaId.parse(str(f, "app_id"));
        const secret = str(f, "app_secret");
        const verify = str(f, "verify_token");
        const data = { nome: z.string().min(2).max(120).parse(str(f, "nome")), app_id: appId, config_id: metaId.parse(str(f, "config_id")), graph_version: z.string().regex(/^v[0-9]{2}\.[0-9]+$/).parse(str(f, "graph_version")), dominio_conexao: new URL(origemConexao(str(f, "dominio_conexao"))).hostname, ativo: bool(f, "ativo"), updated_at: new Date().toISOString(), ...(secret ? { app_secret_cifrado: encryptCredential(z.string().max(2000).parse(secret)) } : {}), ...(verify ? { webhook_verify_token_cifrado: encryptCredential(z.string().min(8).max(2000).parse(verify)) } : {}) };
        if (id) {
            uuid.parse(id);
            const old = await db.from("whatsapp_apps_meta").select("app_id").eq("id", id).single();
            if (old.error)
                throw new Error("App inexistente.");
            if (old.data.app_id !== appId) {
                const used = await db.from("whatsapp_instancias").select("id", { count: "exact", head: true }).eq("app_meta_id", id);
                if (used.error || used.count)
                    throw new Error("App em uso: preserve o App ID e cadastre outro app.");
            }
        }
        else if (!secret || !verify)
            throw new Error("Informe App Secret e token de verificação ao cadastrar o app.");
        const r = id ? await db.from("whatsapp_apps_meta").update(data).eq("id", id).select("id").single() : await db.from("whatsapp_apps_meta").insert(data).select("id").single();
        if (r.error)
            throw new Error("Não foi possível salvar o app. Confira se o App ID já foi cadastrado.");
        await audit(u.id, "WHATSAPP_APP_SALVAR", "whatsapp_apps_meta", r.data.id, Object.keys(data));
        return "App salvo. Configure o callback e os domínios indicados na Meta.";
    });
}
export async function importarAppAmbiente(_s: WhatsappFormState, _f: FormData) {
    void _s; void _f; return executar(async () => { const u = await autorizado(); const db = createAdminClient(); const exists = await db.from("whatsapp_apps_meta").select("id", { count: "exact", head: true }); if (exists.error || exists.count)
    throw new Error("Importação disponível somente antes do primeiro cadastro."); const app = await getMetaAppConfig(); if (!app.appId || !app.appSecret || !app.configId || !app.verifyToken)
    throw new Error("Variáveis de ambiente incompletas."); const r = await db.from("whatsapp_apps_meta").insert({ nome: "App WhatsApp da plataforma", app_id: app.appId, config_id: app.configId, graph_version: app.graphVersion, dominio_conexao: new URL(app.origem).hostname, app_secret_cifrado: encryptCredential(app.appSecret), webhook_verify_token_cifrado: encryptCredential(app.verifyToken) }).select("id").single(); if (r.error)
    throw new Error("Falha ao importar configuração."); await audit(u.id, "WHATSAPP_APP_IMPORTAR", "whatsapp_apps_meta", r.data.id, ["credenciais_importadas"]); return "Configuração importada do servidor com segredos cifrados."; }); }
export async function salvarModelo(_s: WhatsappFormState, f: FormData) {
    return executar(async () => {
        const u = await autorizado();
        const db = createAdminClient();
        const id = str(f, "id");
        const modo = z.enum(["coexistencia", "cloud_api", "meta_teste"]).parse(str(f, "modo"));
        const limite = str(f, "limite");
        const data = { nome: z.string().min(2).max(120).parse(str(f, "nome")), descricao: z.string().max(1000).parse(str(f, "descricao")) || null, modo, coexistencia: modo === "coexistencia", permite_templates: bool(f, "permite_templates"), permite_atendimento: bool(f, "permite_atendimento"), limite_mensagens_mes: limite ? z.number().int().positive().parse(Number(limite)) : null, ativo: bool(f, "ativo") };
        if (id) {
            uuid.parse(id);
            const old = await db.from("whatsapp_instancia_modelos").select("modo").eq("id", id).single();
            if (old.error)
                throw new Error("Modelo inexistente.");
            if (old.data.modo !== modo) {
                const used = await db.from("whatsapp_instancias").select("id", { count: "exact", head: true }).eq("modelo_id", id);
                if (used.error || used.count)
                    throw new Error("Modelo em uso: crie outro modelo para mudar o modo de conexão.");
            }
        }
        const r = id ? await db.from("whatsapp_instancia_modelos").update(data).eq("id", id).select("id").single() : await db.from("whatsapp_instancia_modelos").insert(data).select("id").single();
        if (r.error)
            throw new Error("Falha ao salvar modelo.");
        await audit(u.id, "WHATSAPP_MODELO_SALVAR", "whatsapp_instancia_modelos", r.data.id, Object.keys(data));
        return "Modelo salvo.";
    });
}
export async function excluirModelo(_s: WhatsappFormState, f: FormData) { return executar(async () => { const u = await autorizado(); const id = uuid.parse(str(f, "id")); const r = await createAdminClient().from("whatsapp_instancia_modelos").delete().eq("id", id).select("id").single(); if (r.error)
    throw new Error("Modelo em uso ou inexistente. Para preservar instâncias, inative o modelo."); await audit(u.id, "WHATSAPP_MODELO_EXCLUIR", "whatsapp_instancia_modelos", id, ["exclusao"]); return "Modelo sem uso excluído."; }); }
export async function salvarInstancia(_s: WhatsappFormState, f: FormData) {
    return executar(async () => {
        const u = await autorizado();
        const db = createAdminClient();
        const empresa = uuid.parse(str(f, "empresa_id"));
        const app = uuid.parse(str(f, "app_meta_id"));
        const modelo = uuid.parse(str(f, "modelo_id"));
        const [e, a, m] = await Promise.all([db.from("empresas").select("id").eq("id", empresa).single(), db.from("whatsapp_apps_meta").select("id").eq("id", app).eq("ativo", true).single(), db.from("whatsapp_instancia_modelos").select("id,coexistencia").eq("id", modelo).eq("ativo", true).single()]);
        if (e.error || a.error || m.error)
            throw new Error("Selecione empresa, app ativo e modelo ativo válidos.");
        const data = { empresa_id: empresa, app_meta_id: app, modelo_id: modelo, nome: z.string().min(2).max(120).parse(str(f, "nome")), numero_celular: numeroE164(str(f, "numero_celular")), coexistencia: m.data.coexistencia };
        const id = str(f, "id");
        if (id) {
            const i = await getInstancia(empresa, uuid.parse(id));
            if (i.status === "conectado" || i.status === "suspenso" || i.token_cifrado)
                throw new Error("Desconecte a instância antes de alterar app, modelo ou número.");
            const r = await db.from("whatsapp_instancias").update({ ...data, revisao: i.revisao + 1, updated_at: new Date().toISOString() }).eq("empresa_id", empresa).eq("id", id).eq("revisao", i.revisao).select("id").single();
            if (r.error)
                throw new Error("Instância alterada em outra sessão. Atualize a tela.");
            await audit(u.id, "WHATSAPP_INSTANCIA_EDITAR", "whatsapp_instancias", id, Object.keys(data));
        }
        else {
            const r = await db.from("whatsapp_instancias").insert(data).select("id").single();
            if (r.error)
                throw new Error("Falha ao criar instância.");
            await audit(u.id, "WHATSAPP_INSTANCIA_CRIAR", "whatsapp_instancias", r.data.id, Object.keys(data));
        }
        return "Instância salva. Libere o módulo WhatsApp para a franquia quando necessário.";
    });
}
export async function acaoInstancia(_s: WhatsappFormState, f: FormData) {
    return executar(async () => {
        const u = await autorizado();
        const db = createAdminClient();
        const empresa = uuid.parse(str(f, "empresa_id"));
        const id = uuid.parse(str(f, "id"));
        const i = await getInstancia(empresa, id);
        const acao = z.enum(["suspender", "desconectar", "reativar", "testar", "inativar"]).parse(str(f, "acao"));
        if (acao === "testar") {
            const app = await getMetaAppConfig(i.app_meta_id);
            if (!i.phone_number_id)
                throw new Error("Conecte ou configure o número antes de testar.");
            const t = await graph<TelefoneMeta>(app, i.phone_number_id + "?fields=display_phone_number,quality_rating", tokenDaInstancia(i));
            return "A Meta confirmou o número " + t.display_phone_number + ". Qualidade: " + (t.quality_rating || "não informada") + ". Isso não confirma entrega de mensagens.";
        }
        const patch = acao === "suspender" ? { status: "suspenso" } : acao === "inativar" ? { status: "desconectado", ativo: false, token_cifrado: null, waba_id: null, phone_number_id: null } : acao === "reativar" ? { status: i.token_cifrado ? "conectado" : "aguardando_conexao" } : { status: "desconectado", token_cifrado: null, token_expira_em: null, waba_id: null, phone_number_id: null, numero_exibicao: null, verified_name: null, conectado_em: null, conectado_por_id: null, ultimo_erro: null, alerta_numero: null, destinatarios_teste: [] };
        const r = await db.from("whatsapp_instancias").update({ ...patch, revisao: i.revisao + 1, updated_at: new Date().toISOString() }).eq("empresa_id", empresa).eq("id", id).eq("revisao", i.revisao).select("id").single();
        if (r.error)
            throw new Error("A instância mudou. Atualize antes de repetir.");
        await audit(u.id, "WHATSAPP_" + acao.toUpperCase(), "whatsapp_instancias", id, Object.keys(patch));
        return acao === "desconectar" ? "Desconectada do ERP; histórico preservado. A revogação do acesso na Meta é feita no Gerenciador de Negócios." : "Instância atualizada.";
    });
}
export async function configurarTesteMeta(_s: WhatsappFormState, f: FormData) {
    return executar(async () => {
        const u = await autorizado();
        const empresa = uuid.parse(str(f, "empresa_id"));
        const id = uuid.parse(str(f, "id"));
        const i = await getInstancia(empresa, id);
        if (i.modelo?.modo !== "meta_teste" || !i.modelo.ativo || i.status === "suspenso")
            throw new Error("Selecione uma instância ativa do modelo Teste Meta.");
        const app = await getMetaAppConfig(i.app_meta_id);
        const waba = metaId.parse(str(f, "waba_id"));
        const phone = metaId.parse(str(f, "phone_number_id"));
        const token = z.string().min(20).max(4000).parse(str(f, "access_token"));
        const para = str(f, "destinatarios").split(/[;,\n]+/).map(v => numeroE164(v.trim()).slice(1));
        if (!para.length || para.length > 5)
            throw new Error("Informe de um a cinco destinatários autorizados no painel da Meta.");
        const expira = new Date(z.iso.datetime({ offset: true }).parse(str(f, "token_expira_em")));
        if (!Number.isFinite(expira.getTime()) || expira.getTime() <= Date.now())
            throw new Error("Informe a validade futura do token de teste.");
        const t = await validarAtivos(app, waba, phone, token);
        await assinarWaba(app, waba, token);
        const alerta = await salvarConexao({ instancia: i, waba, phone, token, numero: t.display_phone_number, nome: t.verified_name, expira: expira.toISOString(), usuario: u.id });
        const r = await createAdminClient().from("whatsapp_instancias").update({ destinatarios_teste: [...new Set(para)] }).eq("empresa_id", empresa).eq("id", id).eq("revisao", i.revisao + 1);
        if (r.error)
            throw new Error("Número conectado; destinatários pendentes de configuração.");
        await audit(u.id, "WHATSAPP_TESTE_META_CONFIGURAR", "whatsapp_instancias", id, ["token_substituido", "destinatarios_teste", "phone_number_id"]);
        return "Número de teste configurado. Envie hello_world pelo ERP e aguarde os eventos reais de entrega e resposta." + (alerta ? " " + alerta : "");
    });
}
export async function alterarModulo(_s: WhatsappFormState, f: FormData) { return executar(async () => { await autorizado(); const db = await createClient(); const { error } = await db.rpc("rpc_platform_whatsapp_modulo", { p_empresa: uuid.parse(str(f, "empresa_id")), p_habilitar: str(f, "habilitar") === "true" }); if (error)
    throw new Error("Falha ao alterar módulo. Confira se o ERP da franquia está habilitado."); return "Módulo WhatsApp atualizado. Os acessos individuais continuam seguindo os papéis da franquia."; }); }
