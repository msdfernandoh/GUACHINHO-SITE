import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { getInstancia, salvarConexao } from "@/lib/whatsapp/cloud-api/conexoes";
import { getMetaAppConfig } from "@/lib/whatsapp/cloud-api/config";
import { autorizarLinkConexao } from "@/lib/whatsapp/cloud-api/connection-access";
import { trocarCodePorToken, validarAtivos, assinarWaba, sincronizarCoexistencia } from "@/lib/whatsapp/cloud-api/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaId, uuid } from "@/lib/whatsapp/cloud-api/validation";
export const runtime = "nodejs";
const schema = z.object({ t: z.string().max(3000).optional(), instancia_id: uuid, code: z.string().min(1).max(4000), waba_id: metaId, phone_number_id: metaId });
export async function POST(request: Request) {
    let tentativa: Awaited<ReturnType<typeof getInstancia>> | null = null;
    try {
        const b = schema.parse(await request.json());
        let instancia, app, usuario;
        if (b.t) {
            const host = (await headers()).get("host");
            const link = await autorizarLinkConexao(b.t, "https://" + host);
            if (b.instancia_id !== link.instancia.id)
                throw new Error("Instância inválida.");
            instancia = link.instancia;
            app = link.app;
            usuario = link.claims.usuario_id;
            const { data, error } = await createAdminClient().from("whatsapp_conexao_tentativas").update({ consumido_em: new Date().toISOString() }).eq("id", link.claims.jti).is("consumido_em", null).gt("expira_em", new Date().toISOString()).select("id");
            if (error || !data?.length)
                throw new Error("Link expirado ou já utilizado.");
        }
        else {
            let a;
            try {
                a = await requireErpRouteAccess("whatsapp");
            }
            catch {
                return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
            }
            instancia = await getInstancia(a.empresaAtiva.id, b.instancia_id);
            app = await getMetaAppConfig(instancia.app_meta_id);
            usuario = a.usuario.id;
        }
        if (instancia.status === "suspenso" || instancia.status === "conectado" || !instancia.modelo?.ativo || instancia.modelo.modo === "meta_teste")
            throw new Error("Instância indisponível para conexão.");
        tentativa = instancia;
        const { access_token, expires_in } = await trocarCodePorToken(b.code, app);
        if (!access_token)
            throw new Error("A Meta não retornou um token de acesso.");
        const phone = await validarAtivos(app, b.waba_id, b.phone_number_id, access_token);
        await assinarWaba(app, b.waba_id, access_token);
        let aviso: string | null = null;
        if (instancia.coexistencia) {
            try {
                await sincronizarCoexistencia(app, b.phone_number_id, access_token);
            }
            catch {
                aviso = "Conectado, mas a sincronização de contatos/histórico não foi confirmada. Confira o compartilhamento na Meta.";
            }
        }
        const alerta = await salvarConexao({ instancia, waba: b.waba_id, phone: b.phone_number_id, token: access_token, numero: phone.display_phone_number, nome: phone.verified_name, expira: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null, usuario, aviso });
        return NextResponse.json({ ok: true, alerta, aviso });
    }
    catch (e) {
        if (tentativa) {
            await createAdminClient().from("whatsapp_instancias").update({ status: "erro", ultimo_erro: "Conexão não concluída. Verifique a autorização, os ativos e as credenciais na Meta.", revisao: tentativa.revisao + 1, updated_at: new Date().toISOString() }).eq("empresa_id", tentativa.empresa_id).eq("id", tentativa.id).eq("revisao", tentativa.revisao).neq("status", "suspenso");
        }
        return NextResponse.json({ error: e instanceof z.ZodError ? "Parâmetros de conexão inválidos." : e instanceof Error ? e.message : "Falha ao conectar" }, { status: 400 });
    }
}
