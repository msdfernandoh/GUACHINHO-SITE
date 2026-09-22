import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone } from "@/lib/utils/format";
import {
  labelVeiculo,
  labelMoradia,
  labelCapacidade,
  labelAvaliacaoEncontro,
  labelMomentoOportunidade,
} from "@/lib/eventos-sorteio/checkin-conversacional-types";

export type EnrichedEventoParticipante = {
  id: string;
  evento_id: string;
  lead_id: string | null;
  nome_participante: string;
  telefone_participante: string;
  tem_acompanhante: boolean;
  nome_acompanhante: string | null;
  telefone_acompanhante: string | null;
  nome_convidou: string | null;
  empresa_convidou: string | null;
  observacao: string | null;
  quantidade_vagas: number;
  status: string;
  created_at: string;
  checkin_at: string | null;
  // Qualificação Comercial & Sorteio
  codigo_sorteio: string | null;
  veiculo: string | null;
  veiculo_label: string;
  moradia: string | null;
  moradia_label: string;
  investimento: string | null;
  investimento_label: string;
  avaliacao_encontro: string | null;
  avaliacao_encontro_label: string;
  avaliacao_melhoria: string | null;
  momento_oportunidade: string | null;
  momento_oportunidade_label: string;
};

export type ParticipantesResumoStats = {
  totalConvidados: number;
  confirmados: number;
  presentes: number;
  checkins: number;
  comVeiculo: number;
  aluguel: number;
  investimentoAcima1k: number;
};

export type ParticipantesFiltros = {
  status?: string;
  checkin?: "sim" | "nao" | "";
  veiculo?: string;
  moradia?: string;
  investimento?: string;
  convidou?: string;
  busca?: string;
  acompanhante?: string;
};

export async function fetchParticipantesEventoEnriquecidos(
  eventoId: string,
  filtros?: ParticipantesFiltros
): Promise<{
  participantes: EnrichedEventoParticipante[];
  resumo: ParticipantesResumoStats;
  totalSemFiltro: number;
}> {
  const admin = createAdminClient();

  // 1. Buscar participantes da lista oficial
  const { data: listaParticipantes, error: partErr } = await admin
    .from("eventos_participantes")
    .select("*")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: false });

  if (partErr) throw new Error(partErr.message);

  // 2. Buscar participantes do sorteio (número da sorte + respostas de qualificação comercial)
  const { data: sorteioParticipantes } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, nome, evento_participante_id, telefone, codigo, qualificacao_respostas, created_at, status")
    .eq("evento_id", eventoId);

  // 3. Mapear por evento_participante_id e por telefone normalizado
  const sorteioByPartId = new Map<string, any>();
  const sorteioByPhone = new Map<string, any>();

  for (const sp of sorteioParticipantes ?? []) {
    if (sp.evento_participante_id) {
      sorteioByPartId.set(sp.evento_participante_id, sp);
    }
    const tel = digitsOnlyPhone(sp.telefone);
    if (tel) {
      sorteioByPhone.set(tel, sp);
    }
  }

  // 4. Enriquecer lista oficial
  const allEnriched: EnrichedEventoParticipante[] = [];
  const matchedSorteioIds = new Set<string>();

  for (const p of listaParticipantes ?? []) {
    const telNorm = digitsOnlyPhone(p.telefone_participante);
    const sp = sorteioByPartId.get(p.id) || (telNorm ? sorteioByPhone.get(telNorm) : null);

    if (sp) {
      matchedSorteioIds.add(sp.id);
    }

    const qResp = (sp?.qualificacao_respostas as Record<string, string> | undefined) ?? {};
    const veiculo = qResp.veiculo || null;
    const moradia = qResp.moradia || null;
    const investimento = qResp.capacidade_mensal || qResp.investimento || null;
    const avaliacaoEncontro = qResp.avaliacao_encontro || null;
    const avaliacaoMelhoria = qResp.avaliacao_melhoria || null;
    const momentoOportunidade = qResp.momento_oportunidade || null;

    allEnriched.push({
      id: p.id,
      evento_id: p.evento_id,
      lead_id: p.lead_id,
      nome_participante: p.nome_participante,
      telefone_participante: p.telefone_participante,
      tem_acompanhante: Boolean(p.tem_acompanhante),
      nome_acompanhante: p.nome_acompanhante,
      telefone_acompanhante: p.telefone_acompanhante,
      nome_convidou: p.nome_convidou,
      empresa_convidou: p.empresa_convidou,
      observacao: p.observacao,
      quantidade_vagas: p.quantidade_vagas || 1,
      status: p.status,
      created_at: p.created_at,
      checkin_at: p.checkin_at || (sp ? sp.created_at : null),
      codigo_sorteio: sp?.codigo || null,
      veiculo,
      veiculo_label: labelVeiculo(veiculo),
      moradia,
      moradia_label: labelMoradia(moradia),
      investimento,
      investimento_label: labelCapacidade(investimento),
      avaliacao_encontro: avaliacaoEncontro,
      avaliacao_encontro_label: labelAvaliacaoEncontro(avaliacaoEncontro),
      avaliacao_melhoria: avaliacaoMelhoria,
      momento_oportunidade: momentoOportunidade,
      momento_oportunidade_label: labelMomentoOportunidade(momentoOportunidade),
    });
  }

  // 5. Incluir participantes do sorteio que fizeram check-in direto via QR sem cadastro prévio
  for (const sp of sorteioParticipantes ?? []) {
    if (!matchedSorteioIds.has(sp.id)) {
      const qResp = (sp.qualificacao_respostas as Record<string, string> | undefined) ?? {};
      const veiculo = qResp.veiculo || null;
      const moradia = qResp.moradia || null;
      const investimento = qResp.capacidade_mensal || qResp.investimento || null;
      const avaliacaoEncontro = qResp.avaliacao_encontro || null;
      const avaliacaoMelhoria = qResp.avaliacao_melhoria || null;
      const momentoOportunidade = qResp.momento_oportunidade || null;

      allEnriched.push({
        id: `sorteio_${sp.id}`,
        evento_id: eventoId,
        lead_id: null,
        nome_participante: sp.nome || "Participante do Sorteio",
        telefone_participante: sp.telefone || "",
        tem_acompanhante: false,
        nome_acompanhante: null,
        telefone_acompanhante: null,
        nome_convidou: null,
        empresa_convidou: null,
        observacao: "Check-in realizado via QR Code / Sorteio",
        quantidade_vagas: 1,
        status: "presente",
        created_at: sp.created_at,
        checkin_at: sp.created_at,
        codigo_sorteio: sp.codigo,
        veiculo,
        veiculo_label: labelVeiculo(veiculo),
        moradia,
        moradia_label: labelMoradia(moradia),
        investimento,
        investimento_label: labelCapacidade(investimento),
        avaliacao_encontro: avaliacaoEncontro,
        avaliacao_encontro_label: labelAvaliacaoEncontro(avaliacaoEncontro),
        avaliacao_melhoria: avaliacaoMelhoria,
        momento_oportunidade: momentoOportunidade,
        momento_oportunidade_label: labelMomentoOportunidade(momentoOportunidade),
      });
    }
  }

  // 6. Calcular resumo global e aplicar filtros
  const resumo = calcularResumoParticipantes(allEnriched);
  const filtrados = filtrarParticipantes(allEnriched, filtros);

  return {
    participantes: filtrados,
    resumo,
    totalSemFiltro: allEnriched.length,
  };
}

export function calcularResumoParticipantes(
  participantes: EnrichedEventoParticipante[]
): ParticipantesResumoStats {
  let confirmados = 0;
  let presentes = 0;
  let checkins = 0;
  let comVeiculo = 0;
  let aluguel = 0;
  let investimentoAcima1k = 0;

  for (const p of participantes) {
    if (p.status === "confirmado") confirmados++;
    if (p.status === "presente") presentes++;
    if (p.checkin_at || p.codigo_sorteio) checkins++;
    if (p.veiculo && ["carro", "moto", "carro_moto"].includes(p.veiculo)) comVeiculo++;
    if (p.moradia === "aluguel") aluguel++;
    if (p.investimento && ["1000_2000", "acima_2000"].includes(p.investimento)) investimentoAcima1k++;
  }

  return {
    totalConvidados: participantes.length,
    confirmados,
    presentes,
    checkins,
    comVeiculo,
    aluguel,
    investimentoAcima1k,
  };
}

export function filtrarParticipantes(
  participantes: EnrichedEventoParticipante[],
  filtros?: ParticipantesFiltros
): EnrichedEventoParticipante[] {
  let filtrados = participantes;

  if (filtros?.status) {
    filtrados = filtrados.filter((p) => p.status === filtros.status);
  }

  if (filtros?.checkin === "sim") {
    filtrados = filtrados.filter((p) => Boolean(p.checkin_at || p.codigo_sorteio));
  } else if (filtros?.checkin === "nao") {
    filtrados = filtrados.filter((p) => !p.checkin_at && !p.codigo_sorteio);
  }

  if (filtros?.veiculo) {
    filtrados = filtrados.filter((p) => p.veiculo === filtros.veiculo);
  }

  if (filtros?.moradia) {
    filtrados = filtrados.filter((p) => p.moradia === filtros.moradia);
  }

  if (filtros?.investimento) {
    filtrados = filtrados.filter((p) => p.investimento === filtros.investimento);
  }

  if (filtros?.convidou?.trim()) {
    const term = normalizeSearch(filtros.convidou.trim());
    filtrados = filtrados.filter((p) => normalizeSearch(p.nome_convidou ?? "").includes(term));
  }

  if (filtros?.acompanhante === "sim") {
    filtrados = filtrados.filter((p) => p.tem_acompanhante);
  } else if (filtros?.acompanhante === "nao") {
    filtrados = filtrados.filter((p) => !p.tem_acompanhante);
  }

  if (filtros?.busca?.trim()) {
    const term = normalizeSearch(filtros.busca.trim());
    filtrados = filtrados.filter(
      (p) =>
        normalizeSearch(p.nome_participante).includes(term) ||
        p.telefone_participante.includes(term) ||
        normalizeSearch(p.empresa_convidou ?? "").includes(term) ||
        (p.codigo_sorteio ?? "").toLowerCase().includes(term)
    );
  }

  return filtrados;
}

function normalizeSearch(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
