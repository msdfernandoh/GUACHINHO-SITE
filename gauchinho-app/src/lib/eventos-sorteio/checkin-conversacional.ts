import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { proximoCodigoFromExisting } from "./codigo";

export * from "./checkin-conversacional-types";
import {
  type QualificacaoRespostasPayload,
  type CheckinConversacionalResult,
  labelVeiculo,
  labelMoradia,
  labelCapacidade,
} from "./checkin-conversacional-types";

/**
 * Consulta prévia se o WhatsApp já confirmou presença no evento informado.
 * Garante unicidade por (evento_id + telefone).
 */
export async function consultarCheckinExistente(
  eventoId: string,
  whatsapp: string,
): Promise<{ cadastrado: boolean; nome?: string; codigo?: string; checkinAt?: string }> {
  const norm = digitsOnlyPhone(whatsapp);
  if (!norm || norm.length < 8) return { cadastrado: false };

  const admin = createAdminClient();

  // Tenta via RPC primeiro
  try {
    const { data: rpcData, error: rpcErr } = await admin.rpc("rpc_consultar_checkin_evento", {
      p_evento_id: eventoId,
      p_whatsapp: norm,
    });
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const res = rpcData as { ok?: boolean; cadastrado?: boolean; nome?: string; codigo?: string; checkin_at?: string };
      if (res.cadastrado && res.codigo) {
        return { cadastrado: true, nome: res.nome, codigo: res.codigo, checkinAt: res.checkin_at };
      }
      return { cadastrado: false };
    }
  } catch {
    /* fallback direto para query */
  }

  // Fallback direto seguro
  const { data } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, codigo, nome, telefone, status, eventos_participantes(checkin_at)")
    .eq("evento_id", eventoId)
    .eq("status", "participando");

  for (const row of data ?? []) {
    if (digitsOnlyPhone(row.telefone as string) === norm) {
      const ep = Array.isArray(row.eventos_participantes)
        ? row.eventos_participantes[0]
        : row.eventos_participantes;
      return {
        cadastrado: true,
        nome: row.nome as string,
        codigo: row.codigo as string,
        checkinAt: ep?.checkin_at as string | undefined,
      };
    }
  }

  return { cadastrado: false };
}

/**
 * Executa o check-in mobile conversacional atomicamente.
 * 1. Verifica duplicidade no evento
 * 2. Cria ou localiza Lead (preservando histórico)
 * 3. Salva presença oficial em eventos_participantes (status = 'presente', checkin_at = now())
 * 4. Emite número da sorte sequencial seguro em eventos_sorteio_participantes
 * 5. Registra qualificacao_respostas separada de nps_respostas
 * 6. Grava histórico auditável em leads_eventos_qualificacoes e lead_atividades
 */
export async function executarCheckinConversacional(params: {
  eventoId: string;
  nome: string;
  whatsapp: string;
  qualificacao: QualificacaoRespostasPayload;
  qrCodeUnicoId?: string | null;
  lgpdVersao?: string;
}): Promise<CheckinConversacionalResult> {
  const nome = params.nome?.trim();
  const telNorm = digitsOnlyPhone(params.whatsapp);

  if (!nome) return { ok: false, error: "Por favor, informe seu nome." };
  if (!telNorm || telNorm.length < 10) {
    return { ok: false, error: "WhatsApp inválido. Informe o DDD e o número completo." };
  }

  const admin = createAdminClient();

  // 1. Tentar execução pela RPC atômica (com advisory lock e concorrência garantida)
  try {
    const { data: rpcRes, error: rpcErr } = await admin.rpc("rpc_realizar_checkin_conversacional", {
      p_evento_id: params.eventoId,
      p_nome: nome,
      p_whatsapp: formatWhatsappBrInput(telNorm),
      p_qualificacao: params.qualificacao,
      p_lgpd_versao: params.lgpdVersao ?? "v1_checkin_evento",
      p_qr_code_unico_id: params.qrCodeUnicoId ?? null,
    });

    if (!rpcErr && rpcRes && typeof rpcRes === "object") {
      const r = rpcRes as {
        ok?: boolean;
        ja_cadastrado?: boolean;
        nome?: string;
        codigo?: string;
        evento_nome?: string;
        error?: string;
      };
      if (r.ok && r.codigo) {
        return {
          ok: true,
          jaCadastrado: Boolean(r.ja_cadastrado),
          nome: r.nome ?? nome,
          codigo: r.codigo,
          eventoNome: r.evento_nome,
        };
      }
      if (r.error) return { ok: false, error: r.error };
    }
  } catch (err) {
    console.warn("[checkin-conversacional] RPC fallback:", err instanceof Error ? err.message : err);
  }

  // 2. Fallback resiliente caso a RPC ainda não esteja em cache
  // 2.1 Verifica evento
  const { data: ev, error: evErr } = await admin
    .from("eventos")
    .select("id, nome, slug, ativo, prefixo_codigo_sorteio")
    .eq("id", params.eventoId)
    .maybeSingle();
  if (evErr || !ev) return { ok: false, error: "Evento não encontrado ou indisponível." };
  if (!ev.ativo) return { ok: false, error: "Este evento não está mais ativo." };

  // 2.2 Duplicidade
  const check = await consultarCheckinExistente(params.eventoId, params.whatsapp);
  if (check.cadastrado && check.codigo) {
    return {
      ok: true,
      jaCadastrado: true,
      nome: check.nome ?? nome,
      codigo: check.codigo,
      eventoNome: ev.nome,
    };
  }

  // 2.3 Sorteio do evento
  let sorteioId: string | null = null;
  const { data: sorteio } = await admin
    .from("eventos_sorteios")
    .select("id")
    .eq("evento_id", params.eventoId)
    .maybeSingle();

  if (sorteio?.id) {
    sorteioId = sorteio.id as string;
  } else {
    const { data: novoSorteio } = await admin
      .from("eventos_sorteios")
      .insert({ evento_id: params.eventoId, ativo: true, titulo: `Sorteio — ${ev.nome}`, status: "aberto" })
      .select("id")
      .single();
    if (novoSorteio?.id) sorteioId = novoSorteio.id as string;
  }

  // 2.4 Lead no CRM (localiza existente ou cria novo)
  const telFmt = formatWhatsappBrInput(telNorm);
  const { data: leadExistente } = await admin
    .from("leads")
    .select("id")
    .ilike("whatsapp", `%${telNorm}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let leadId = leadExistente?.id as string | undefined;
  if (leadId) {
    await admin
      .from("leads")
      .update({ ultima_interacao_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", leadId);
  } else {
    const { data: novoLead } = await admin
      .from("leads")
      .insert({
        nome,
        whatsapp: telFmt,
        origem: "evento_checkin",
        origem_detalhe: ev.slug,
        evento_id: params.eventoId,
        evento_nome: ev.nome,
        status: "Novo",
        criado_manual: false,
        dados_simulacao: {
          origem: "qr_checkin_conversacional",
          evento_id: params.eventoId,
          evento_nome: ev.nome,
          qualificacao: params.qualificacao,
          qr_code_unico_id: params.qrCodeUnicoId ?? null,
        },
      })
      .select("id")
      .single();
    if (novoLead?.id) leadId = novoLead.id as string;
  }

  // 2.5 Calcula próximo número
  const { data: codigosRows } = await admin
    .from("eventos_sorteio_participantes")
    .select("codigo")
    .eq("evento_id", params.eventoId);

  const prefixo = (ev.prefixo_codigo_sorteio as string | undefined)?.trim() ?? "";
  const codigo = proximoCodigoFromExisting(
    (codigosRows ?? []).map((r) => r.codigo as string),
    prefixo,
    3,
  );

  const now = new Date().toISOString();

  // 2.6 Auto check-in em eventos_participantes
  const { data: partRow, error: partErr } = await admin
    .from("eventos_participantes")
    .insert({
      evento_id: params.eventoId,
      lead_id: leadId ?? null,
      nome_participante: nome,
      telefone_participante: telFmt,
      status: "presente",
      checkin_at: now,
      quantidade_vagas: 1,
      observacao: "Check-in automático via QR Code interativo",
    })
    .select("id")
    .single();
  if (partErr || !partRow) {
    return { ok: false, error: partErr?.message ?? "Falha ao registrar presença." };
  }

  // 2.7 Emissão do número da sorte
  const sorteioPartPayload: Record<string, unknown> = {
    sorteio_id: sorteioId,
    evento_id: params.eventoId,
    evento_participante_id: partRow.id,
    lead_id: leadId ?? null,
    codigo,
    nome,
    telefone: telFmt,
    status: "participando",
    ganhador: false,
    fase_cadastro: "completo",
    origem_cupom: "cadastro",
    qualificacao_respostas: params.qualificacao,
    lgpd_termo_versao: params.lgpdVersao ?? "v1_checkin_evento",
    lgpd_consentimento_at: now,
    qr_code_unico_id: params.qrCodeUnicoId ?? null,
  };

  const { data: sorteioPart, error: sortErr } = await admin
    .from("eventos_sorteio_participantes")
    .insert(sorteioPartPayload)
    .select("id")
    .single();
  if (sortErr) {
    return { ok: false, error: sortErr.message };
  }

  // 2.8 Histórico no CRM
  if (leadId) {
    try {
      await admin.from("leads_eventos_qualificacoes").insert({
        lead_id: leadId,
        evento_id: params.eventoId,
        evento_nome: ev.nome,
        sorteio_participante_id: sorteioPart?.id ?? null,
        codigo_sorteio: codigo,
        qualificacao_respostas: params.qualificacao,
        lgpd_termo_versao: params.lgpdVersao ?? "v1_checkin_evento",
        lgpd_consentimento_at: now,
        checkin_at: now,
      });
    } catch {
      /* não bloqueia se tabela não aplicada */
    }

    try {
      await admin.from("lead_atividades").insert({
        lead_id: leadId,
        tipo: "evento_checkin",
        titulo: `Check-in no evento ${ev.nome}`,
        descricao: `Número da Sorte: ${codigo}\n• Veículo: ${labelVeiculo(params.qualificacao.veiculo)}\n• Moradia: ${labelMoradia(params.qualificacao.moradia)}\n• Investimento: ${labelCapacidade(params.qualificacao.capacidade_mensal)}`,
        status: "concluida",
        data_conclusao: now,
      });
    } catch {
      /* não bloqueia */
    }
  }

  return {
    ok: true,
    jaCadastrado: false,
    nome,
    codigo,
    eventoNome: ev.nome,
  };
}
