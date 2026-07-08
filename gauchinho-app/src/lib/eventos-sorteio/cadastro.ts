import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import { proximoCodigoFromExisting } from "./codigo";
import { isTipoSonhoSorteio, tipoSonhoParaCreditoLead } from "./lead-map";
import {
  telefoneJaParticipouSorteio,
  telefoneSorteioValido,
} from "./vagas";
import type { TipoSonhoSorteio } from "./types";
import { fetchPublicSorteioByEventoSlug } from "./public";

export type CadastroSorteioPayload = {
  nome: string;
  telefone: string;
  valorMensalDisponivel: number;
  tipoSonho: string;
};

export type CadastroSorteioResult =
  | { ok: true; codigo: string; textoAgradecimento: string; eventoSlug: string }
  | { ok: false; error: string };

export async function cadastrarParticipanteSorteioPublico(
  eventoSlug: string,
  payload: CadastroSorteioPayload,
): Promise<CadastroSorteioResult> {
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
    .select("telefone")
    .eq("sorteio_id", view.sorteioId)
    .eq("status", "participando");
  if (telErr) return { ok: false, error: telErr.message };

  if (
    telefoneJaParticipouSorteio(
      telefone,
      (existentes ?? []).map((r) => r.telefone as string),
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
      produto_interesse: view.eventoNome,
      evento_id: view.eventoId,
      evento_nome: view.eventoNome,
      dados_simulacao: dadosSimulacao,
      status: leadsConfig.statusInicialPadrao ?? "Novo",
      criado_manual: false,
    })
    .select("id")
    .single();
  if (leadErr || !leadRow) return { ok: false, error: leadErr?.message ?? "Falha ao registrar lead." };

  const { error: partErr } = await admin.from("eventos_sorteio_participantes").insert({
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
  });
  if (partErr) return { ok: false, error: partErr.message };

  await registrarEvento({
    tipo_evento: "evento_sorteio_cadastro",
    origem: "evento_sorteio",
    lead_id: leadRow.id,
    entidade_tipo: view.sorteioId,
    dados_evento: { codigo, evento_slug: view.eventoSlug },
  });

  return {
    ok: true,
    codigo,
    textoAgradecimento: view.textoAgradecimento,
    eventoSlug: view.eventoSlug,
  };
}
