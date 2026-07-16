"use server";

import { cadastrarLeadQrSemEvento } from "@/lib/eventos-sorteio/cadastro";

export async function publicCadastroQrSemEventoAction(payload: {
  nome: string;
  telefone: string;
  valorMensalDisponivel: number;
  tipoSonho: string;
  qrCodeUnicoId: string;
  qrSlug: string;
  qrNome: string;
}) {
  return cadastrarLeadQrSemEvento(payload);
}
