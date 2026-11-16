import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidBrazilianPhone, normalizePhoneForLead, upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { proximoCodigoFromExisting } from "@/lib/eventos-sorteio/codigo";
import {
  validarQualificacaoRespostas,
  labelVeiculo,
  labelMoradia,
  labelCapacidade,
  labelAvaliacaoEncontro,
  labelMomentoOportunidade,
} from "@/lib/eventos-sorteio/checkin-conversacional-types";
import { cadastrarCliente, cadastrarVendedor, listarEmpreendimentos } from "./repo";
import { cnpjValido, gerarCodigo } from "./validacao";
import { MODELOS_PARCERIA, type ImobiliariaSpl, type ModeloParceria, type VendedorSpl } from "./types";
import {
  DESAFIO_SEM_INTERESSE,
  FLUXO_CHECKIN_SPL,
  OPCOES_DESAFIO,
  descreverDesafio,
  type ClienteEvento,
  type FuncaoCorretor,
  type ImobiliariaOpcao,
  type SessaoCorretor,
} from "./evento-tipos";

/**
 * Eventos são globais (sem empresa_id). As imobiliárias do evento SPL pertencem
 * à empresa que atende raconsinop.com.br, independentemente do host do QR.
 */
const EMPRESA_SPL_SLUG = "gauchinho";

const db = () => createAdminClient({ noStore: true });
const IMOB_COLS =
  "id,empresa_id,nome,logo_url,responsavel,telefone,email,cnpj,chave_pix,modelo_parceria,quantidade_vendedores,modelo_vendedores,status,exibir_logo,codigo_convite,token_painel,created_at,cadastro_completo";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };
const erro = (error: string) => ({ ok: false as const, error });
const txt = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);

type CupomRow = {
  id: string;
  sorteio_id: string;
  evento_id: string;
  lead_id: string | null;
  codigo: string;
  nome: string;
  telefone: string;
  origem_cupom: string | null;
  fase_cadastro: string | null;
  qualificacao_respostas: Record<string, unknown> | null;
};

type MetaSpl = { vendedor_id: string; imobiliaria_id: string; imobiliaria_nome: string; funcao: FuncaoCorretor };

let empresaCache: string | null = null;
export async function empresaSplId(): Promise<string> {
  if (empresaCache) return empresaCache;
  const { data } = await db().from("empresas").select("id").eq("slug", EMPRESA_SPL_SLUG).maybeSingle();
  if (!data?.id) throw new Error("Empresa do evento SPL não encontrada.");
  empresaCache = data.id as string;
  return empresaCache;
}

/* --------------------------------- Evento --------------------------------- */

async function carregarEvento(eventoId: string) {
  const { data: ev } = await db()
    .from("eventos")
    .select("id,nome,slug,ativo,prefixo_codigo_sorteio,checkin_fluxo")
    .eq("id", eventoId)
    .maybeSingle();
  if (!ev || !ev.ativo || ev.checkin_fluxo !== FLUXO_CHECKIN_SPL) return null;
  let { data: sorteio } = await db().from("eventos_sorteios").select("id").eq("evento_id", ev.id).maybeSingle();
  if (!sorteio) {
    const { data: novo } = await db()
      .from("eventos_sorteios")
      .insert({ evento_id: ev.id, ativo: true, titulo: `Sorteio · ${ev.nome}`, status: "aberto" })
      .select("id")
      .single();
    sorteio = novo;
  }
  if (!sorteio) return null;
  return {
    id: ev.id as string,
    nome: ev.nome as string,
    slug: ev.slug as string,
    prefixo: ((ev.prefixo_codigo_sorteio as string | null) ?? "").trim(),
    sorteioId: sorteio.id as string,
  };
}
type EventoSpl = NonNullable<Awaited<ReturnType<typeof carregarEvento>>>;

/** Evento SPL ativo mais recente (usado pelo botão do site spl.). */
export async function eventoSplAtivoSlug(): Promise<string | null> {
  const { data } = await db()
    .from("eventos")
    .select("slug")
    .eq("ativo", true)
    .eq("checkin_fluxo", FLUXO_CHECKIN_SPL)
    .order("data_evento", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

/** Numeração sequencial do evento com nova tentativa quando dois cupons saem ao mesmo tempo. */
async function emitirCupom(evento: EventoSpl, linha: Record<string, unknown>): Promise<{ id: string; codigo: string }> {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { data: rows } = await db().from("eventos_sorteio_participantes").select("codigo").eq("evento_id", evento.id);
    const codigo = proximoCodigoFromExisting((rows ?? []).map((r) => r.codigo as string), evento.prefixo, 3);
    const { data, error } = await db()
      .from("eventos_sorteio_participantes")
      .insert({ ...linha, codigo, sorteio_id: evento.sorteioId, evento_id: evento.id, status: "participando", ganhador: false })
      .select("id,codigo")
      .single();
    if (!error && data) return { id: data.id as string, codigo: data.codigo as string };
    if (error?.code !== "23505") throw new Error("Não foi possível gerar o cupom agora.");
  }
  throw new Error("Muitos cadastros ao mesmo tempo. Tente de novo.");
}

/* ------------------------------ Imobiliárias ------------------------------ */

export async function listarImobiliariasEvento(): Promise<ImobiliariaOpcao[]> {
  const empresaId = await empresaSplId();
  const { data } = await db()
    .from("spl_imobiliarias")
    .select("id,nome,cadastro_completo,origem_cadastro,status")
    .eq("empresa_id", empresaId)
    .in("status", ["PENDENTE", "APROVADA"])
    .order("nome");
  // Lista do evento: as pré-cadastradas + as aprovadas pelo portfólio (sem cadastros de teste).
  return (data ?? [])
    .filter(
      (i) =>
        i.origem_cadastro === "PRE_CADASTRO" ||
        (i.origem_cadastro === "PORTFOLIO" && i.status === "APROVADA" && !/teste/i.test(String(i.nome))),
    )
    .map((i) => ({ id: i.id as string, nome: i.nome as string, cadastroCompleto: Boolean(i.cadastro_completo) }));
}

async function imobiliariaPorId(id: string): Promise<(ImobiliariaSpl & { cadastro_completo: boolean }) | null> {
  const empresaId = await empresaSplId();
  const { data } = await db()
    .from("spl_imobiliarias")
    .select(IMOB_COLS)
    .eq("empresa_id", empresaId)
    .eq("id", id)
    .in("status", ["PENDENTE", "APROVADA"])
    .maybeSingle();
  return (data as (ImobiliariaSpl & { cadastro_completo: boolean }) | null) ?? null;
}

async function imobiliariaOutra(nome: string) {
  const empresaId = await empresaSplId();
  const { data: existente } = await db()
    .from("spl_imobiliarias")
    .select("id")
    .eq("empresa_id", empresaId)
    .ilike("nome", nome.replace(/[%_]/g, ""))
    .maybeSingle();
  if (existente?.id) return imobiliariaPorId(existente.id as string);
  const { data, error } = await db()
    .from("spl_imobiliarias")
    .insert({
      empresa_id: empresaId,
      nome,
      status: "PENDENTE",
      cadastro_completo: false,
      origem_cadastro: "EVENTO",
      codigo_convite: gerarCodigo(8),
      token_painel: randomBytes(24).toString("base64url"),
      observacoes: "Informada por corretor no check-in do evento SPL",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível registrar a imobiliária.");
  return imobiliariaPorId(data.id as string);
}

/* ------------------------------ Sessão corretor ------------------------------ */

async function cupomPrincipal(evento: EventoSpl, telefoneDigitos: string): Promise<CupomRow | null> {
  const { data } = await db()
    .from("eventos_sorteio_participantes")
    .select("id,sorteio_id,evento_id,lead_id,codigo,nome,telefone,origem_cupom,fase_cadastro,qualificacao_respostas")
    .eq("evento_id", evento.id)
    .eq("status", "participando")
    .eq("origem_cupom", "cadastro");
  return (
    ((data ?? []) as CupomRow[]).find((r) => normalizePhoneForLead(r.telefone) === telefoneDigitos && r.qualificacao_respostas?.spl) ??
    null
  );
}

async function clientesDoCorretor(eventoId: string, vendedorId: string): Promise<ClienteEvento[]> {
  const { data } = await db()
    .from("spl_clientes")
    .select("id,nome,telefone,empreendimento_slug,cupom_codigo")
    .eq("evento_id", eventoId)
    .eq("vendedor_id", vendedorId)
    .order("created_at");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nome: c.nome as string,
    telefone: c.telefone as string,
    empreendimento: (c.empreendimento_slug as string | null) ?? null,
    cupom: (c.cupom_codigo as string | null) ?? null,
  }));
}

async function montarSessao(evento: EventoSpl, cupom: CupomRow): Promise<SessaoCorretor> {
  const meta = cupom.qualificacao_respostas?.spl as MetaSpl;
  const imob = await imobiliariaPorId(meta.imobiliaria_id);
  return {
    participanteId: cupom.id,
    telefone: normalizePhoneForLead(cupom.telefone),
    nome: cupom.nome,
    cupomPresenca: cupom.codigo,
    imobiliariaId: meta.imobiliaria_id,
    imobiliariaNome: imob?.nome ?? meta.imobiliaria_nome,
    funcao: meta.funcao,
    precisaDadosImobiliaria: meta.funcao === "PROPRIETARIO" && Boolean(imob && !imob.cadastro_completo),
    clientes: await clientesDoCorretor(evento.id, meta.vendedor_id),
    jaConcluiu: cupom.fase_cadastro === "completo",
  };
}

/** Confere que o participante pertence ao telefone informado (o client guarda os dois). */
async function sessaoValida(eventoId: string, participanteId: string, telefone: string) {
  const evento = await carregarEvento(eventoId);
  if (!evento) return null;
  const tel = normalizePhoneForLead(telefone);
  const { data } = await db()
    .from("eventos_sorteio_participantes")
    .select("id,sorteio_id,evento_id,lead_id,codigo,nome,telefone,origem_cupom,fase_cadastro,qualificacao_respostas")
    .eq("id", participanteId)
    .eq("evento_id", evento.id)
    .eq("origem_cupom", "cadastro")
    .maybeSingle();
  const cupom = data as CupomRow | null;
  if (!cupom || normalizePhoneForLead(cupom.telefone) !== tel || !cupom.qualificacao_respostas?.spl) return null;
  return { evento, cupom, meta: cupom.qualificacao_respostas.spl as MetaSpl };
}

/* --------------------------- Etapa 1 · Corretor --------------------------- */

export async function iniciarCorretor(raw: Record<string, unknown>): Promise<Resultado<SessaoCorretor>> {
  const evento = await carregarEvento(txt(raw.eventoId, 60));
  if (!evento) return erro("Check-in indisponível no momento.");
  const nome = txt(raw.nome);
  const telefone = normalizePhoneForLead(txt(raw.telefone, 40));
  const funcao = txt(raw.funcao, 20) as FuncaoCorretor;
  if (nome.length < 3) return erro("Informe seu nome completo.");
  if (!isValidBrazilianPhone(telefone)) return erro("WhatsApp inválido. Inclua o DDD.");

  const existente = await cupomPrincipal(evento, telefone);
  if (existente) return { ok: true, data: await montarSessao(evento, existente) };

  if (funcao !== "COLABORADOR" && funcao !== "PROPRIETARIO") return erro("Marque se você é colaborador ou proprietário.");
  const imobiliariaId = txt(raw.imobiliariaId, 60);
  const outra = txt(raw.imobiliariaOutra, 160);
  let imob: Awaited<ReturnType<typeof imobiliariaPorId>> = null;
  if (imobiliariaId && imobiliariaId !== "outra") imob = await imobiliariaPorId(imobiliariaId);
  else if (outra.length >= 2) imob = await imobiliariaOutra(outra);
  if (!imob) return erro("Escolha a sua imobiliária.");

  const vendedor = await cadastrarVendedor(imob, { nome, telefone, email: null, cpf: null, chave_pix: null, chave_pix_tipo: null });
  await db().from("spl_vendedores").update({ funcao }).eq("id", vendedor.id);

  const telFmt = formatWhatsappBrInput(telefone);
  let leadId: string | null = null;
  try {
    const lead = await upsertLeadPorTelefone(createAdminClient(), {
      empresa_id: imob.empresa_id,
      nome,
      whatsapp: telFmt,
      origem: "evento_checkin",
      origem_detalhe: evento.slug,
      evento_id: evento.id,
      evento_nome: evento.nome,
      dados_simulacao: { origem: "checkin_spl_imobiliarias", spl: { imobiliaria: imob.nome, funcao } },
    });
    leadId = lead.ok ? lead.lead_id : null;
  } catch {
    leadId = null;
  }

  const agora = new Date().toISOString();
  const { data: presenca } = await db()
    .from("eventos_participantes")
    .insert({
      evento_id: evento.id,
      lead_id: leadId,
      nome_participante: nome,
      telefone_participante: telFmt,
      status: "presente",
      checkin_at: agora,
      quantidade_vagas: 1,
      observacao: `Check-in SPL · ${imob.nome} · ${funcao === "PROPRIETARIO" ? "Proprietário" : "Colaborador"}`,
    })
    .select("id")
    .single();

  const meta: MetaSpl = { vendedor_id: vendedor.id, imobiliaria_id: imob.id, imobiliaria_nome: imob.nome, funcao };
  const cupom = await emitirCupom(evento, {
    evento_participante_id: presenca?.id ?? null,
    lead_id: leadId,
    nome,
    telefone: telFmt,
    fase_cadastro: "fase1",
    origem_cupom: "cadastro",
    observacao: `Presença · ${imob.nome}`,
    qualificacao_respostas: { tipo_checkin: "evento", spl: meta },
    lgpd_termo_versao: "v1_checkin_spl",
    lgpd_consentimento_at: agora,
  });

  const { data: criado } = await db()
    .from("eventos_sorteio_participantes")
    .select("id,sorteio_id,evento_id,lead_id,codigo,nome,telefone,origem_cupom,fase_cadastro,qualificacao_respostas")
    .eq("id", cupom.id)
    .single();
  return { ok: true, data: await montarSessao(evento, criado as CupomRow) };
}

/* ------------------------ Etapa 1b · Dados da imobiliária ------------------------ */

export async function salvarDadosImobiliaria(raw: Record<string, unknown>): Promise<Resultado<{ ok: true }>> {
  const s = await sessaoValida(txt(raw.eventoId, 60), txt(raw.participanteId, 60), txt(raw.telefone, 40));
  if (!s) return erro("Sessão expirada. Recarregue a página.");
  if (s.meta.funcao !== "PROPRIETARIO") return erro("Somente o proprietário completa os dados da imobiliária.");

  const email = txt(raw.email, 200).toLowerCase();
  const cnpj = txt(raw.cnpj, 30).replace(/\D/g, "");
  const chave_pix = txt(raw.chave_pix, 140);
  const modelo = txt(raw.modelo_parceria, 40) as ModeloParceria;
  const quantidade = Math.floor(Number(raw.quantidade_vendedores ?? 0));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro("Informe um e-mail válido.");
  if (cnpj && !cnpjValido(cnpj)) return erro("CNPJ inválido.");
  if (!MODELOS_PARCERIA.some((m) => m.value === modelo)) return erro("Escolha o modelo de parceria.");
  if (modelo !== "SOMENTE_LIBERAR_CARTEIRA" && chave_pix.length < 3) return erro("Informe a chave PIX para receber as comissões.");
  if (!Number.isFinite(quantidade) || quantidade < 0 || quantidade > 1000) return erro("Quantidade de corretores inválida.");

  const base = {
    responsavel: s.cupom.nome,
    email,
    cnpj: cnpj || null,
    chave_pix: chave_pix || null,
    modelo_parceria: modelo,
    quantidade_vendedores: quantidade,
    cadastro_completo: true,
  };
  const telefone = normalizePhoneForLead(s.cupom.telefone);
  let { error } = await db().from("spl_imobiliarias").update({ ...base, telefone }).eq("id", s.meta.imobiliaria_id);
  // Telefone já usado por outra imobiliária: salva o restante sem ele.
  if (error?.code === "23505") ({ error } = await db().from("spl_imobiliarias").update(base).eq("id", s.meta.imobiliaria_id));
  if (error) return erro("Não foi possível salvar os dados da imobiliária.");
  return { ok: true, data: { ok: true } };
}

/* ----------------------------- Etapa 2 · Clientes ----------------------------- */

export async function adicionarClienteEvento(
  raw: Record<string, unknown>,
  host: string | null,
): Promise<Resultado<{ cliente: ClienteEvento; aviso: string | null }>> {
  const s = await sessaoValida(txt(raw.eventoId, 60), txt(raw.participanteId, 60), txt(raw.telefone, 40));
  if (!s) return erro("Sessão expirada. Recarregue a página.");
  const nome = txt(raw.nome);
  const telefone = normalizePhoneForLead(txt(raw.clienteTelefone, 40));
  const empreendimentoRaw = txt(raw.empreendimento, 40).toLowerCase();
  if (nome.length < 2) return erro("Informe o nome do cliente.");
  if (!isValidBrazilianPhone(telefone)) return erro("Telefone do cliente inválido. Inclua o DDD.");
  if (telefone === normalizePhoneForLead(s.cupom.telefone)) return erro("Esse é o seu telefone. Indique um cliente.");

  const empresaId = await empresaSplId();
  let empreendimento: string | null = null;
  if (empreendimentoRaw) {
    const lista = await listarEmpreendimentos(empresaId);
    empreendimento = lista.some((e) => e.slug === empreendimentoRaw) ? empreendimentoRaw : null;
  }

  // Mesmo cliente indicado por outro corretor neste evento: só o primeiro ganha cupom.
  const { data: jaIndicado } = await db()
    .from("spl_clientes")
    .select("id,vendedor_id")
    .eq("evento_id", s.evento.id)
    .eq("telefone", telefone)
    .limit(1)
    .maybeSingle();
  if (jaIndicado) {
    return erro(
      jaIndicado.vendedor_id === s.meta.vendedor_id
        ? "Você já indicou este cliente."
        : "Este cliente já foi indicado por outro corretor no evento.",
    );
  }

  const imob = await imobiliariaPorId(s.meta.imobiliaria_id);
  if (!imob) return erro("Imobiliária indisponível.");
  const { data: vend } = await db()
    .from("spl_vendedores")
    .select("id,imobiliaria_id,nome,telefone,email,cpf,chave_pix,modelo,codigo,ativo,created_at")
    .eq("id", s.meta.vendedor_id)
    .maybeSingle();

  const cliente = await cadastrarCliente({
    imob,
    vendedor: (vend as VendedorSpl | null) ?? null,
    input: { nome, telefone, email: null, empreendimento_slug: empreendimento, unidade: null, situacao: null, valor_chaves: null, solucao: null },
    origem: "EVENTO",
    dados: { evento: s.evento.slug, indicado_por: s.cupom.nome },
    host,
  });

  const cupom = await emitirCupom(s.evento, {
    lead_id: s.cupom.lead_id,
    nome: s.cupom.nome,
    telefone: s.cupom.telefone,
    quem_convidou: nome,
    observacao: `Cupom por cliente indicado: ${nome}`,
    fase_cadastro: "completo",
    origem_cupom: "indicacao",
  });
  await db().from("spl_clientes").update({ evento_id: s.evento.id, cupom_codigo: cupom.codigo }).eq("id", cliente.id);

  return {
    ok: true,
    data: {
      cliente: { id: cliente.id, nome, telefone, empreendimento, cupom: cupom.codigo },
      aviso: null,
    },
  };
}

/* ---------------------- Etapa final · Desafio e pesquisa ---------------------- */

export async function finalizarCheckinSpl(raw: Record<string, unknown>): Promise<Resultado<{ cupons: string[] }>> {
  const s = await sessaoValida(txt(raw.eventoId, 60), txt(raw.participanteId, 60), txt(raw.telefone, 40));
  if (!s) return erro("Sessão expirada. Recarregue a página.");

  const desafio = txt(raw.desafio, 40);
  const opcao = OPCOES_DESAFIO.find((d) => d.id === desafio);
  if (!opcao && desafio !== DESAFIO_SEM_INTERESSE.id) return erro("Responda o desafio do primeiro consórcio.");

  const q = validarQualificacaoRespostas({ ...(raw.qualificacao as Record<string, unknown>), tipo_checkin: "evento" });
  if (!q.ok) return erro(q.error);

  const agora = new Date().toISOString();
  const qualificacao = { ...q.value, desafio, desafio_descricao: descreverDesafio(desafio), spl: s.meta };
  const { error } = await db()
    .from("eventos_sorteio_participantes")
    .update({ qualificacao_respostas: qualificacao, fase_cadastro: "completo" })
    .eq("id", s.cupom.id);
  if (error) return erro("Não foi possível salvar suas respostas.");

  const empresaId = await empresaSplId();
  let leadId = s.cupom.lead_id;
  try {
    const lead = await upsertLeadPorTelefone(createAdminClient(), {
      empresa_id: empresaId,
      nome: s.cupom.nome,
      whatsapp: s.cupom.telefone,
      origem: "evento_checkin",
      origem_detalhe: s.evento.slug,
      evento_id: s.evento.id,
      evento_nome: s.evento.nome,
      tipo_interesse: opcao?.tipo ?? null,
      produto_interesse: opcao ? `Desafio 1º consórcio · ${opcao.titulo}` : null,
      valor_credito: opcao?.credito ?? null,
      valor_parcela: opcao?.parcela ?? null,
      prazo_simulado: opcao?.prazo ?? null,
      resultado_resumido: `Desafio: ${descreverDesafio(desafio)}`,
      dados_simulacao: { origem: "checkin_spl_imobiliarias", spl: { ...s.meta, desafio }, qualificacao: q.value },
    });
    if (lead.ok) leadId = lead.lead_id;
  } catch {
    /* lead do corretor é complementar */
  }

  if (leadId) {
    try {
      await db().from("leads_eventos_qualificacoes").insert({
        lead_id: leadId,
        evento_id: s.evento.id,
        evento_nome: s.evento.nome,
        sorteio_participante_id: s.cupom.id,
        codigo_sorteio: s.cupom.codigo,
        qualificacao_respostas: qualificacao,
        lgpd_termo_versao: "v1_checkin_spl",
        lgpd_consentimento_at: agora,
        checkin_at: agora,
      });
    } catch {
      /* não bloqueia */
    }
    try {
      const clientes = await clientesDoCorretor(s.evento.id, s.meta.vendedor_id);
      await db().from("lead_atividades").insert({
        lead_id: leadId,
        tipo: "evento_checkin",
        titulo: `Check-in no evento ${s.evento.nome}`,
        descricao: [
          `Imobiliária: ${s.meta.imobiliaria_nome} (${s.meta.funcao === "PROPRIETARIO" ? "proprietário" : "colaborador"})`,
          `Cupom de presença: ${s.cupom.codigo}`,
          `Clientes indicados: ${clientes.length}`,
          `• Desafio: ${descreverDesafio(desafio)}`,
          `• Veículo: ${labelVeiculo(q.value.veiculo)}`,
          `• Moradia: ${labelMoradia(q.value.moradia)}`,
          `• Investimento: ${labelCapacidade(q.value.capacidade_mensal)}`,
          `• Avaliação do encontro: ${labelAvaliacaoEncontro(q.value.avaliacao_encontro)}`,
          q.value.avaliacao_melhoria ? `• O que pode melhorar: ${q.value.avaliacao_melhoria}` : null,
          `• Momento atual: ${labelMomentoOportunidade(q.value.momento_oportunidade)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        status: "concluida",
        data_conclusao: agora,
      });
    } catch {
      /* não bloqueia */
    }
  }

  const { data: cupons } = await db()
    .from("eventos_sorteio_participantes")
    .select("codigo")
    .eq("evento_id", s.evento.id)
    .eq("status", "participando")
    .eq("telefone", s.cupom.telefone)
    .order("codigo");
  return { ok: true, data: { cupons: (cupons ?? []).map((c) => c.codigo as string) } };
}

/** Dados iniciais da página pública do check-in SPL. */
export async function dadosPaginaCheckinSpl() {
  const empresaId = await empresaSplId();
  const [imobiliarias, empreendimentos] = await Promise.all([listarImobiliariasEvento(), listarEmpreendimentos(empresaId)]);
  return {
    imobiliarias,
    empreendimentos: empreendimentos.map((e) => ({ slug: e.slug, nome: e.nome, cidade: e.cidade })),
  };
}
