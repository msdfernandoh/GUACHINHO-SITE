export type ProgramRuleStage = {
  id?: string;
  ordem?: number;
  tipo_gatilho?: string;
  mes_relativo?: number | null;
  nome?: string;
  percentual_venda: number;
};

export type ProgramRule = {
  id: string;
  versao?: number;
  base_calculo?: "credito" | "valor_fixo";
  percentual_total_comissao?: number | null;
  valor_fixo_total?: number | null;
  vigencia_inicio?: string;
  vigencia_fim?: string | null;
  configuracao_homologada?: boolean;
  origem_configuracao?: string | null;
  tipo_administradora_id?: string | null;
  modalidade_comissao_id?: string | null;
  curva_estorno_id?: string | null;
  tipo?: { nome?: string } | null;
  modalidade?: { nome?: string } | null;
  curva?: { nome?: string; versao?: number } | null;
  etapas?: ProgramRuleStage[];
};

export type ProgramValidationResult = {
  issues: string[];
  scheduled: number;
  expected: number | null;
  cronogramaSummary: string;
  ready: boolean;
};

export function validateProgramRule(rule: ProgramRule): ProgramValidationResult {
  const expected =
    rule.base_calculo === "valor_fixo"
      ? (rule.valor_fixo_total ?? null)
      : (rule.percentual_total_comissao ?? null);

  const stages = rule.etapas ?? [];
  const scheduled = stages.reduce(
    (total, stage) => total + Number(stage.percentual_venda || 0),
    0,
  );

  const monthlyStages = stages.filter(
    (s) => s.tipo_gatilho !== "CONTEMPLACAO" && s.mes_relativo != null,
  );
  const contempStages = stages.filter(
    (s) =>
      s.tipo_gatilho === "CONTEMPLACAO" ||
      /contempla/i.test(s.nome ?? ""),
  );
  const monthlySum = monthlyStages.reduce(
    (t, s) => t + Number(s.percentual_venda || 0),
    0,
  );
  const contempSum = contempStages.reduce(
    (t, s) => t + Number(s.percentual_venda || 0),
    0,
  );

  let cronogramaSummary = "";
  if (stages.length === 0) {
    cronogramaSummary = "Sem etapas cadastradas";
  } else if (contempSum > 0 && monthlySum > 0) {
    cronogramaSummary = `${monthlySum.toFixed(2).replace(/\.?0+$/, "")}% parcelas + ${contempSum.toFixed(2).replace(/\.?0+$/, "")}% contemplação = ${scheduled.toFixed(2).replace(/\.?0+$/, "")}%`;
  } else if (contempSum > 0 && monthlySum === 0) {
    cronogramaSummary = `${contempSum.toFixed(2).replace(/\.?0+$/, "")}% contemplação`;
  } else {
    cronogramaSummary = `${scheduled.toFixed(2).replace(/\.?0+$/, "")}%`;
  }

  const issues: string[] = [];
  if (!rule.tipo_administradora_id && !rule.tipo?.nome) {
    issues.push("Tipo não definido");
  }
  if (!rule.modalidade_comissao_id && !rule.modalidade?.nome) {
    issues.push("Modalidade não definida");
  }
  if (expected == null || expected <= 0) {
    issues.push("Comissão total não informada");
  }
  if (stages.length === 0) {
    issues.push("Cronograma sem etapas cadastradas");
  } else if (expected != null && Math.abs(scheduled - expected) > 0.0001) {
    issues.push(
      `Cronograma soma ${scheduled.toFixed(2).replace(/\.?0+$/, "")}%, mas a comissão total é ${expected.toFixed(2).replace(/\.?0+$/, "")}%`,
    );
  }
  if (!rule.vigencia_inicio) {
    issues.push("Início de vigência não informado");
  }

  return {
    issues,
    scheduled,
    expected,
    cronogramaSummary,
    ready: issues.length === 0,
  };
}

export function validateProgram(program: {
  status: string;
  regras?: ProgramRule[];
}) {
  const rules = program.regras ?? [];
  const ruleResults = rules.map(validateProgramRule);
  const issues: string[] = [];

  if (rules.length === 0) {
    issues.push("Programa sem regras cadastradas");
  } else {
    rules.forEach((rule, idx) => {
      const res = ruleResults[idx];
      const modLabel =
        rule.modalidade?.nome || rule.tipo?.nome || `Regra ${idx + 1}`;
      res.issues.forEach((issue) => {
        issues.push(`${modLabel}: ${issue}`);
      });
    });
  }

  const mayHomologate =
    program.status === "RASCUNHO" && rules.length > 0 && issues.length === 0;

  return {
    rules: ruleResults,
    issues,
    mayHomologate,
    ready: issues.length === 0,
  };
}
