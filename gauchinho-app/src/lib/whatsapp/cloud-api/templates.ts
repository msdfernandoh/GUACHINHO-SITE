import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { graph } from "./client";
import { graphBase, getMetaAppConfig, type MetaAppConfig } from "./config";
import { getInstancia, tokenDaInstancia } from "./conexoes";
import type { ComponenteMeta, TemplateView } from "./templates-shared";

type TemplateMeta = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: ComponenteMeta[];
  rejected_reason?: string;
};

const COLUNAS = "id,waba_id,nome,idioma,categoria,status,motivo,componentes,header_midia_url,sincronizado_em";

export const MOTIVOS_REJEICAO: Record<string, string> = {
  ABUSIVE_CONTENT: "Conteúdo considerado abusivo.",
  INVALID_FORMAT: "Formato inválido (variáveis, exemplos ou botões).",
  PROMOTIONAL: "Conteúdo promocional em categoria que não é de marketing.",
  TAG_CONTENT_MISMATCH: "A categoria não combina com o conteúdo.",
  SCAM: "Conteúdo considerado enganoso.",
  INCORRECT_CATEGORY: "Categoria incorreta para o conteúdo.",
};

function motivo(reason?: string | null) {
  if (!reason || reason === "NONE") return null;
  return MOTIVOS_REJEICAO[reason] ?? reason.slice(0, 300);
}

/** Instância conectada + app + token, prontos para chamar a Graph API em nome da empresa. */
export async function contextoMeta(empresaId: string, instanciaId: string) {
  const instancia = await getInstancia(empresaId, instanciaId);
  if (!instancia.waba_id || !instancia.phone_number_id || instancia.status !== "conectado")
    throw new Error("Conecte esta instância antes de usar os templates.");
  return { instancia, waba: instancia.waba_id, app: await getMetaAppConfig(instancia.app_meta_id), token: tokenDaInstancia(instancia) };
}

export async function listarTemplatesMeta(app: MetaAppConfig, waba: string, token: string) {
  const todos: TemplateMeta[] = [];
  let after = "";
  for (let pagina = 0; pagina < 10; pagina++) {
    const r = await graph<{ data?: TemplateMeta[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      app,
      `${waba}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=100${after ? "&after=" + encodeURIComponent(after) : ""}`,
      token,
    );
    todos.push(...(r.data ?? []));
    after = r.paging?.next ? (r.paging.cursors?.after ?? "") : "";
    if (!after) break;
  }
  return todos;
}

/** Atualiza a lista local com o que está na Meta (status, motivo e componentes). */
export async function sincronizarTemplates(empresaId: string, instanciaId: string) {
  const { app, waba, token } = await contextoMeta(empresaId, instanciaId);
  const remotos = await listarTemplatesMeta(app, waba, token);
  const db = createAdminClient();
  const agora = new Date().toISOString();
  if (remotos.length) {
    const { error } = await db.from("whatsapp_templates").upsert(
      remotos.map((t) => ({
        empresa_id: empresaId, waba_id: waba, meta_id: t.id, nome: t.name, idioma: t.language, categoria: t.category,
        status: t.status, motivo: motivo(t.rejected_reason), componentes: t.components ?? [], sincronizado_em: agora, updated_at: agora,
      })),
      { onConflict: "empresa_id,waba_id,nome,idioma" },
    );
    if (error) throw new Error("Não foi possível gravar os templates.");
  }
  // O que não existe mais na Meta sai da lista local.
  const { data: locais } = await db.from("whatsapp_templates").select("id,nome,idioma").eq("empresa_id", empresaId).eq("waba_id", waba);
  const vivos = new Set(remotos.map((t) => t.name + "|" + t.language));
  const mortos = (locais ?? []).filter((l) => !vivos.has(l.nome + "|" + l.idioma)).map((l) => l.id);
  if (mortos.length) await db.from("whatsapp_templates").delete().eq("empresa_id", empresaId).in("id", mortos);
  return remotos.length;
}

export async function listarTemplates(empresaId: string, waba: string): Promise<TemplateView[]> {
  const { data, error } = await createAdminClient().from("whatsapp_templates").select(COLUNAS).eq("empresa_id", empresaId).eq("waba_id", waba).order("nome");
  if (error) throw new Error("Não foi possível carregar os templates. Confira a migration 345 no Supabase.");
  return (data ?? []) as TemplateView[];
}

/** Upload retomável da Meta: devolve o handle usado como exemplo do cabeçalho de imagem. */
export async function enviarExemploParaMeta(app: MetaAppConfig, token: string, arquivo: { bytes: Buffer; tipo: string; nome: string }) {
  const sessao = await graph<{ id?: string }>(
    app,
    `${app.appId}/uploads?file_name=${encodeURIComponent(arquivo.nome)}&file_length=${arquivo.bytes.length}&file_type=${encodeURIComponent(arquivo.tipo)}`,
    token,
    {},
  );
  if (!sessao.id) throw new Error("A Meta não abriu o envio da imagem.");
  const res = await fetch(`${graphBase(app)}/${sessao.id}`, {
    method: "POST",
    headers: { Authorization: "OAuth " + token, file_offset: "0" },
    body: new Uint8Array(arquivo.bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const json = (await res.json().catch(() => ({}))) as { h?: string };
  if (!res.ok || !json.h) throw new Error("A Meta não aceitou a imagem do cabeçalho.");
  return json.h;
}

export async function criarTemplateNaMeta(
  ctx: { app: MetaAppConfig; waba: string; token: string },
  t: { nome: string; idioma: string; categoria: string; componentes: ComponenteMeta[] },
) {
  return graph<{ id: string; status?: string; category?: string }>(ctx.app, `${ctx.waba}/message_templates`, ctx.token, {
    name: t.nome, language: t.idioma, category: t.categoria, components: t.componentes,
  });
}

/** Evento message_template_status_update do webhook: atualiza pela WABA e pelo id (ou nome+idioma). */
export async function aplicarStatusTemplate(waba: string, v: { event?: string; message_template_id?: number | string; message_template_name?: string; message_template_language?: string; reason?: string | null }) {
  if (!v.event) return;
  const db = createAdminClient();
  const dados = { status: String(v.event).toUpperCase(), motivo: motivo(v.reason), updated_at: new Date().toISOString() };
  let q = db.from("whatsapp_templates").update(dados).eq("waba_id", waba);
  if (v.message_template_name && v.message_template_language) q = q.eq("nome", v.message_template_name).eq("idioma", v.message_template_language);
  else if (v.message_template_id) q = q.eq("meta_id", String(v.message_template_id));
  else return;
  const { error } = await q;
  if (error) throw new Error("template status");
}
