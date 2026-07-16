import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, sorteio_id, evento_id, nome, telefone, status, origem_cupom, fase_cadastro")
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
    if (codErr) return { ok: false, error: codErr.message };

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
    if (cupomErr || !cupomRow) return { ok: false, error: cupomErr?.message ?? "Falha ao gerar cupom." };
    cupomGerado = true;
    participanteCupomId = cupomRow.id as string;
  }

  const { error: insErr } = await admin.from("eventos_sorteio_indicacoes").insert({
    sorteio_id: indicador.sorteio_id,
    evento_id: indicador.evento_id,
    indicador_participante_id: indicador.id,
    nome,
    tipo: tipoRaw,
    telefone,
    cupom_gerado: cupomGerado,
    participante_cupom_id: participanteCupomId,
    aviso,
  });
  if (insErr) return { ok: false, error: insErr.message };

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
