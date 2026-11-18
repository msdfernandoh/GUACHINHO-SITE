import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagem } from "./client";
import { getMetaAppConfig } from "./config";
import { getInstancia, tokenDaInstancia } from "./conexoes";
import {
  componentesDeEnvio, dentroDaJanela, numeroWhatsapp, resolverParametros, variaveisDoTemplate, type ComponenteMeta,
} from "./templates-shared";

export type PublicoCampanha = {
  fonte: "leads" | "contatos" | "whatsapp" | "lista";
  status?: string[];
  tags?: string[];
  origens?: string[];
  lista?: string;
};

export type CampanhaRow = {
  id: string;
  empresa_id: string;
  instancia_id: string;
  nome: string;
  tipo: "disparo" | "automacao";
  gatilho: string | null;
  template_nome: string;
  template_idioma: string;
  variaveis: string[];
  header_midia_url: string | null;
  publico: PublicoCampanha;
  agendada_para: string | null;
  atraso_minutos: number;
  ritmo_por_minuto: number;
  hora_inicio: number;
  hora_fim: number;
  status: string;
  automacao_desde: string | null;
  ultimo_erro: string | null;
  criado_por_id: string;
  created_at: string;
};

export type Destinatario = { numero: string; nome: string | null; lead_id?: string | null };

const PAGINA = 1000;

/** Lê todas as páginas de uma consulta (o PostgREST corta em 1.000 linhas). */
async function todasAsPaginas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, maximo = 20000) {
  const linhas: T[] = [];
  for (let de = 0; de < maximo; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error("Não foi possível montar o público.");
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

/** "Nome; telefone" por linha (ou só o telefone). */
export function lerListaManual(texto: string): Destinatario[] {
  return texto.split(/\r?\n/).flatMap((linha) => {
    const partes = linha.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
    const tel = partes.find((p) => p.replace(/\D/g, "").length >= 10);
    const numero = numeroWhatsapp(tel);
    return numero ? [{ numero, nome: partes.find((p) => p !== tel) ?? null }] : [];
  });
}

/** Monta o público sem repetidos e sem quem pediu para sair. */
export async function montarPublico(empresaId: string, instanciaId: string, publico: PublicoCampanha): Promise<Destinatario[]> {
  const db = createAdminClient();
  let bruto: Destinatario[] = [];
  if (publico.fonte === "leads") {
    const linhas = await todasAsPaginas<{ id: string; nome: string | null; whatsapp: string | null; telefone_normalizado: string | null }>((de, ate) => {
      let q = db.from("leads").select("id,nome,whatsapp,telefone_normalizado").eq("empresa_id", empresaId).order("created_at").range(de, ate);
      if (publico.status?.length) q = q.in("status", publico.status);
      if (publico.origens?.length) q = q.in("origem", publico.origens);
      if (publico.tags?.length) q = q.overlaps("tags", publico.tags);
      return q;
    });
    bruto = linhas.flatMap((l) => {
      const numero = numeroWhatsapp(l.whatsapp || l.telefone_normalizado);
      return numero ? [{ numero, nome: l.nome, lead_id: l.id }] : [];
    });
  } else if (publico.fonte === "contatos") {
    const linhas = await todasAsPaginas<{ nome: string | null; telefone: string | null; telefone_normalizado: string | null }>((de, ate) => {
      let q = db.from("contatos_usuario").select("nome,telefone,telefone_normalizado").eq("empresa_id", empresaId).order("created_at").range(de, ate);
      if (publico.tags?.length) q = q.overlaps("tags", publico.tags);
      return q;
    });
    bruto = linhas.flatMap((c) => {
      const numero = numeroWhatsapp(c.telefone_normalizado || c.telefone);
      return numero ? [{ numero, nome: c.nome }] : [];
    });
  } else if (publico.fonte === "whatsapp") {
    const linhas = await todasAsPaginas<{ numero: string; nome: string | null }>((de, ate) =>
      db.from("whatsapp_contatos").select("numero,nome").eq("empresa_id", empresaId).eq("instancia_id", instanciaId).eq("ativo", true).order("created_at").range(de, ate),
    );
    bruto = linhas.map((c) => ({ numero: c.numero, nome: c.nome }));
  } else {
    bruto = lerListaManual(publico.lista ?? "");
  }
  const sairam = await todasAsPaginas<{ numero: string }>((de, ate) => db.from("whatsapp_descadastros").select("numero").eq("empresa_id", empresaId).range(de, ate));
  const bloqueados = new Set(sairam.map((s) => s.numero));
  const vistos = new Set<string>();
  return bruto.filter((d) => !bloqueados.has(d.numero) && !vistos.has(d.numero) && vistos.add(d.numero));
}

/** Coloca os destinatários na fila; quem já está na campanha não entra de novo. */
export async function enfileirar(c: Pick<CampanhaRow, "id" | "empresa_id" | "variaveis">, destinatarios: (Destinatario & { enviar_apos?: string })[]) {
  const db = createAdminClient();
  for (let i = 0; i < destinatarios.length; i += 500) {
    const { error } = await db.from("whatsapp_campanha_envios").upsert(
      destinatarios.slice(i, i + 500).map((d) => ({
        empresa_id: c.empresa_id, campanha_id: c.id, numero: d.numero, nome: d.nome, lead_id: d.lead_id ?? null,
        parametros: resolverParametros(c.variaveis, d.nome), ...(d.enviar_apos ? { enviar_apos: d.enviar_apos } : {}),
      })),
      { onConflict: "campanha_id,numero", ignoreDuplicates: true },
    );
    if (error) throw new Error("Não foi possível montar a fila de envios.");
  }
}

type Envio = { id: string; numero: string; parametros: string[] };

/** Automação "novo lead": cada lead criado depois da ativação entra na fila uma única vez. */
async function enfileirarNovosLeads(c: CampanhaRow) {
  if (!c.automacao_desde) return 0;
  const db = createAdminClient();
  let q = db.from("leads").select("id,nome,whatsapp,telefone_normalizado,created_at").eq("empresa_id", c.empresa_id)
    .gt("created_at", new Date(Math.max(Date.parse(c.automacao_desde), Date.now() - 3 * 86400000)).toISOString()).order("created_at").limit(500);
  if (c.publico.origens?.length) q = q.in("origem", c.publico.origens);
  const { data, error } = await q;
  if (error) throw new Error("leads");
  const sairam = new Set(((await db.from("whatsapp_descadastros").select("numero").eq("empresa_id", c.empresa_id).limit(10000)).data ?? []).map((s) => s.numero));
  const novos = (data ?? []).flatMap((l) => {
    const numero = numeroWhatsapp(l.whatsapp || l.telefone_normalizado);
    return numero && !sairam.has(numero)
      ? [{ numero, nome: l.nome as string | null, lead_id: l.id as string, enviar_apos: new Date(Date.parse(l.created_at) + c.atraso_minutos * 60000).toISOString() }]
      : [];
  });
  if (novos.length) await enfileirar(c, novos);
  return novos.length;
}

async function marcar(id: string, status: "enviado" | "falhou" | "ignorado", motivo?: string) {
  await createAdminClient().from("whatsapp_campanha_envios").update({ status, motivo: motivo ?? null, processado_em: new Date().toISOString() }).eq("id", id);
}

/** Envia um lote de uma campanha. Idempotente: o id do envio é o id da mensagem reservada. */
async function enviarLote(c: CampanhaRow, envios: Envio[]) {
  const db = createAdminClient();
  let instancia, token, app, componentes: ComponenteMeta[], midia: string | null;
  try {
    instancia = await getInstancia(c.empresa_id, c.instancia_id);
    if (instancia.status !== "conectado" || !instancia.phone_number_id || !instancia.waba_id) throw new Error("A instância não está conectada.");
    token = tokenDaInstancia(instancia);
    app = await getMetaAppConfig(instancia.app_meta_id);
    const t = await db.from("whatsapp_templates").select("status,componentes,header_midia_url").eq("empresa_id", c.empresa_id).eq("waba_id", instancia.waba_id)
      .eq("nome", c.template_nome).eq("idioma", c.template_idioma).maybeSingle();
    if (!t.data || t.data.status !== "APPROVED") throw new Error("O template não está aprovado na Meta.");
    componentes = t.data.componentes as ComponenteMeta[];
    midia = c.header_midia_url || t.data.header_midia_url;
  } catch (e) {
    // Problema da campanha inteira: devolve o lote e pausa para alguém conferir.
    await db.from("whatsapp_campanha_envios").update({ status: "pendente", tentativas: 0 }).in("id", envios.map((e) => e.id));
    const pausada = e instanceof Error ? e.message : "Falha na campanha.";
    await db.from("whatsapp_campanhas").update({ status: "pausada", ultimo_erro: pausada.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", c.id);
    return { enviados: 0, falhas: 0, pausada };
  }
  let enviados = 0, falhas = 0;
  for (const e of envios) {
    try {
      const corpo = componentesDeEnvio(componentes, e.parametros, midia);
      const reserva = await db.rpc("whatsapp_reservar_envio", {
        p_id: e.id, p_empresa: c.empresa_id, p_instancia: c.instancia_id, p_usuario: c.criado_por_id, p_para: e.numero, p_tipo: "template", p_conteudo: null, p_template: c.template_nome,
      });
      if (reserva.error) throw new Error(/Limite/.test(reserva.error.message) ? "Limite mensal da instância atingido." : "Envio não liberado para esta instância.");
      if (!reserva.data) { await marcar(e.id, "enviado"); continue; } // já reservado em execução anterior
      let wamid: string;
      try {
        wamid = await enviarMensagem(app, instancia.phone_number_id!, token, {
          to: e.numero, type: "template", template: { name: c.template_nome, language: { code: c.template_idioma }, ...(corpo.length ? { components: corpo } : {}) },
        });
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "A Meta recusou o envio.";
        await db.from("whatsapp_mensagens").update({ status: "failed", erro: msg }).eq("id", e.id);
        throw new Error(msg);
      }
      // O webhook pode ter chegado antes: aproveita o status e fica um registro só.
      const previo = await db.from("whatsapp_mensagens").select("id,status").eq("wa_message_id", wamid).maybeSingle();
      if (previo.data && previo.data.id !== e.id) await db.from("whatsapp_mensagens").delete().eq("id", previo.data.id);
      await db.from("whatsapp_mensagens").update({ wa_message_id: wamid, status: previo.data?.status && previo.data.status !== "accepted" ? previo.data.status : "accepted" }).eq("id", e.id);
      await marcar(e.id, "enviado");
      enviados++;
    } catch (erro) {
      await marcar(e.id, "falhou", erro instanceof Error ? erro.message.slice(0, 300) : "Falha no envio.");
      falhas++;
    }
  }
  return { enviados, falhas, pausada: null as string | null };
}

/** Executado pelo cron a cada minuto: agenda, alimenta automações, envia no ritmo e fecha campanhas. */
export async function processarFilaWhatsapp(limiteMs = 45000) {
  const inicio = Date.now();
  const db = createAdminClient();
  const agora = new Date().toISOString();
  await db.from("whatsapp_campanhas").update({ status: "enviando", updated_at: agora }).eq("status", "agendada").lte("agendada_para", agora);
  const { data, error } = await db.from("whatsapp_campanhas").select("*").in("status", ["enviando", "ativa"]).order("created_at").limit(50);
  if (error) throw new Error("Não foi possível ler as campanhas. Confira a migration 345.");
  const resumo = { campanhas: 0, enviados: 0, falhas: 0, novos_leads: 0, pausadas: [] as string[] };
  for (const c of (data ?? []) as CampanhaRow[]) {
    if (Date.now() - inicio > limiteMs) break;
    resumo.campanhas++;
    if (c.tipo === "automacao") {
      try { resumo.novos_leads += await enfileirarNovosLeads(c); } catch { /* tenta de novo no próximo minuto */ }
    }
    if (!dentroDaJanela(c.hora_inicio, c.hora_fim)) continue;
    const lote = await db.rpc("whatsapp_fila_reivindicar", { p_campanha: c.id, p_limite: c.ritmo_por_minuto });
    const envios = (lote.data ?? []) as Envio[];
    if (envios.length) {
      const r = await enviarLote(c, envios);
      resumo.enviados += r.enviados;
      resumo.falhas += r.falhas;
      if (r.pausada) resumo.pausadas.push(c.nome + ": " + r.pausada);
    }
    if (c.tipo === "disparo") {
      const resta = await db.from("whatsapp_campanha_envios").select("id", { count: "exact", head: true }).eq("campanha_id", c.id).in("status", ["pendente", "enviando"]).lt("tentativas", 3);
      if (!resta.error && resta.count === 0) await db.from("whatsapp_campanhas").update({ status: "concluida", updated_at: new Date().toISOString() }).eq("id", c.id).eq("status", "enviando");
    }
  }
  return resumo;
}

export { variaveisDoTemplate };
