"use server";

import { cadastrarParticipanteSorteioPublico } from "@/lib/eventos-sorteio/cadastro";

export async function publicCadastroSorteioAction(
  eventoSlug: string,
  payload: {
    nome: string;
    telefone: string;
    valorMensalDisponivel: number;
    tipoSonho: string;
  },
) {
  return cadastrarParticipanteSorteioPublico(eventoSlug, payload);
}
