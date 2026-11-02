import { NextResponse } from "next/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { getInstancia } from "@/lib/whatsapp/cloud-api/conexoes";
import { getMetaAppConfig } from "@/lib/whatsapp/cloud-api/config";
import { criarTokenConexao } from "@/lib/whatsapp/cloud-api/connection-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
export async function POST(request: Request) {
    let a;
    try {
        a = await requireErpRouteAccess("whatsapp");
    }
    catch {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }
    try {
        const b = await request.json();
        const i = await getInstancia(a.empresaAtiva.id, uuid.parse(b.instancia_id));
        if (i.status === "suspenso" || i.status === "conectado" || !i.modelo?.ativo || i.modelo.modo === "meta_teste")
            throw new Error("Esta instância não está disponível para conectar pelo ERP.");
        const app = await getMetaAppConfig(i.app_meta_id);
        if (!app.appId || !app.configId || !app.appSecret)
            throw new Error("Configuração do app pendente no SaaS.");
        const retorno = new URL(request.url).origin;
        if (request.headers.get("origin") !== retorno)
            return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
        const t = criarTokenConexao({ empresa_id: a.empresaAtiva.id, instancia_id: i.id, usuario_id: a.usuario.id, revisao: i.revisao, retorno });
        const { error } = await createAdminClient().from("whatsapp_conexao_tentativas").insert({ id: t.claims.jti, empresa_id: a.empresaAtiva.id, instancia_id: i.id, usuario_id: a.usuario.id, expira_em: new Date(t.claims.exp * 1000).toISOString() });
        if (error)
            throw new Error("Não foi possível iniciar a conexão.");
        return NextResponse.json({ url: app.origem + "/conectar-whatsapp?t=" + encodeURIComponent(t.token) }, { headers: { "Cache-Control": "no-store" } });
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao gerar conexão" }, { status: 400 });
    }
}
