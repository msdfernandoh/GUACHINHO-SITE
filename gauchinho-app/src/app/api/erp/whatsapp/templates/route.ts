import { NextResponse } from "next/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
import { contextoMeta, criarTemplateNaMeta, enviarExemploParaMeta, sincronizarTemplates } from "@/lib/whatsapp/cloud-api/templates";
import { montarComponentes, validarTemplate, type TemplateForm } from "@/lib/whatsapp/cloud-api/templates-shared";

export const runtime = "nodejs";
export const maxDuration = 60;

async function acesso() {
  try {
    return await requireErpRouteAccess("whatsapp");
  } catch {
    return null;
  }
}

/** POST multipart: acao=sincronizar | criar (campo "dados" em JSON + "imagem" opcional). */
export async function POST(request: Request) {
  const a = await acesso();
  if (!a) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  try {
    const f = await request.formData();
    const instanciaId = uuid.parse(String(f.get("instancia_id") ?? ""));
    const empresa = a.empresaAtiva.id;
    if (f.get("acao") === "sincronizar") {
      const total = await sincronizarTemplates(empresa, instanciaId);
      return NextResponse.json({ ok: true, total });
    }
    const dados = JSON.parse(String(f.get("dados") ?? "{}")) as TemplateForm;
    dados.idioma = "pt_BR";
    const imagem = f.get("imagem");
    const arquivo = imagem instanceof File && imagem.size ? imagem : null;
    if (arquivo && (!["image/jpeg", "image/png"].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024))
      throw new Error("A imagem precisa ser JPG ou PNG de até 5 MB.");
    const erro = validarTemplate(dados, !!arquivo);
    if (erro) throw new Error(erro);
    const ctx = await contextoMeta(empresa, instanciaId);
    const db = createAdminClient();
    let handle: string | null = null;
    let midiaUrl: string | null = null;
    if (dados.cabecalhoTipo === "IMAGEM" && arquivo) {
      const bytes = Buffer.from(await arquivo.arrayBuffer());
      handle = await enviarExemploParaMeta(ctx.app, ctx.token, { bytes, tipo: arquivo.type, nome: arquivo.name || "cabecalho.jpg" });
      // Cópia pública: é o link usado no cabeçalho na hora de enviar.
      const caminho = `${empresa}/${dados.nome}-${Date.now()}.${arquivo.type === "image/png" ? "png" : "jpg"}`;
      const up = await db.storage.from("whatsapp-midia").upload(caminho, bytes, { contentType: arquivo.type, upsert: false });
      if (!up.error) midiaUrl = db.storage.from("whatsapp-midia").getPublicUrl(caminho).data.publicUrl;
    }
    const componentes = montarComponentes(dados, handle);
    const r = await criarTemplateNaMeta(ctx, { nome: dados.nome, idioma: dados.idioma, categoria: dados.categoria, componentes });
    const { error } = await db.from("whatsapp_templates").upsert(
      {
        empresa_id: empresa, waba_id: ctx.waba, meta_id: r.id, nome: dados.nome, idioma: dados.idioma, categoria: r.category || dados.categoria,
        status: r.status || "PENDING", motivo: null, componentes, header_midia_url: midiaUrl, criado_por_id: a.usuario.id,
        sincronizado_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,waba_id,nome,idioma" },
    );
    if (error) throw new Error("Template enviado à Meta, mas não foi gravado aqui. Clique em Sincronizar com a Meta.");
    return NextResponse.json({ ok: true, status: r.status || "PENDING" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no template." }, { status: 400 });
  }
}
