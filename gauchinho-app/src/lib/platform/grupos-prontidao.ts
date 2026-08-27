export type GrupoModalidadeConfig = {
  modo_reduzido?: "fixo" | "personalizado" | "padrao";
  percentual_padrao?: number | null;
  percentual_minimo?: number | null;
  percentual_maximo?: number | null;
  origem?: "ADMINISTRADORA_PADRAO" | "GRUPO_OVERRIDE" | string;
  revisao_platform_pendente?: boolean;
};

export type AdministradoraModalidadeItem = {
  id: string;
  administradora_id?: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  modo_reduzido_padrao?: string | null;
  percentual_padrao?: number | null;
  percentual_minimo?: number | null;
  percentual_maximo?: number | null;
};

export type GrupoModalidadeItem = {
  id?: string;
  administradora_modalidade_id: string;
  ativo: boolean;
  ordem?: number;
  configuracao?: GrupoModalidadeConfig;
  modalidade?: AdministradoraModalidadeItem | null;
};

export type GrupoCotaModalidadeValor = {
  id?: string;
  administradora_modalidade_id: string;
  valor_parcela: number;
  percentual_reducao?: number | null;
  habilitado?: boolean;
  modo_reduzido?: string;
  modo_override?: "HERDAR" | "PERSONALIZADO" | "DESABILITADO" | string;
  percentual_override?: number | null;
  percentual_minimo?: number | null;
  percentual_maximo?: number | null;
  ativo?: boolean;
  modalidade?: {
    id?: string;
    nome: string;
    codigo: string;
  } | null;
};

export type GrupoCotaItem = {
  id: string;
  valor_credito: number;
  valor_parcela?: number;
  status?: string;
  ativo: boolean;
  grupo_cota_modalidade_valores?: GrupoCotaModalidadeValor[];
};

export type TipoContemplacao =
  | "SORTEIO"
  | "SORTEIO_CANCELADAS"
  | "LANCE_LIVRE"
  | "LANCE_FIXO"
  | "LANCE_EMBUTIDO"
  | "LANCE_FIDELIDADE"
  | "OUTRO"
  | string;

export const DEFAULT_TIPOS_CONTEMPLACAO: Array<{ value: string; label: string }> = [
  { value: "SORTEIO", label: "Sorteio" },
  { value: "SORTEIO_CANCELADAS", label: "Sorteio de cotas canceladas" },
  { value: "LANCE_LIVRE", label: "Lance Livre" },
  { value: "LANCE_FIXO", label: "Lance Fixo" },
  { value: "LANCE_EMBUTIDO", label: "Lance Embutido" },
  { value: "LANCE_FIDELIDADE", label: "Lance Fidelidade" },
  { value: "OUTRO", label: "Outro" },
];

export type CaracteristicaContemplacaoItem = {
  id?: string;
  ordem: number;
  tipo: TipoContemplacao;
  tipo_label?: string;
  condicao_percentual?: string | null;
  percentual?: number | null;
  observacao?: string | null;
  ativa: boolean;
};

export type ResumoContemplacoesPotencial = {
  totalPotencial: number;
  textoPotencial: string;
  resumoModalidades: string;
  resumoCurto: string;
  sorteios: number;
  livres: number;
  fixos: number;
  embutidos: number;
  fidelidade: number;
  outros: number;
};

export type GrupoEstatisticas = {
  caracteristicas_contemplacao?: CaracteristicaContemplacaoItem[];
  lance_livre_minimo?: number | null;
  lance_livre_medio?: number | null;
  lance_livre_maximo?: number | null;
  data_referencia?: string | null;
  contemplados_mes_anterior_qtd?: number | null;
  limite_lance_embutido_percentual?: number | null;
  lance_embutido_permitido?: boolean;
  lance_fidelidade_permitido?: boolean;
  origem_informacao?: string | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
  updated_at?: string | null;
  // Campos legados mantidos para compatibilidade
  contemplacoes_sorteio_qtd?: number | null;
  lance_embutido_25_permitido?: boolean;
  lance_embutido_50_permitido?: boolean;
  lance_fidelidade_percentual?: number | null;
};

export type GrupoRecord = {
  id: string;
  codigo_grupo: string;
  administradora_id?: string | null;
  administradora?: string | { nome?: string } | null;
  tipo_administradora_id?: string | null;
  tipo?: { id?: string; nome?: string; codigo?: string } | null;
  modalidade?: string | null;
  status?: string;
  ativo: boolean;
  prazo_total?: number | null;
  data_primeira_assembleia?: string | null;
  parcelas_realizadas?: number | null;
  prazo_restante?: number | null;
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_percentual?: number | null;
  seguro_habilitado?: boolean;
  capacidade_total?: number | null;
  vagas_disponiveis?: number | null;
  vagas_atualizado_em?: string | null;
  vagas_atualizado_por?: string | null;
  dados_estatisticos?: GrupoEstatisticas | null;
  dados_estatisticos_atualizado_em?: string | null;
  dados_estatisticos_atualizado_por?: string | null;
  permite_lance_embutido?: boolean;
  percentual_lance_embutido?: number | null;
  origem_governanca?: string;
  status_governanca?: string;
  observacoes?: string | null;
    updated_at?: string;
    credito_reajustado_ate_meses?: number | null;
  modalidades?: GrupoModalidadeItem[];
  produtos?: GrupoCotaItem[];
  categorias?: Array<{ categoria?: { codigo?: string; nome?: string; ativo?: boolean } | null }>;
};

export type AssembleiasTemporalResult = {
  realizadas: number;
  prazoTotal: number;
  restantes: number;
  proximaAssembleia: string | null; // ISO YYYY-MM-DD
  proximaAssembleiaFormatada: string;
  resumoPrazo: string; // "7 / 100 / 93"
  legenda: string; // "7 realizadas • 100 total • 93 restantes"
  encerrado: boolean;
};

export type GrupoProntidaoResult = {
  ready: boolean;
  issues: string[];
  cotaMinima: number | null;
  cotaMaxima: number | null;
  taxaTotal: number;
  totalCotasAtivas: number;
  totalModalidadesAtivas: number;
  temporal: AssembleiasTemporalResult;
  contemplacoes: ResumoContemplacoesPotencial;
};

export function calcularResumoContemplacoes(
  itens: CaracteristicaContemplacaoItem[] | undefined | null,
): ResumoContemplacoesPotencial {
  const list = Array.isArray(itens) ? itens : [];
  const ativas = list.filter((i) => i.ativa !== false);

  let sorteios = 0;
  let livres = 0;
  let fixos = 0;
  let embutidos = 0;
  let fidelidade = 0;
  let outros = 0;

  for (const item of ativas) {
    const t = (item.tipo || "").toUpperCase();
    if (t === "SORTEIO" || t === "SORTEIO_CANCELADAS") {
      sorteios++;
    } else if (t === "LANCE_LIVRE") {
      livres++;
    } else if (t === "LANCE_FIXO") {
      fixos++;
    } else if (t === "LANCE_EMBUTIDO") {
      embutidos++;
    } else if (t === "LANCE_FIDELIDADE") {
      fidelidade++;
    } else {
      outros++;
    }
  }

  const total = ativas.length;
  const textoPotencial = total > 0 ? `Até ${total}/mês` : "Não definido";

  const partsModalidades: string[] = [];
  if (sorteios > 0) partsModalidades.push(`${sorteios} ${sorteios === 1 ? "Sorteio" : "Sorteios"}`);
  if (livres > 0) partsModalidades.push(`${livres} ${livres === 1 ? "Lance Livre" : "Lances Livres"}`);
  if (fixos > 0) partsModalidades.push(`${fixos} ${fixos === 1 ? "Lance Fixo" : "Lances Fixos"}`);
  if (embutidos > 0) partsModalidades.push(`${embutidos} ${embutidos === 1 ? "Lance Embutido" : "Lances Embutidos"}`);
  if (fidelidade > 0) partsModalidades.push(`${fidelidade} ${fidelidade === 1 ? "Lance Fidelidade" : "Lances Fidelidade"}`);
  if (outros > 0) partsModalidades.push(`${outros} Outros`);

  const resumoModalidades = partsModalidades.join(" • ") || "Nenhuma modalidade ativa";

  const partsCurto: string[] = [];
  if (sorteios > 0) partsCurto.push(`${sorteios} Sorteios`);
  if (livres > 0) partsCurto.push(`${livres} Livres`);
  if (fixos > 0) partsCurto.push(`${fixos} Fixos`);
  if (embutidos > 0) partsCurto.push(`${embutidos} Embutidos`);
  if (fidelidade > 0) partsCurto.push(`${fidelidade} Fidelidade`);
  if (outros > 0) partsCurto.push(`${outros} Outros`);

  const resumoCurto = partsCurto.join(" • ") || "—";

  return {
    totalPotencial: total,
    textoPotencial,
    resumoModalidades,
    resumoCurto,
    sorteios,
    livres,
    fixos,
    embutidos,
    fidelidade,
    outros,
  };
}

export function parseBRLNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let str = String(value).trim();
  if (!str) return 0;
  str = str.replace(/[R$\s]/g, "");

  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, "");
    }
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBatchCotasInput(raw: string): number[] {
  if (!raw) return [];
  const matches = raw.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:R\$\s*)?\d+(?:,\d{1,2})?|\d+(?:\.\d+)?/gi) || [];
  const numbers = matches
    .map((m) => parseBRLNumber(m.trim()))
    .filter((n) => n > 0);
  const unique = Array.from(new Set(numbers));
  return unique.sort((a, b) => b - a);
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

export function calcularAssembleiasTemporal(
  dataPrimeiraAssembleia: string | Date | null | undefined,
  prazoTotalMeses: number | null | undefined,
  dataReferencia: string | Date = new Date(),
): AssembleiasTemporalResult {
  const total = Math.max(0, Number(prazoTotalMeses) || 0);

  if (!dataPrimeiraAssembleia || total <= 0) {
    return {
      realizadas: 0,
      prazoTotal: total,
      restantes: total,
      proximaAssembleia: null,
      proximaAssembleiaFormatada: "—",
      resumoPrazo: `0 / ${total} / ${total}`,
      legenda: `0 realizadas • ${total} total • ${total} restantes`,
      encerrado: false,
    };
  }

  // Parse primeira assembleia (UTC-based to avoid local timezone skew)
  let y1: number, m1: number, d1: number;
  if (typeof dataPrimeiraAssembleia === "string") {
    const parts = dataPrimeiraAssembleia.split("T")[0].split("-").map(Number);
    y1 = parts[0];
    m1 = parts[1] - 1;
    d1 = parts[2];
  } else {
    y1 = dataPrimeiraAssembleia.getUTCFullYear();
    m1 = dataPrimeiraAssembleia.getUTCMonth();
    d1 = dataPrimeiraAssembleia.getUTCDate();
  }

  // Parse data de referência
  let yRef: number, mRef: number, dRef: number;
  if (typeof dataReferencia === "string") {
    const parts = dataReferencia.split("T")[0].split("-").map(Number);
    yRef = parts[0];
    mRef = parts[1] - 1;
    dRef = parts[2];
  } else {
    yRef = dataReferencia.getUTCFullYear();
    mRef = dataReferencia.getUTCMonth();
    dRef = dataReferencia.getUTCDate();
  }

  const dPrimeira = new Date(Date.UTC(y1, m1, d1));
  const dRefDate = new Date(Date.UTC(yRef, mRef, dRef));

  let realizadas = 0;

  if (dRefDate < dPrimeira) {
    realizadas = 0;
  } else {
    const monthDiff = (yRef - y1) * 12 + (mRef - m1);
    if (dRef >= d1) {
      realizadas = monthDiff + 1;
    } else {
      realizadas = monthDiff;
    }
  }

  // Limites: nunca negativo e no máximo o prazo total
  realizadas = Math.max(0, Math.min(realizadas, total));
  const restantes = Math.max(0, total - realizadas);
  const encerrado = realizadas >= total;

  let proximaAssembleia: string | null = null;
  let proximaAssembleiaFormatada = "Encerrado";

  if (!encerrado) {
    // A próxima assembleia é a de índice `realizadas` (0-indexed offset em meses a partir de d1)
    const targetMonthTotal = m1 + realizadas;
    const targetYear = y1 + Math.floor(targetMonthTotal / 12);
    const normMonth = ((targetMonthTotal % 12) + 12) % 12;
    const maxDays = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
    const actualDay = Math.min(d1, maxDays);

    const proximaDate = new Date(Date.UTC(targetYear, normMonth, actualDay));
    proximaAssembleia = proximaDate.toISOString().split("T")[0];
    proximaAssembleiaFormatada = `${String(actualDay).padStart(2, "0")}/${String(normMonth + 1).padStart(2, "0")}/${targetYear}`;
  }

  return {
    realizadas,
    prazoTotal: total,
    restantes,
    proximaAssembleia,
    proximaAssembleiaFormatada,
    resumoPrazo: `${realizadas} / ${total} / ${restantes}`,
    legenda: `${realizadas} realizadas • ${total} total • ${restantes} restantes`,
    encerrado,
  };
}

export function resolveModalidadeConfig(
  grupoMod: GrupoModalidadeItem | undefined,
  adminMod: AdministradoraModalidadeItem,
): {
  ativo: boolean;
  modo_reduzido: string;
  percentual_padrao: number | null;
  percentual_minimo: number | null;
  percentual_maximo: number | null;
  origem: "ADMINISTRADORA_PADRAO" | "GRUPO_OVERRIDE";
  labelOrigem: string;
  isOverride: boolean;
} {
  const isAtivo = grupoMod?.ativo ?? false;
  const cfg = grupoMod?.configuracao ?? {};

  const adminModo = adminMod.modo_reduzido_padrao || "fixo";
  const adminPadrao = adminMod.percentual_padrao ?? (adminMod.codigo === "INTEGRAL" ? 100 : adminMod.codigo === "REDUZIDA_60_99" ? 60 : 50);
  const adminMin = adminMod.percentual_minimo ?? (adminMod.codigo === "INTEGRAL" ? 100 : adminMod.codigo === "REDUZIDA_60_99" ? 60 : 30);
  const adminMax = adminMod.percentual_maximo ?? (adminMod.codigo === "INTEGRAL" ? 100 : adminMod.codigo === "REDUZIDA_60_99" ? 99 : 59);

  const hasExplicitOverride =
    cfg.origem === "GRUPO_OVERRIDE" ||
    (cfg.percentual_padrao != null && cfg.percentual_padrao !== adminPadrao) ||
    (cfg.modo_reduzido != null && cfg.modo_reduzido !== adminModo);

  if (hasExplicitOverride && cfg.percentual_padrao != null) {
    return {
      ativo: isAtivo,
      modo_reduzido: cfg.modo_reduzido || adminModo,
      percentual_padrao: cfg.percentual_padrao,
      percentual_minimo: cfg.percentual_minimo ?? adminMin,
      percentual_maximo: cfg.percentual_maximo ?? adminMax,
      origem: "GRUPO_OVERRIDE",
      labelOrigem: "Personalizado neste Grupo",
      isOverride: true,
    };
  }

  return {
    ativo: isAtivo,
    modo_reduzido: adminModo,
    percentual_padrao: adminPadrao,
    percentual_minimo: adminMin,
    percentual_maximo: adminMax,
    origem: "ADMINISTRADORA_PADRAO",
    labelOrigem: "Padrão da Administradora",
    isOverride: false,
  };
}

export type CotaModalidadeEfetivaResult = {
  status: "HERDADO" | "PERSONALIZADO" | "DESABILITADO_COTA" | "DESABILITADO_GRUPO";
  habilitado: boolean;
  percentualEfetivo: number | null;
  modoReduzido: string;
  percentualMinimo: number | null;
  percentualMaximo: number | null;
  valorParcela: number | null;
  isOverride: boolean;
  labelBadge: string;
  corBadge: "grupo" | "cota" | "desabilitada" | "grupo_desabilitado";
};

export function resolveCotaModalidadeEfetiva(
  cotaValor: GrupoCotaModalidadeValor | undefined,
  grupoMod: GrupoModalidadeItem | undefined,
  adminMod: AdministradoraModalidadeItem,
): CotaModalidadeEfetivaResult {
  const grupoConfig = resolveModalidadeConfig(grupoMod, adminMod);
  const grupoHabilitado = grupoConfig.ativo;

  if (!grupoHabilitado) {
    return {
      status: "DESABILITADO_GRUPO",
      habilitado: false,
      percentualEfetivo: null,
      modoReduzido: grupoConfig.modo_reduzido,
      percentualMinimo: null,
      percentualMaximo: null,
      valorParcela: cotaValor?.valor_parcela ?? null,
      isOverride: false,
      labelBadge: "Desab. no Grupo",
      corBadge: "grupo_desabilitado",
    };
  }

  const cotaHabilitada = cotaValor?.habilitado ?? true;
  if (!cotaHabilitada || cotaValor?.modo_override === "DESABILITADO") {
    return {
      status: "DESABILITADO_COTA",
      habilitado: false,
      percentualEfetivo: null,
      modoReduzido: grupoConfig.modo_reduzido,
      percentualMinimo: null,
      percentualMaximo: null,
      valorParcela: cotaValor?.valor_parcela ?? null,
      isOverride: true,
      labelBadge: "Desabilitada",
      corBadge: "desabilitada",
    };
  }

  const isPersonalizado =
    cotaValor?.modo_override === "PERSONALIZADO" ||
    (cotaValor?.percentual_override != null && cotaValor.percentual_override !== grupoConfig.percentual_padrao);

  if (isPersonalizado && cotaValor?.percentual_override != null) {
    return {
      status: "PERSONALIZADO",
      habilitado: true,
      percentualEfetivo: Number(cotaValor.percentual_override),
      modoReduzido: cotaValor.modo_reduzido || grupoConfig.modo_reduzido,
      percentualMinimo: cotaValor.percentual_minimo ?? grupoConfig.percentual_minimo,
      percentualMaximo: cotaValor.percentual_maximo ?? grupoConfig.percentual_maximo,
      valorParcela: cotaValor.valor_parcela ?? null,
      isOverride: true,
      labelBadge: `Cota ${cotaValor.percentual_override}%`,
      corBadge: "cota",
    };
  }

  // Herda do Grupo
  return {
    status: "HERDADO",
    habilitado: true,
    percentualEfetivo: grupoConfig.percentual_padrao,
    modoReduzido: grupoConfig.modo_reduzido,
    percentualMinimo: grupoConfig.percentual_minimo,
    percentualMaximo: grupoConfig.percentual_maximo,
    valorParcela: cotaValor?.valor_parcela ?? null,
    isOverride: false,
    labelBadge: grupoConfig.percentual_padrao != null ? `Grupo ${grupoConfig.percentual_padrao}%` : "Grupo Padrão",
    corBadge: "grupo",
  };
}

export function computeGrupoMetrics(grupo: Partial<GrupoRecord>): {
  cotaMinima: number | null;
  cotaMaxima: number | null;
  taxaTotal: number;
  activeCotas: GrupoCotaItem[];
  activeModalidades: GrupoModalidadeItem[];
  temporal: AssembleiasTemporalResult;
  contemplacoes: ResumoContemplacoesPotencial;
} {
  const cotas = (grupo.produtos ?? []).filter((p) => p.ativo && p.valor_credito > 0);
  const credits = cotas.map((c) => Number(c.valor_credito));
  const cotaMinima = credits.length > 0 ? Math.min(...credits) : null;
  const cotaMaxima = credits.length > 0 ? Math.max(...credits) : null;

  const taxaAdm = Number(grupo.taxa_administrativa_percentual || 0);
  const fundoReserva = Number(grupo.fundo_reserva_percentual || 0);
  const seguro = Number(grupo.seguro_percentual || 0);
  const taxaTotal = Number((taxaAdm + fundoReserva + seguro).toFixed(4));

  const activeModalidades = (grupo.modalidades ?? []).filter((m) => m.ativo);
  const temporal = calcularAssembleiasTemporal(grupo.data_primeira_assembleia, grupo.prazo_total);
  const contemplacoes = calcularResumoContemplacoes(grupo.dados_estatisticos?.caracteristicas_contemplacao);

  return {
    cotaMinima,
    cotaMaxima,
    taxaTotal,
    activeCotas: cotas,
    activeModalidades,
    temporal,
    contemplacoes,
  };
}

export function validateGrupoProntidao(grupo: Partial<GrupoRecord>): GrupoProntidaoResult {
  const issues: string[] = [];
  const { cotaMinima, cotaMaxima, taxaTotal, activeCotas, activeModalidades, temporal, contemplacoes } = computeGrupoMetrics(grupo);

  if (!grupo.administradora_id && !grupo.administradora) {
    issues.push("Administradora não definida");
  }
  if (!grupo.tipo_administradora_id && !grupo.tipo?.nome) {
    issues.push("Tipo oficial não definido");
  }
  if (activeModalidades.length === 0) {
    issues.push("Nenhuma modalidade ativa no Grupo");
  }
  if (activeCotas.length === 0) {
    issues.push("Nenhum produto/cota ativo no Grupo");
  }
  if (!grupo.taxa_administrativa_percentual || grupo.taxa_administrativa_percentual <= 0) {
    issues.push("Taxa de administração obrigatória");
  }
  if (!grupo.prazo_total || grupo.prazo_total <= 0) {
    issues.push("Prazo total obrigatório");
  }
  if (!grupo.data_primeira_assembleia) {
    issues.push("Data da 1ª Assembleia obrigatória");
  }
  if (grupo.capacidade_total == null || grupo.capacidade_total <= 0) {
    issues.push("Capacidade total de cotas não informada");
  }

  return {
    ready: issues.length === 0,
    issues,
    cotaMinima,
    cotaMaxima,
    taxaTotal,
    totalCotasAtivas: activeCotas.length,
    totalModalidadesAtivas: activeModalidades.length,
    temporal,
    contemplacoes,
  };
}
