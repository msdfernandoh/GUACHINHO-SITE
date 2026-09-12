"use server";

import {
  consultarCheckinExistente,
  executarCheckinConversacional,
  type QualificacaoRespostasPayload,
} from "@/lib/eventos-sorteio/checkin-conversacional";

export async function consultarCheckinAction(eventoId: string, whatsapp: string) {
  return consultarCheckinExistente(eventoId, whatsapp);
}

export async function submeterCheckinConversacionalAction(params: {
  eventoId: string;
  nome: string;
  whatsapp: string;
  qualificacao: QualificacaoRespostasPayload;
  qrCodeUnicoId?: string | null;
  lgpdVersao?: string;
}) {
  return executarCheckinConversacional(params);
}
