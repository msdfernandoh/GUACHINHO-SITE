"use server";

import {
  cadastrarParticipanteSorteioFase1,
  salvarNpsSorteioFase2,
} from "@/lib/eventos-sorteio/cadastro";
import {
  concluirIndicacoesSorteio,
  salvarIndicacaoSorteio,
} from "@/lib/eventos-sorteio/indicacoes";

export async function publicCadastroSorteioAction(
  eventoSlug: string,
  payload: {
    nome: string;
    telefone: string;
    valorMensalDisponivel: number;
    tipoSonho: string;
    qrCodeUnicoId?: string | null;
  },
) {
  return cadastrarParticipanteSorteioFase1(eventoSlug, payload);
}

export async function publicNpsSorteioAction(
  participanteId: string,
  respostas: Record<string, unknown>,
) {
  return salvarNpsSorteioFase2(participanteId, respostas);
}

export async function publicIndicacaoSorteioAction(
  participanteId: string,
  payload: { nome: string; tipo: string; telefone: string },
) {
  return salvarIndicacaoSorteio(participanteId, payload);
}

export async function publicConcluirIndicacoesAction(participanteId: string) {
  return concluirIndicacoesSorteio(participanteId);
}
