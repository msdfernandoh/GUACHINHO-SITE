import { NextResponse } from "next/server";
import { z } from "zod";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstancia } from "@/lib/whatsapp/cloud-api/conexoes";
import { enfileirar, montarPublico, type CampanhaRow } from "@/lib/whatsapp/cloud-api/envios";
import { variaveisDoTemplate, type ComponenteMeta } from "@/lib/whatsapp/cloud-api/templates-shared";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const publico = z.object({
  fonte: z.enum(["leads", "contatos", "whatsapp", "lista"]),
  status: z.array(z.string().max(60)).max(30).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  origens: z.array(z.string().max(60)).max(30).optional(),
  lista: z.string().max(500_000).optional(),
});
const criar = z.object({
  acao: z.literal("criar"),
  instancia_id: uuid,
  nome: z.string().trim().min(2).max(120),
  tipo: z.enum(["disparo", "automacao"]),
  template_nome: z.string().regex(/^[a-z0-9_]{1,512}$/),
  template_idioma: z.string().default("pt_BR"),
  variaveis: z.array(z.string().max(500)).max(20),
  publico,
  agendada_para: z.string().datetime().nullable().optional(),
  atraso_minutos: z.number().int().min(0).max(43200).default(0),
  ritmo_por_minuto: z.number().int().min(1).max(60).default(20),
  hora_inicio: z.number().int().min(0).max(23).default(8),
  hora_fim: z.number().int().min(1).max(24).default(20),
  iniciar: z.boolean().default(false),
});
const acao = z.object({ acao: z.enum(["iniciar", "pausar", "retomar", "cancelar", "previa"]), id: uuid.optional(), instancia_id: uuid.optional(), publico: publico.optional() });

export async function POST(request: Request) {
  let a;
  try {
    a = await requireErpRouteAccess("whatsapp");
  } catch {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }
  const empresa = a.empresaAtiva.id;
  const db = createAdminClient();
  try {
    const corpo = await request.json();
    if (corpo?.acao === "criar") {
      const b = criar.parse(corpo);
      if (b.hora_fim <= b.hora_inicio) throw new Error("O horário final precisa ser depois do inicial.");
      if (b.tipo === "automacao" && b.publico.fonte !== "leads") throw new Error("A automação de novo lead usa a fonte Leads.");
      const inst = await getInstancia(empresa, b.instancia_id);
      if (!inst.waba_id) throw new Error("Conecte a instância antes de criar envios.");
      const t = await db.from("whatsapp_templates").select("status,componentes").eq("empresa_id", empresa).eq("waba_id", inst.waba_id).eq("nome", b.template_nome).eq("idioma", b.template_idioma).maybeSingle();
      if (!t.data) throw new Error("Template não encontrado. Sincronize com a Meta.");
      if (t.data.status !== "APPROVED") throw new Error("Só dá para usar template aprovado pela Meta.");
      const n = variaveisDoTemplate(t.data.componentes as ComponenteMeta[]);
      if (b.variaveis.length < n || b.variaveis.slice(0, n).some((v) => !v || v === "fixo:")) throw new Error(`Defina o valor das ${n} variáveis do template.`);
      const agora = new Date().toISOString();
      const status = !b.iniciar ? "rascunho" : b.tipo === "automacao" ? "ativa" : b.agendada_para && b.agendada_para > agora ? "agendada" : "enviando";
      const ins = await db.from("whatsapp_campanhas").insert({
        empresa_id: empresa, instancia_id: inst.id, nome: b.nome, tipo: b.tipo, gatilho: b.tipo === "automacao" ? "novo_lead" : null,
        template_nome: b.template_nome, template_idioma: b.template_idioma, variaveis: b.variaveis.slice(0, n), publico: b.tipo === "disparo" ? b.publico : { fonte: "leads", origens: b.publico.origens },
        agendada_para: b.agendada_para ?? null, atraso_minutos: b.atraso_minutos, ritmo_por_minuto: b.ritmo_por_minuto, hora_inicio: b.hora_inicio, hora_fim: b.hora_fim,
        status, automacao_desde: b.tipo === "automacao" && b.iniciar ? agora : null, criado_por_id: a.usuario.id,
      }).select("*").single();
      if (ins.error) throw new Error("Não foi possível criar o envio.");
      const c = ins.data as CampanhaRow;
      let total = 0;
      if (b.tipo === "disparo") {
        const lista = await montarPublico(empresa, inst.id, b.publico);
        if (!lista.length) {
          await db.from("whatsapp_campanhas").delete().eq("id", c.id);
          throw new Error("Nenhum número válido nesse público (ou todos pediram para sair).");
        }
        await enfileirar(c, lista);
        total = lista.length;
      }
      return NextResponse.json({ ok: true, id: c.id, total });
    }
    const b = acao.parse(corpo);
    if (b.acao === "previa") {
      if (!b.instancia_id || !b.publico) throw new Error("Escolha a instância e o público.");
      await getInstancia(empresa, b.instancia_id);
      const lista = await montarPublico(empresa, b.instancia_id, b.publico);
      return NextResponse.json({ ok: true, total: lista.length, exemplos: lista.slice(0, 5) });
    }
    if (!b.id) throw new Error("Envio não informado.");
    const atual = await db.from("whatsapp_campanhas").select("id,tipo,status,agendada_para").eq("empresa_id", empresa).eq("id", b.id).maybeSingle();
    if (!atual.data) throw new Error("Envio não encontrado.");
    const c = atual.data;
    const agora = new Date().toISOString();
    const novo =
      b.acao === "pausar" ? "pausada"
        : b.acao === "cancelar" ? "cancelada"
          : c.tipo === "automacao" ? "ativa"
            : c.agendada_para && c.agendada_para > agora ? "agendada" : "enviando";
    if (["cancelada", "concluida"].includes(c.status)) throw new Error("Este envio já terminou.");
    const up = await db.from("whatsapp_campanhas").update({
      status: novo, ultimo_erro: null, updated_at: agora,
      ...(c.tipo === "automacao" && c.status === "rascunho" && novo === "ativa" ? { automacao_desde: agora } : {}),
    }).eq("id", c.id).eq("empresa_id", empresa);
    if (up.error) throw new Error("Não foi possível alterar o envio.");
    if (novo === "cancelada") await db.from("whatsapp_campanha_envios").update({ status: "ignorado", motivo: "Envio cancelado" }).eq("campanha_id", c.id).eq("status", "pendente");
    return NextResponse.json({ ok: true, status: novo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof z.ZodError ? "Dados do envio inválidos." : e instanceof Error ? e.message : "Falha." }, { status: 400 });
  }
}
