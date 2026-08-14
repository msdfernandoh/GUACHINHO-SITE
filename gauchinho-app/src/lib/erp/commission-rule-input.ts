export type CommissionStage = {
  ordem: number;
  tipo_gatilho: "MES_RELATIVO" | "CONTEMPLACAO";
  mes_relativo: number | null;
  nome: string;
  percentual_etapa?: number;
  valor_etapa?: number;
  percentual_venda?: number;
};

export type FranchiseRuleInput = {
  programaId: string;
  baseCalculo: "credito" | "valor_fixo";
  valor: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  modalidade: string | null;
  opcaoCotaId: string | null;
  planoCondicao: string | null;
  tipoAdministradoraId: string | null;
  modalidadeComissaoId: string | null;
  etapas: CommissionStage[];
};

export type CommissionRuleScope = {
  vigenciaInicio: string;
  vigenciaFim: string | null;
  modalidade: string | null;
  opcaoCotaId: string | null;
  planoCondicao: string | null;
  tipoAdministradoraId?: string | null;
  modalidadeComissaoId?: string | null;
};

export function commissionRuleScopesConflict(
  left: CommissionRuleScope,
  right: CommissionRuleScope,
): boolean {
  const same = (a: string | null, b: string | null) =>
    (a ?? null) === (b ?? null);
  const periodsOverlap =
    (left.vigenciaFim == null || left.vigenciaFim >= right.vigenciaInicio) &&
    (right.vigenciaFim == null || right.vigenciaFim >= left.vigenciaInicio);
  return (
    periodsOverlap &&
    same(left.modalidade, right.modalidade) &&
    same(left.opcaoCotaId, right.opcaoCotaId) &&
    same(left.planoCondicao, right.planoCondicao) &&
    same(
      left.tipoAdministradoraId ?? null,
      right.tipoAdministradoraId ?? null,
    ) &&
    same(left.modalidadeComissaoId ?? null, right.modalidadeComissaoId ?? null)
  );
}

function decimal(value: string): number {
  const raw = value.trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return Number(normalized);
}

export function parseFranchiseRuleForm(formData: FormData): FranchiseRuleInput {
  const programaId = String(formData.get("programa_id") ?? "").trim();
  const baseCalculo = String(formData.get("base_calculo") ?? "");
  const valor = decimal(String(formData.get("valor_comissao") ?? ""));
  const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim();
  const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
  const modalidade =
    String(formData.get("modalidade") ?? "")
      .trim()
      .toLowerCase() || null;
  const opcaoCotaId =
    String(formData.get("opcao_cota_id") ?? "").trim() || null;
  const planoCondicao =
    String(formData.get("plano_condicao") ?? "")
      .trim()
      .toLowerCase() || null;
  const tipoAdministradoraId =
    String(formData.get("tipo_administradora_id") ?? "").trim() || null;
  const modalidadeComissaoId =
    String(formData.get("modalidade_comissao_id") ?? "").trim() || null;

  if (!programaId) throw new Error("Selecione um programa de comissão.");
  if (!modalidadeComissaoId)
    throw new Error("A modalidade da Administradora é obrigatória.");
  if (baseCalculo !== "credito" && baseCalculo !== "valor_fixo") {
    throw new Error("Base de cálculo inválida.");
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      baseCalculo === "credito"
        ? "Informe um percentual maior que zero."
        : "Informe um valor fixo maior que zero.",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenciaInicio))
    throw new Error("Informe o início da vigência.");
  if (
    vigenciaFim &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(vigenciaFim) || vigenciaFim < vigenciaInicio)
  ) {
    throw new Error("O fim da vigência não pode ser anterior ao início.");
  }

  let rawStages: unknown;
  try {
    rawStages = JSON.parse(String(formData.get("etapas_cronograma") ?? ""));
  } catch {
    throw new Error("Cronograma inválido.");
  }
  if (!Array.isArray(rawStages) || rawStages.length === 0)
    throw new Error("Adicione ao menos uma etapa.");

  const etapas = rawStages.map((raw, index) => {
    if (!raw || typeof raw !== "object")
      throw new Error(`Etapa ${index + 1} inválida.`);
    const item = raw as Record<string, unknown>;
    const nome = String(item.nome ?? "").trim();
    const tipoGatilho = String(item.tipo_gatilho ?? "MES_RELATIVO") as
      "MES_RELATIVO" | "CONTEMPLACAO";
    const mes =
      tipoGatilho === "CONTEMPLACAO" ? null : Number(item.mes_relativo);
    const etapaValor = decimal(
      String(
        baseCalculo === "credito"
          ? (item.percentual_venda ?? item.percentual_etapa ?? "")
          : (item.valor_etapa ?? ""),
      ),
    );
    if (!nome) throw new Error(`Informe o nome da etapa ${index + 1}.`);
    if (!(["MES_RELATIVO", "CONTEMPLACAO"] as const).includes(tipoGatilho))
      throw new Error(`Gatilho da etapa ${index + 1} inválido.`);
    if (
      tipoGatilho === "MES_RELATIVO" &&
      (!Number.isInteger(mes) || Number(mes) <= 0)
    )
      throw new Error(`Mês da etapa ${index + 1} inválido.`);
    if (!Number.isFinite(etapaValor) || etapaValor <= 0)
      throw new Error(`Valor da etapa ${index + 1} inválido.`);
    return baseCalculo === "credito"
      ? {
          ordem: index + 1,
          tipo_gatilho: tipoGatilho,
          mes_relativo: mes,
          nome,
          percentual_venda: etapaValor,
        }
      : {
          ordem: index + 1,
          tipo_gatilho: tipoGatilho,
          mes_relativo: mes,
          nome,
          valor_etapa: etapaValor,
        };
  });

  const totalEtapas = etapas.reduce(
    (sum, etapa) =>
      sum +
      (baseCalculo === "credito"
        ? (etapa.percentual_venda ?? 0)
        : (etapa.valor_etapa ?? 0)),
    0,
  );
  const esperado = valor;
  if (Math.abs(totalEtapas - esperado) > 0.0001) {
    throw new Error(
      baseCalculo === "credito"
        ? "A soma das etapas deve fechar exatamente o percentual total sobre a venda."
        : "A soma das etapas deve ser igual ao valor fixo total.",
    );
  }

  if (!etapas.some((etapa) => etapa.tipo_gatilho === "MES_RELATIVO"))
    throw new Error("A regra precisa possuir ao menos uma etapa mensal.");
  if (
    etapas.filter((etapa) => etapa.tipo_gatilho === "CONTEMPLACAO").length > 1
  )
    throw new Error("A regra aceita no máximo uma etapa de contemplação.");
  return {
    programaId,
    baseCalculo,
    valor,
    vigenciaInicio,
    vigenciaFim,
    modalidade,
    opcaoCotaId,
    planoCondicao,
    tipoAdministradoraId,
    modalidadeComissaoId,
    etapas,
  };
}
