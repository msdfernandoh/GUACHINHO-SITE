export type GrupoModalidadeConfig = {
  modo_reduzido?: "fixo" | "personalizado" | "padrao";
  percentual_padrao?: number | null;
  percentual_minimo?: number | null;
  percentual_maximo?: number | null;
  origem?: string;
  revisao_platform_pendente?: boolean;
};

export type GrupoModalidadeItem = {
  id?: string;
  administradora_modalidade_id: string;
  ativo: boolean;
  ordem?: number;
  configuracao?: GrupoModalidadeConfig;
  modalidade?: {
    id?: string;
    nome: string;
    codigo: string;
  } | null;
};

export type GrupoCotaModalidadeValor = {
  id?: string;
  administradora_modalidade_id: string;
  valor_parcela: number;
  percentual_reducao?: number | null;
  habilitado?: boolean;
  modo_reduzido?: string;
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

export type GrupoEstatisticas = {
  contemplacoes_sorteio_qtd?: number | null;
  lance_embutido_25_permitido?: boolean;
  lance_embutido_50_permitido?: boolean;
  lance_fidelidade_permitido?: boolean;
  lance_fidelidade_percentual?: number | null;
  lance_livre_minimo?: number | null;
  lance_livre_medio?: number | null;
  lance_livre_maximo?: number | null;
  contemplados_mes_anterior_qtd?: number | null;
  origem_informacao?: string | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
};

export type GrupoRecord = {
  id: string;
  codigo_grupo: string;
  administradora_id?: string | null;
  administradora?: string | { nome?: string } | null;
  tipo_administradora_id?: string | null;
  tipo?: { id?: string; nome?: string } | null;
  modalidade?: string | null;
  status?: string;
  ativo: boolean;
  prazo_total?: number | null;
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
  modalidades?: GrupoModalidadeItem[];
  produtos?: GrupoCotaItem[];
};

export type GrupoProntidaoResult = {
  ready: boolean;
  issues: string[];
  cotaMinima: number | null;
  cotaMaxima: number | null;
  taxaTotal: number;
  totalCotasAtivas: number;
  totalModalidadesAtivas: number;
};

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

export function computeGrupoMetrics(grupo: Partial<GrupoRecord>): {
  cotaMinima: number | null;
  cotaMaxima: number | null;
  taxaTotal: number;
  activeCotas: GrupoCotaItem[];
  activeModalidades: GrupoModalidadeItem[];
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

  return {
    cotaMinima,
    cotaMaxima,
    taxaTotal,
    activeCotas: cotas,
    activeModalidades,
  };
}

export function validateGrupoProntidao(grupo: Partial<GrupoRecord>): GrupoProntidaoResult {
  const issues: string[] = [];
  const { cotaMinima, cotaMaxima, taxaTotal, activeCotas, activeModalidades } = computeGrupoMetrics(grupo);

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
  };
}
