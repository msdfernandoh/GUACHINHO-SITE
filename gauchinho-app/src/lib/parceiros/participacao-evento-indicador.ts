import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { haVagaDisponivel, quantidadeVagasInscricao, somarVagasUsadas } from "@/lib/comercial-eventos/vagas";

export type EventoConviteIndicador = {
  id: string;
  limite_participantes: number | null;
  permitir_acompanhante: boolean;
};

export async function registrarParticipacaoEventoIndicador(input: {
  evento: EventoConviteIndicador;
  leadId: string;
  nome: string;
  telefone: string;
  nomeIndicador: string;
  empresaIndicador?: string | null;
  observacao?: string | null;
  temAcompanhante: boolean;
  nomeAcompanhante?: string | null;
}) {
  if (input.temAcompanhante && !input.evento.permitir_acompanhante) {
    throw new Error("Este evento não permite acompanhante.");
  }
  const nomeAcompanhante = input.temAcompanhante ? input.nomeAcompanhante?.trim() : null;
  if (input.temAcompanhante && !nomeAcompanhante) throw new Error("Informe o primeiro nome do acompanhante.");

  const admin = createAdminClient();
  const { data: existente } = await admin.from("eventos_participantes")
    .select("id").eq("evento_id", input.evento.id).eq("lead_id", input.leadId)
    .order("created_at").limit(1).maybeSingle();
  const { data: ocupacao, error: ocupacaoError } = await admin.from("eventos_participantes")
    .select("id,quantidade_vagas,status").eq("evento_id", input.evento.id)
    .in("status", ["confirmado", "presente"]);
  if (ocupacaoError) throw new Error("Não foi possível calcular as vagas do evento.");

  const vagasUsadas = somarVagasUsadas((ocupacao ?? []).filter((item) => item.id !== existente?.id));
  const quantidadeVagas = quantidadeVagasInscricao(input.temAcompanhante);
  const status = haVagaDisponivel(input.evento.limite_participantes, vagasUsadas, quantidadeVagas)
    ? "confirmado"
    : "lista_espera";
  const payload = {
    evento_id: input.evento.id,
    lead_id: input.leadId,
    nome_participante: input.nome,
    telefone_participante: input.telefone,
    tem_acompanhante: input.temAcompanhante,
    nome_acompanhante: nomeAcompanhante || null,
    quantidade_vagas: quantidadeVagas,
    nome_convidou: input.nomeIndicador,
    empresa_convidou: input.empresaIndicador || null,
    observacao: input.observacao || null,
    status,
    updated_at: new Date().toISOString(),
  };
  const write = existente
    ? await admin.from("eventos_participantes").update(payload).eq("id", existente.id)
    : await admin.from("eventos_participantes").insert(payload);
  if (write.error) throw new Error("Não foi possível reservar as vagas do evento.");
  return { status, quantidadeVagas, vagasRestantes: input.evento.limite_participantes == null || input.evento.limite_participantes <= 0 ? null : Math.max(0, input.evento.limite_participantes - vagasUsadas - (status === "confirmado" ? quantidadeVagas : 0)) };
}
