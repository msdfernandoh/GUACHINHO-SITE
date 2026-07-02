import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import type { EventoRow, InscricaoEventoPayload, InscricaoEventoResult } from "./types";
import {
  haVagaDisponivel,
  quantidadeVagasInscricao,
  somarVagasUsadas,
  STATUS_OCUPA_VAGA,
} from "./vagas";

const MSG_LISTA_ESPERA =
  "As vagas estão esgotadas, mas seus dados foram registrados na lista de interesse. Se abrir vaga, entraremos em contato.";

export async function inscreverParticipanteEvento(
  evento: EventoRow,
  payload: InscricaoEventoPayload,
): Promise<InscricaoEventoResult> {
  const nome = payload.nomeParticipante.trim();
  const telefone = payload.telefoneParticipante.trim();
  if (!nome || !telefone) throw new Error("Nome e telefone são obrigatórios");

  const temAcompanhante = !!payload.temAcompanhante;
  if (temAcompanhante && evento.permitir_acompanhante) {
    if (!payload.nomeAcompanhante?.trim()) throw new Error("Informe o nome do acompanhante");
  } else if (temAcompanhante && !evento.permitir_acompanhante) {
    throw new Error("Este evento não permite acompanhante");
  }

  const nomeConvidou = payload.nomeConvidou?.trim() || null;
  const empresaConvidou = payload.empresaConvidou?.trim() || null;
  if (evento.exigir_convidou && !nomeConvidou) {
    throw new Error("Informe quem convidou você");
  }

  const vagasNecessarias = quantidadeVagasInscricao(temAcompanhante && evento.permitir_acompanhante);
  const admin = createAdminClient();

  const { data: ocupacao, error: occErr } = await admin
    .from("eventos_participantes")
    .select("quantidade_vagas, status")
    .eq("evento_id", evento.id)
    .in("status", STATUS_OCUPA_VAGA);
  if (occErr) throw new Error(occErr.message);

  const vagasUsadas = somarVagasUsadas((ocupacao ?? []) as { quantidade_vagas: number; status: "confirmado" | "presente" }[]);
  const temVaga = haVagaDisponivel(evento.limite_participantes, vagasUsadas, vagasNecessarias);
  const status = temVaga ? "confirmado" : "lista_espera";

  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
  const dadosInscricao = {
    evento_id: evento.id,
    evento_nome: evento.nome,
    nome_convidou: nomeConvidou,
    empresa_convidou: empresaConvidou,
    tem_acompanhante: temAcompanhante && evento.permitir_acompanhante,
    nome_acompanhante: payload.nomeAcompanhante?.trim() || null,
    observacao: payload.observacao?.trim() || null,
    status_inscricao: status,
  };

  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .insert({
      nome,
      whatsapp: telefone,
      origem: "evento",
      origem_detalhe: evento.slug,
      tipo_interesse: "evento",
      produto_interesse: evento.nome,
      evento_id: evento.id,
      evento_nome: evento.nome,
      parceiro_indicador_nome: nomeConvidou,
      parceiro_indicador_empresa: empresaConvidou,
      observacoes: payload.observacao?.trim() || null,
      dados_simulacao: dadosInscricao,
      status: leadsConfig.statusInicialPadrao ?? "Novo",
      criado_manual: false,
    })
    .select("id")
    .single();
  if (leadErr || !leadRow) throw new Error(leadErr?.message ?? "Falha ao registrar lead");

  const { error: partErr } = await admin.from("eventos_participantes").insert({
    evento_id: evento.id,
    lead_id: leadRow.id,
    nome_participante: nome,
    telefone_participante: telefone,
    tem_acompanhante: temAcompanhante && evento.permitir_acompanhante,
    nome_acompanhante: payload.nomeAcompanhante?.trim() || null,
    telefone_acompanhante: payload.telefoneAcompanhante?.trim() || null,
    nome_convidou: nomeConvidou,
    empresa_convidou: empresaConvidou,
    observacao: payload.observacao?.trim() || null,
    quantidade_vagas: vagasNecessarias,
    status,
  });
  if (partErr) throw new Error(partErr.message);

  await registrarEvento({
    tipo_evento: "evento_inscricao",
    origem: "evento",
    lead_id: leadRow.id,
    entidade_tipo: evento.id,
    dados_evento: { slug: evento.slug, status },
  });

  if (status === "lista_espera") {
    return { ok: true, status: "lista_espera", mensagem: MSG_LISTA_ESPERA };
  }

  const msg =
    evento.mensagem_confirmacao?.trim() ||
    "Inscrição confirmada! Em breve nosso time pode entrar em contato.";
  return { ok: true, status: "confirmado", mensagem: msg };
}
