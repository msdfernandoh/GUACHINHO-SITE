import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";
import { proximoCodigoFromExisting } from "./codigo";
import { normalizeTelefoneSorteio, telefoneSorteioValido } from "./vagas";
import type { TipoIndicacao } from "./types";

export type IndicacaoPayload = {
  nome: string;
  tipo: string;
  telefone: string;
};

export type IndicacaoResult =
  | {
      ok: true;
      cupomGerado: boolean;
      codigoExtra: string | null;
      aviso: string | null;
      codigos: string[];
    }
  | { ok: false; error: string };

function isTipoIndicacao(v: string): v is TipoIndicacao {
  return v === "amigo" || v === "familiar";
}

type LeadIndicacaoSorteioInput = {
  indicadoNome: string;
  indicadoTelefone: string;
  tipo: TipoIndicacao;
  indicadorNome: string;
  indicadorTelefone: string;
  indicadorLeadId: string | null;
  indicadorParticipanteId: string;
  sorteioId: string;
  eventoId: string;
  eventoNome: string | null;
  status: string;
};

export function buildLeadIndicacaoSorteioRow(input: LeadIndicacaoSorteioInput) {
  const relacao = input.tipo === "familiar" ? "Familiar" : "Amigo";
  const observacao = `Indicação realizada no formulário NPS/sorteio. Relação com quem indicou: ${relacao}.`;

  return {
    nome: input.indicadoNome,
    whatsapp: input.indicadoTelefone,
    email: null,
    origem: "indicacao",
    origem_detalhe: "evento_nps_sorteio",
    parceiro_indicador_nome: input.indicadorNome,
    parceiro_indicador_empresa: null,
    parceiro_indicador_telefone: input.indicadorTelefone,
    parentesco_indicacao: input.tipo,
    indicador_lead_id: input.indicadorLeadId,
    tipo_interesse: "outro",
    tipo_credito: null,
    valor_credito: null,
    valor_estimado: null,
    valor_simulado: null,
    produto_interesse: null,
    evento_id: input.eventoId,
    evento_nome: input.eventoNome,
    observacao_indicacao: observacao,
    observacoes: observacao,
    dados_simulacao: {
      origem: "evento_nps_sorteio_indicacao",
      sorteio_id: input.sorteioId,
      evento_id: input.eventoId,
      indicador_participante_id: input.indicadorParticipanteId,
      indicador_lead_id: input.indicadorLeadId,
      parentesco_indicacao: input.tipo,
    },
    status: input.status,
    criado_manual: false,
  };
}

async function fetchCodigosDoIndicador(
  admin: ReturnType<typeof createAdminClient>,
  sorteioId: string,
  telefoneIndicador: string,
): Promise<string[]> {
  const { data } = await admin
    .from("eventos_sorteio_participantes")
    .select("codigo, telefone, origem_cupom, status")
    .eq("sorteio_id", sorteioId)
    .eq("status", "participando");
  const norm = normalizeTelefoneSorteio(telefoneIndicador);
  return (data ?? [])
    .filter((r) => normalizeTelefoneSorteio(r.telefone as string) === norm)
    .map((r) => r.codigo as string)
    .sort();
}

async function criarLeadIndicacaoSorteio(
  admin: ReturnType<typeof createAdminClient>,
  input: LeadIndicacaoSorteioInput,
): Promise<{ id: string } | { error: string }> {
  const row = buildLeadIndicacaoSorteioRow(input);
  let { data, error } = await admin.from("leads").insert(row).select("id").single();

  if (error && isDbMissingColumnError(error)) {
    const legacyRow: Record<string, unknown> = { ...row };
    delete legacyRow.parceiro_indicador_telefone;
    delete legacyRow.parentesco_indicacao;
    delete legacyRow.indicador_lead_id;
    const observacaoLegacy = `${row.observacao_indicacao}\nTelefone de quem indicou: ${input.indicadorTelefone}`;
    ({ data, error } = await admin
      .from("leads")
      .insert({
        ...legacyRow,
        observacao_indicacao: observacaoLegacy,
        observacoes: observacaoLegacy,
      })
      .select("id")
      .single());
  }

  if (error || !data) {
    return { error: error?.message ?? "Falha ao criar o lead da pessoa indicada." };
  }
  return { id: data.id as string };
}

/** Telefone do indicado já tem cadastro principal neste sorteio? */
function telefoneJaCadastradoNoSorteio(
  telefone: string,
  rows: Array<{ telefone: string; origem_cupom?: string | null }>,
): boolean {
  const norm = normalizeTelefoneSorteio(telefone);
  return rows.some(
    (r) =>
      normalizeTelefoneSorteio(r.telefone) === norm &&
      (r.origem_cupom ?? "cadastro") === "cadastro",
  );
}

export async function salvarIndicacaoSorteio(
  participanteId: string,
  payload: IndicacaoPayload,
): Promise<IndicacaoResult> {
  const nome = payload.nome?.trim();
  const telefone = payload.telefone?.trim();
  const tipoRaw = payload.tipo?.trim();
  if (!nome) return { ok: false, error: "Informe o nome do indicado." };
  if (!tipoRaw || !isTipoIndicacao(tipoRaw)) {
    return { ok: false, error: "Selecione se é amigo ou familiar." };
  }
  if (!telefone || !telefoneSorteioValido(telefone)) {
    return { ok: false, error: "Informe um telefone válido do indicado." };
  }

  const admin = createAdminClient();
  const { data: indicador, error: indErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, sorteio_id, evento_id, lead_id, nome, telefone, status, origem_cupom, fase_cadastro")
    .eq("id", participanteId)
    .maybeSingle();
  if (indErr || !indicador) return { ok: false, error: indErr?.message ?? "Participante não encontrado." };
  if (indicador.status !== "participando") return { ok: false, error: "Participação cancelada." };
  if ((indicador.origem_cupom ?? "cadastro") !== "cadastro") {
    return { ok: false, error: "Indicações devem ser feitas pelo cadastro principal." };
  }

  const telefoneIndicador = indicador.telefone as string;
  if (normalizeTelefoneSorteio(telefone) === normalizeTelefoneSorteio(telefoneIndicador)) {
    return { ok: false, error: "Não é possível indicar o próprio telefone." };
  }

  const { data: existentes, error: exErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("telefone, origem_cupom")
    .eq("sorteio_id", indicador.sorteio_id)
    .eq("status", "participando");
  if (exErr) return { ok: false, error: exErr.message };

  const jaCadastrado = telefoneJaCadastradoNoSorteio(telefone, (existentes ?? []) as Array<{ telefone: string; origem_cupom?: string | null }>);
  const [{ data: evento }, leadsConfig] = await Promise.all([
    admin.from("eventos").select("nome").eq("id", indicador.evento_id).maybeSingle(),
    getConfigJsonPublic("leads", DEFAULT_LEADS),
  ]);
  const leadResult = await criarLeadIndicacaoSorteio(admin, {
    indicadoNome: nome,
    indicadoTelefone: telefone,
    tipo: tipoRaw,
    indicadorNome: String(indicador.nome).trim(),
    indicadorTelefone: telefoneIndicador,
    indicadorLeadId: (indicador.lead_id as string | null) ?? null,
    indicadorParticipanteId: indicador.id as string,
    sorteioId: indicador.sorteio_id as string,
    eventoId: indicador.evento_id as string,
    eventoNome: (evento?.nome as string | null)?.trim() || null,
    status: leadsConfig.statusInicialPadrao ?? "Novo",
  });
  if ("error" in leadResult) return { ok: false, error: leadResult.error };
  const leadIndicadoId = leadResult.id;
  const removerLeadIndicado = async () => {
    await admin.from("leads").delete().eq("id", leadIndicadoId);
  };

  let cupomGerado = false;
  let codigoExtra: string | null = null;
  let aviso: string | null = null;
  let participanteCupomId: string | null = null;

  if (jaCadastrado) {
    aviso = "Indicação registrada, mas não geramos cupom extra: este telefone já está cadastrado no sorteio.";
  } else {
    const { data: codigosRows, error: codErr } = await admin
      .from("eventos_sorteio_participantes")
      .select("codigo")
      .eq("evento_id", indicador.evento_id);
    if (codErr) {
      await removerLeadIndicado();
      return { ok: false, error: codErr.message };
    }

    codigoExtra = proximoCodigoFromExisting((codigosRows ?? []).map((r) => r.codigo as string));
    const { data: cupomRow, error: cupomErr } = await admin
      .from("eventos_sorteio_participantes")
      .insert({
        sorteio_id: indicador.sorteio_id,
        evento_id: indicador.evento_id,
        lead_id: null,
        codigo: codigoExtra,
        nome: indicador.nome,
        telefone: telefoneIndicador,
        valor_mensal_disponivel: null,
        tipo_sonho: null,
        quem_convidou: nome,
        observacao: `Cupom por indicação de ${nome} (${tipoRaw})`,
        status: "participando",
        ganhador: false,
        fase_cadastro: "completo",
        origem_cupom: "indicacao",
        participante_principal_id: indicador.id,
      })
      .select("id")
      .single();
    if (cupomErr || !cupomRow) {
      await removerLeadIndicado();
      return { ok: false, error: cupomErr?.message ?? "Falha ao gerar cupom." };
    }
    cupomGerado = true;
    participanteCupomId = cupomRow.id as string;
  }

  const indicacaoRow: Record<string, unknown> = {
    sorteio_id: indicador.sorteio_id,
    evento_id: indicador.evento_id,
    indicador_participante_id: indicador.id,
    lead_id: leadIndicadoId,
    nome,
    tipo: tipoRaw,
    telefone,
    cupom_gerado: cupomGerado,
    participante_cupom_id: participanteCupomId,
    aviso,
  };
  let { error: insErr } = await admin.from("eventos_sorteio_indicacoes").insert(indicacaoRow);

  if (insErr && isDbMissingColumnError(insErr)) {
    const legacyIndicacaoRow = { ...indicacaoRow };
    delete legacyIndicacaoRow.lead_id;
    ({ error: insErr } = await admin
      .from("eventos_sorteio_indicacoes")
      .insert(legacyIndicacaoRow));
  }

  if (insErr) {
    await removerLeadIndicado();
    return { ok: false, error: insErr.message };
  }

  await registrarEvento({
    tipo_evento: "lead_criado",
    origem: "indicacao",
    pagina: "evento_nps_sorteio",
    lead_id: leadIndicadoId,
    entidade_tipo: indicador.evento_id as string,
    dados_evento: {
      indicador: String(indicador.nome).trim(),
      indicadorTelefone: telefoneIndicador,
      indicadorParticipanteId: indicador.id,
      parentesco: tipoRaw,
      origemFluxo: "nps_sorteio",
    },
  });

  const codigos = await fetchCodigosDoIndicador(admin, indicador.sorteio_id as string, telefoneIndicador);
  return { ok: true, cupomGerado, codigoExtra, aviso, codigos };
}

export async function concluirIndicacoesSorteio(
  participanteId: string,
): Promise<{ ok: true; textoAgradecimento: string; codigos: string[] } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: indicador, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, sorteio_id, telefone, status, origem_cupom")
    .eq("id", participanteId)
    .maybeSingle();
  if (error || !indicador) return { ok: false, error: error?.message ?? "Participante não encontrado." };
  if (indicador.status !== "participando") return { ok: false, error: "Participação cancelada." };

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("eventos_sorteio_participantes")
    .update({
      fase_cadastro: "completo",
      indicacoes_concluido_em: now,
      updated_at: now,
    })
    .eq("id", participanteId);
  if (updErr) return { ok: false, error: updErr.message };

  const { data: sorteio } = await admin
    .from("eventos_sorteios")
    .select("texto_agradecimento")
    .eq("id", indicador.sorteio_id)
    .maybeSingle();

  const codigos = await fetchCodigosDoIndicador(
    admin,
    indicador.sorteio_id as string,
    indicador.telefone as string,
  );

  return {
    ok: true,
    textoAgradecimento:
      (sorteio?.texto_agradecimento as string | null)?.trim() ||
      "Obrigado por participar! Guarde seus códigos para acompanhar o sorteio.",
    codigos,
  };
}
