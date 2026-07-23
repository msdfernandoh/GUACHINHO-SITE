import { createAdminClient } from "@/lib/supabase/admin";
import {
  NPS_PERGUNTAS_FIXAS,
  parseNpsConfig,
  resolverPerguntasNpsPublicas,
  type NpsConfigStored,
  type NpsTipo,
} from "./nps";

export type NpsDashboardEventoOption = { id: string; nome: string; data_evento: string | null };

export type NpsDistribuicao = { nota: number; total: number };

export type NpsDimensaoMedia = {
  chave: string;
  titulo: string;
  media: number | null;
  respostas: number;
  distribuicao: NpsDistribuicao[];
};

export type NpsExportColumn = {
  chave: string;
  titulo: string;
  tipo: NpsTipo;
};

export type NpsRespostaRow = {
  participanteId: string;
  nome: string;
  telefone: string;
  codigo: string;
  valorMensalDisponivel: number | null;
  npsCompletoEm: string | null;
  recomendacao: number | null;
  contatoDiagnostico: boolean | null;
  comentario: string | null;
  respostas: Record<string, unknown>;
};

export type NpsIndicacaoRow = {
  id: string;
  nome: string;
  tipo: string;
  telefone: string;
  cupomGerado: boolean;
  indicadorNome: string;
  indicadorTelefone: string;
  createdAt: string;
};

export type NpsDashboardData = {
  eventoId: string;
  eventoNome: string;
  totalCadastros: number;
  totalComNps: number;
  totalIndicacoes: number;
  totalCuponsIndicacao: number;
  scoreNps: number | null;
  mediaRecomendacao: number | null;
  promotores: number;
  passivos: number;
  detratores: number;
  dimensoes: NpsDimensaoMedia[];
  distribuicaoRecomendacao: NpsDistribuicao[];
  contatoSim: number;
  contatoNao: number;
  perguntasColunas: NpsExportColumn[];
  respostas: NpsRespostaRow[];
  indicacoes: NpsIndicacaoRow[];
};

function emptyDist(): NpsDistribuicao[] {
  return Array.from({ length: 11 }, (_, nota) => ({ nota, total: 0 }));
}

function tituloPergunta(chave: string, config: NpsConfigStored): string {
  const fixa = NPS_PERGUNTAS_FIXAS.find((p) => p.chave === chave);
  if (fixa) return fixa.titulo;
  if (chave.startsWith("custom_")) {
    const id = chave.slice("custom_".length);
    const custom = (config.custom ?? []).find((c) => c.id === id);
    if (custom) return custom.titulo;
  }
  return chave;
}

function asNota(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
  }
  return null;
}

function asBool(v: unknown): boolean | null {
  if (v === true || v === "sim" || v === "true") return true;
  if (v === false || v === "nao" || v === "não" || v === "false") return false;
  return null;
}

export async function listEventosComSorteioParaNps(): Promise<NpsDashboardEventoOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteios")
    .select("evento_id, eventos(id, nome, data_evento)")
    .order("updated_at", { ascending: false });
  if (error) {
    if (/eventos_sorteios|does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  const out: NpsDashboardEventoOption[] = [];
  for (const row of data ?? []) {
    const evRaw = (row as { eventos: NpsDashboardEventoOption | NpsDashboardEventoOption[] | null }).eventos;
    const ev = Array.isArray(evRaw) ? evRaw[0] : evRaw;
    if (!ev?.id) continue;
    out.push({ id: ev.id, nome: ev.nome, data_evento: ev.data_evento });
  }
  return out;
}

export async function fetchNpsDashboard(eventoId: string): Promise<NpsDashboardData | null> {
  const admin = createAdminClient();
  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, nome")
    .eq("id", eventoId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!evento) return null;

  const { data: sorteio } = await admin
    .from("eventos_sorteios")
    .select("id, nps_config")
    .eq("evento_id", eventoId)
    .maybeSingle();

  const config = parseNpsConfig(sorteio?.nps_config);
  const perguntasColunas: NpsExportColumn[] = resolverPerguntasNpsPublicas(config).map((p) => ({
    chave: p.chave,
    titulo: p.titulo,
    tipo: p.tipo,
  }));
  const sorteioId = sorteio?.id as string | undefined;

  let participantes: Array<{
    id: string;
    nome: string;
    telefone: string;
    codigo: string;
    origem_cupom: string | null;
    valor_mensal_disponivel: number | null;
    nps_respostas: Record<string, unknown> | null;
    nps_completo_em: string | null;
  }> = [];

  if (sorteioId) {
    const { data, error } = await admin
      .from("eventos_sorteio_participantes")
      .select(
        "id, nome, telefone, codigo, origem_cupom, valor_mensal_disponivel, nps_respostas, nps_completo_em",
      )
      .eq("sorteio_id", sorteioId)
      .eq("status", "participando")
      .order("created_at", { ascending: false });
    if (error) {
      if (/nps_respostas|does not exist|schema cache/i.test(error.message)) {
        // migration pendente
      } else {
        throw new Error(error.message);
      }
    } else {
      participantes = (data ?? []) as typeof participantes;
    }
  }

  const cadastros = participantes.filter((p) => (p.origem_cupom ?? "cadastro") === "cadastro");
  const comNps = cadastros.filter((p) => p.nps_completo_em && p.nps_respostas);

  let indicacoesRaw: Array<{
    id: string;
    nome: string;
    tipo: string;
    telefone: string;
    cupom_gerado: boolean;
    created_at: string;
    indicador_participante_id: string;
  }> = [];

  if (sorteioId) {
    const { data: indData, error: indErr } = await admin
      .from("eventos_sorteio_indicacoes")
      .select("id, nome, tipo, telefone, cupom_gerado, created_at, indicador_participante_id")
      .eq("sorteio_id", sorteioId)
      .order("created_at", { ascending: false });
    if (indErr) {
      if (!/eventos_sorteio_indicacoes|does not exist|schema cache/i.test(indErr.message)) {
        throw new Error(indErr.message);
      }
    } else {
      indicacoesRaw = (indData ?? []) as typeof indicacoesRaw;
    }
  }

  const byId = new Map(participantes.map((p) => [p.id, p]));
  const indicacoes: NpsIndicacaoRow[] = indicacoesRaw.map((i) => {
    const ind = byId.get(i.indicador_participante_id);
    return {
      id: i.id,
      nome: i.nome,
      tipo: i.tipo,
      telefone: i.telefone,
      cupomGerado: !!i.cupom_gerado,
      indicadorNome: ind?.nome ?? "—",
      indicadorTelefone: ind?.telefone ?? "—",
      createdAt: i.created_at,
    };
  });

  const distRec = emptyDist();
  let somaRec = 0;
  let nRec = 0;
  let promotores = 0;
  let passivos = 0;
  let detratores = 0;
  let contatoSim = 0;
  let contatoNao = 0;

  const dimKeys = new Set<string>();
  for (const p of comNps) {
    const r = p.nps_respostas ?? {};
    for (const [k, v] of Object.entries(r)) {
      if (asNota(v) != null && k !== "recomendacao_evento") dimKeys.add(k);
    }
  }
  // Dimensões fixas de escala na ordem padrão
  const orderedDims = [
    ...NPS_PERGUNTAS_FIXAS.filter((p) => p.tipo === "escala_0_10").map((p) => p.chave),
    ...[...dimKeys].filter((k) => !NPS_PERGUNTAS_FIXAS.some((p) => p.chave === k)),
  ].filter((k, i, arr) => arr.indexOf(k) === i);

  const dimAcc = new Map<string, { soma: number; n: number; dist: NpsDistribuicao[] }>();
  for (const chave of orderedDims) {
    dimAcc.set(chave, { soma: 0, n: 0, dist: emptyDist() });
  }

  const respostas: NpsRespostaRow[] = [];

  for (const p of comNps) {
    const r = (p.nps_respostas ?? {}) as Record<string, unknown>;
    const rec = asNota(r.recomendacao_evento);
    if (rec != null) {
      distRec[rec]!.total += 1;
      somaRec += rec;
      nRec += 1;
      if (rec >= 9) promotores += 1;
      else if (rec >= 7) passivos += 1;
      else detratores += 1;
    }
    const contato = asBool(r.contato_diagnostico);
    if (contato === true) contatoSim += 1;
    if (contato === false) contatoNao += 1;

    for (const chave of orderedDims) {
      const nota = asNota(r[chave]);
      if (nota == null) continue;
      const acc = dimAcc.get(chave)!;
      acc.soma += nota;
      acc.n += 1;
      acc.dist[nota]!.total += 1;
    }

    respostas.push({
      participanteId: p.id,
      nome: p.nome,
      telefone: p.telefone,
      codigo: p.codigo,
      valorMensalDisponivel:
        p.valor_mensal_disponivel != null ? Number(p.valor_mensal_disponivel) : null,
      npsCompletoEm: p.nps_completo_em,
      recomendacao: rec,
      contatoDiagnostico: contato,
      comentario: typeof r.comentario === "string" ? r.comentario : null,
      respostas: r,
    });
  }

  const totalClassificados = promotores + passivos + detratores;
  const scoreNps =
    totalClassificados > 0
      ? Math.round(((promotores - detratores) / totalClassificados) * 100)
      : null;

  const dimensoes: NpsDimensaoMedia[] = orderedDims.map((chave) => {
    const acc = dimAcc.get(chave)!;
    return {
      chave,
      titulo: tituloPergunta(chave, config),
      media: acc.n > 0 ? Math.round((acc.soma / acc.n) * 10) / 10 : null,
      respostas: acc.n,
      distribuicao: acc.dist,
    };
  });

  return {
    eventoId,
    eventoNome: evento.nome as string,
    totalCadastros: cadastros.length,
    totalComNps: comNps.length,
    totalIndicacoes: indicacoes.length,
    totalCuponsIndicacao: indicacoes.filter((i) => i.cupomGerado).length,
    scoreNps,
    mediaRecomendacao: nRec > 0 ? Math.round((somaRec / nRec) * 10) / 10 : null,
    promotores,
    passivos,
    detratores,
    dimensoes,
    distribuicaoRecomendacao: distRec,
    contatoSim,
    contatoNao,
    perguntasColunas,
    respostas,
    indicacoes,
  };
}
