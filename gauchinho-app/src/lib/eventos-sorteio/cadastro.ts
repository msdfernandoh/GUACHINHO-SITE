import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import { proximoCodigoFromExisting } from "./codigo";
import { isTipoSonhoSorteio, tipoSonhoParaCreditoLead } from "./lead-map";
import {
  normalizeTelefoneSorteio,
  telefoneJaParticipouSorteio,
  telefoneSorteioValido,
} from "./vagas";
import type { TipoSonhoSorteio } from "./types";
import { fetchPublicSorteioByEventoSlug } from "./public";
import {
  parseNpsConfig,
  resolverPerguntasNpsPublicas,
  validarRespostasNps,
} from "./nps";

export type CadastroSorteioPayload = {
  nome: string;
  telefone: string;
  valorMensalDisponivel: number;
  tipoSonho: string;
  qrCodeUnicoId?: string | null;
};

export type CadastroSorteioFase1Result =
  | {
      ok: true;
      participanteId: string;
      codigo: string;
      textoAgradecimento: string;
      eventoSlug: string;
    }
  | { ok: false; error: string };

export type CadastroSorteioResult = CadastroSorteioFase1Result;

export type LeadSemEventoResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

export type NpsFaseResult =
  | { ok: true; participanteId: string }
  | { ok: false; error: string };

/** @deprecated use cadastrarParticipanteSorteioFase1 — mantido para compat */
export async function cadastrarParticipanteSorteioPublico(
  eventoSlug: string,
  payload: CadastroSorteioPayload,
): Promise<CadastroSorteioResult> {
  return cadastrarParticipanteSorteioFase1(eventoSlug, payload);
}

export async function cadastrarParticipanteSorteioFase1(
  eventoSlug: string,
  payload: CadastroSorteioPayload,
): Promise<CadastroSorteioFase1Result> {
  const view = await fetchPublicSorteioByEventoSlug(eventoSlug);
  if (!view) return { ok: false, error: "Sorteio não encontrado ou indisponível." };
  if (view.status !== "aberto") return { ok: false, error: "Este sorteio está encerrado." };

  const nome = payload.nome?.trim();
  const telefone = payload.telefone?.trim();
  if (!nome) return { ok: false, error: "Informe seu nome." };
  if (!telefone || !telefoneSorteioValido(telefone)) {
    return { ok: false, error: "Informe um telefone/WhatsApp válido." };
  }
  if (!payload.valorMensalDisponivel || payload.valorMensalDisponivel <= 0) {
    return { ok: false, error: "Informe o valor mensal disponível." };
  }
  const tipoRaw = payload.tipoSonho?.trim();
  if (!tipoRaw || !isTipoSonhoSorteio(tipoRaw)) {
    return { ok: false, error: "Selecione o tipo do sonho." };
  }
  const tipoSonho = tipoRaw as TipoSonhoSorteio;

  const admin = createAdminClient();

  const { data: sorteioRow, error: sorteioErr } = await admin
    .from("eventos_sorteios")
    .select("id, permitir_telefone_duplicado")
    .eq("id", view.sorteioId)
    .maybeSingle();
  if (sorteioErr || !sorteioRow) {
    return { ok: false, error: sorteioErr?.message ?? "Sorteio indisponível." };
  }

  const { data: existentes, error: telErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("telefone, origem_cupom")
    .eq("sorteio_id", view.sorteioId)
    .eq("status", "participando");
  if (telErr) return { ok: false, error: telErr.message };

  const telefonesCadastro = (existentes ?? [])
    .filter((r) => (r.origem_cupom ?? "cadastro") === "cadastro")
    .map((r) => r.telefone as string);

  if (
    telefoneJaParticipouSorteio(
      telefone,
      telefonesCadastro,
      !!sorteioRow.permitir_telefone_duplicado,
    )
  ) {
    return { ok: false, error: "Este telefone já está participando deste sorteio." };
  }

  const { data: codigosRows, error: codErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("codigo")
    .eq("evento_id", view.eventoId);
  if (codErr) return { ok: false, error: codErr.message };

  const codigo = proximoCodigoFromExisting((codigosRows ?? []).map((r) => r.codigo as string));
  const valor = payload.valorMensalDisponivel;
  const tipoCredito = tipoSonhoParaCreditoLead(tipoSonho);

  const dadosSimulacao = {
    origem: "evento_sorteio",
    codigo_sorteio: codigo,
    tipo_sonho: tipoSonho,
    valor_mensal_disponivel: valor,
    evento_id: view.eventoId,
    evento_nome: view.eventoNome,
    qr_code_unico_id: payload.qrCodeUnicoId ?? null,
  };

  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .insert({
      nome,
      whatsapp: telefone,
      origem: "evento_sorteio",
      origem_detalhe: view.eventoSlug,
      tipo_interesse: tipoCredito,
      tipo_credito: tipoCredito,
      valor_credito: valor,
      valor_estimado: valor,
      valor_simulado: valor,
      produto_interesse: tipoCredito,
      evento_id: view.eventoId,
      evento_nome: view.eventoNome,
      dados_simulacao: dadosSimulacao,
      status: leadsConfig.statusInicialPadrao ?? "Novo",
      criado_manual: false,
    })
    .select("id")
    .single();
  if (leadErr || !leadRow) return { ok: false, error: leadErr?.message ?? "Falha ao registrar lead." };

  const insertPart: Record<string, unknown> = {
    sorteio_id: view.sorteioId,
    evento_id: view.eventoId,
    lead_id: leadRow.id,
    codigo,
    nome,
    telefone,
    valor_mensal_disponivel: valor,
    tipo_sonho: tipoSonho,
    status: "participando",
    ganhador: false,
    fase_cadastro: "fase1",
    origem_cupom: "cadastro",
  };
  if (payload.qrCodeUnicoId) insertPart.qr_code_unico_id = payload.qrCodeUnicoId;

  let partRow: { id: string } | null = null;
  {
    const first = await admin.from("eventos_sorteio_participantes").insert(insertPart).select("id").single();
    if (first.error && /fase_cadastro|origem_cupom|qr_code_unico_id|schema cache|Could not find/i.test(first.error.message)) {
      const { fase_cadastro: _f, origem_cupom: _o, qr_code_unico_id: _q, ...legacy } = insertPart;
      const retry = await admin.from("eventos_sorteio_participantes").insert(legacy).select("id").single();
      if (retry.error || !retry.data) {
        return { ok: false, error: retry.error?.message ?? first.error.message };
      }
      partRow = retry.data as { id: string };
    } else if (first.error || !first.data) {
      return { ok: false, error: first.error?.message ?? "Falha ao registrar participação." };
    } else {
      partRow = first.data as { id: string };
    }
  }

  const { vincularNovoCadastroSorteioAoEvento } = await import("./sync-inscritos");
  try {
    await vincularNovoCadastroSorteioAoEvento(
      view.eventoId,
      view.sorteioId,
      partRow.id,
      nome,
      telefone,
      leadRow.id,
      "participando",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Não bloqueia o cupom se o vínculo com inscrição oficial falhar por schema antigo
    if (!/evento_participante_id|schema cache|Could not find/i.test(msg)) {
      return { ok: false, error: msg };
    }
  }

  await registrarEvento({
    tipo_evento: "evento_sorteio_cadastro",
    origem: "evento_sorteio",
    lead_id: leadRow.id,
    entidade_tipo: view.sorteioId,
    dados_evento: {
      codigo,
      evento_slug: view.eventoSlug,
      fase: "fase1",
      qr_code_unico_id: payload.qrCodeUnicoId ?? null,
    },
  });

  return {
    ok: true,
    participanteId: partRow.id as string,
    codigo,
    textoAgradecimento: view.textoAgradecimento,
    eventoSlug: view.eventoSlug,
  };
}

export async function salvarNpsSorteioFase2(
  participanteId: string,
  respostas: Record<string, unknown>,
): Promise<NpsFaseResult> {
  const admin = createAdminClient();
  const { data: part, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, sorteio_id, status, origem_cupom, fase_cadastro, nps_completo_em")
    .eq("id", participanteId)
    .maybeSingle();
  if (error || !part) return { ok: false, error: error?.message ?? "Participante não encontrado." };
  if (part.status !== "participando") return { ok: false, error: "Participação cancelada." };
  if ((part.origem_cupom ?? "cadastro") !== "cadastro") {
    return { ok: false, error: "NPS inválido para este cupom." };
  }
  if (part.nps_completo_em) {
    return { ok: true, participanteId };
  }

  const { data: sorteio, error: sErr } = await admin
    .from("eventos_sorteios")
    .select("nps_config")
    .eq("id", part.sorteio_id)
    .maybeSingle();
  if (sErr || !sorteio) return { ok: false, error: sErr?.message ?? "Sorteio indisponível." };

  const perguntas = resolverPerguntasNpsPublicas(parseNpsConfig(sorteio.nps_config));
  const valid = validarRespostasNps(perguntas, respostas);
  if (!valid.ok) return { ok: false, error: valid.error };

  const now = new Date().toISOString();
  const payloadNps = {
    nps_respostas: valid.clean,
    nps_completo_em: now,
    fase_cadastro: "fase2",
    updated_at: now,
  };
  const { error: updErr } = await admin
    .from("eventos_sorteio_participantes")
    .update(payloadNps)
    .eq("id", participanteId);
  if (updErr) {
    if (/nps_respostas|nps_completo_em|fase_cadastro|schema cache|Could not find/i.test(updErr.message)) {
      return {
        ok: false,
        error:
          "Banco desatualizado para o NPS. Aplique no Supabase: 026_eventos_sorteio_inscricao_link.sql e 030_eventos_sorteio_fases_qr_unico.sql",
      };
    }
    return { ok: false, error: updErr.message };
  }

  return { ok: true, participanteId };
}

/** Cadastro via QR único fora do período / sem evento vinculado. */
export async function cadastrarLeadQrSemEvento(
  payload: CadastroSorteioPayload & { qrCodeUnicoId: string; qrSlug: string; qrNome: string },
): Promise<LeadSemEventoResult> {
  const nome = payload.nome?.trim();
  const telefone = payload.telefone?.trim();
  if (!nome) return { ok: false, error: "Informe seu nome." };
  if (!telefone || !telefoneSorteioValido(telefone)) {
    return { ok: false, error: "Informe um telefone/WhatsApp válido." };
  }
  if (!payload.valorMensalDisponivel || payload.valorMensalDisponivel <= 0) {
    return { ok: false, error: "Informe o valor mensal disponível." };
  }
  const tipoRaw = payload.tipoSonho?.trim();
  if (!tipoRaw || !isTipoSonhoSorteio(tipoRaw)) {
    return { ok: false, error: "Selecione o tipo do sonho." };
  }
  const tipoSonho = tipoRaw as TipoSonhoSorteio;
  const valor = payload.valorMensalDisponivel;
  const tipoCredito = tipoSonhoParaCreditoLead(tipoSonho);
  const admin = createAdminClient();
  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .insert({
      nome,
      whatsapp: telefone,
      origem: "qr_unico",
      origem_detalhe: payload.qrSlug,
      tipo_interesse: tipoCredito,
      tipo_credito: tipoCredito,
      valor_credito: valor,
      valor_estimado: valor,
      valor_simulado: valor,
      produto_interesse: tipoCredito,
      evento_id: null,
      evento_nome: null,
      dados_simulacao: {
        origem: "qr_unico",
        qr_code_unico_id: payload.qrCodeUnicoId,
        qr_slug: payload.qrSlug,
        tipo_sonho: tipoSonho,
        valor_mensal_disponivel: valor,
        sem_evento: true,
        telefone_norm: normalizeTelefoneSorteio(telefone),
      },
      status: leadsConfig.statusInicialPadrao ?? "Novo",
      criado_manual: false,
    })
    .select("id")
    .single();
  if (leadErr || !leadRow) return { ok: false, error: leadErr?.message ?? "Falha ao registrar." };

  await registrarEvento({
    tipo_evento: "qr_unico_cadastro_sem_evento",
    origem: "qr_unico",
    lead_id: leadRow.id,
    entidade_tipo: payload.qrCodeUnicoId,
    dados_evento: { qr_slug: payload.qrSlug },
  });

  return { ok: true, leadId: leadRow.id as string };
}
