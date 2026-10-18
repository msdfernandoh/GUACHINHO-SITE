import { NextResponse } from "next/server";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { enviarTexto, enviarTemplate } from "@/lib/whatsapp/cloud-api/client";
import { getConexaoPorEmpresa, getTokenDaConexao } from "@/lib/whatsapp/cloud-api/conexoes";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EnviarBody = {
  para?: string;
  tipo?: "text" | "template";
  texto?: string;
  template_nome?: string;
  idioma?: string;
  components?: unknown[];
};

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireCurrentTenantContext();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { usuario, empresaAtiva } = ctx;

  let body: EnviarBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const para = (body.para ?? "").replace(/\D/g, "");
  if (!para || para.length < 10) {
    return NextResponse.json({ error: "Número de destino inválido" }, { status: 400 });
  }

  const conexao = await getConexaoPorEmpresa(empresaAtiva.id);
  const token = await getTokenDaConexao(empresaAtiva.id);
  if (!conexao || !token || conexao.status !== "conectado") {
    return NextResponse.json(
      { error: "WhatsApp não conectado para esta empresa" },
      { status: 409 },
    );
  }

  const tipo = body.tipo ?? "text";
  const resultado =
    tipo === "template"
      ? await enviarTemplate({
          phoneNumberId: conexao.phone_number_id,
          token,
          para,
          templateNome: body.template_nome ?? "",
          idiomaCodigo: body.idioma,
          components: body.components,
        })
      : await enviarTexto({
          phoneNumberId: conexao.phone_number_id,
          token,
          para,
          texto: body.texto ?? "",
        });

  // Histórico
  const admin = createAdminClient();
  await admin.from("whatsapp_mensagens").insert({
    empresa_id: empresaAtiva.id,
    conexao_id: conexao.id,
    direcao: "enviada",
    wa_message_id: resultado.waMessageId ?? null,
    contato_numero: para,
    tipo,
    conteudo: tipo === "text" ? body.texto ?? null : null,
    template_nome: tipo === "template" ? body.template_nome ?? null : null,
    status: resultado.ok ? "sent" : "failed",
    erro: resultado.ok ? null : resultado.error ?? null,
    payload: resultado.raw as object,
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error ?? "Falha no envio" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, wa_message_id: resultado.waMessageId });
}
