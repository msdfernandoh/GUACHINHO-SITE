import { describe, expect, it } from "vitest";
import {
  obterStatusReajusteAnual,
  calcularNovoCreditoPorPercentual,
  calcularPercentualPorVariacao,
  calcularPropagacaoCotaBase,
} from "./reajuste-anual";

describe("Reajuste Anual Operacional — obterStatusReajusteAnual", () => {
  const refSetembro2026 = new Date("2026-09-10T12:00:00Z");

  it("retorna falso para grupo sem primeira assembleia", () => {
    const status = obterStatusReajusteAnual({}, refSetembro2026);
    expect(status.temPrimeiraAssembleia).toBe(false);
    expect(status.precisaReajuste).toBe(false);
    expect(status.tagTexto).toBe("Sem 1ª assembleia");
  });

  it("não marca como pendente grupo criado no ano atual com menos de 1 ano", () => {
    // Grupo iniciou em março de 2026 (mesmo ano)
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2026-03-15" },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(false);
    expect(status.precisaReajuste).toBe(false);
    expect(status.tagTexto).toBe("Novo (< 1 ano)");
  });

  it("não marca como pendente grupo de 2025 cujo aniversário de 1 ano é no futuro neste ano", () => {
    // Grupo iniciou em novembro de 2025. Em setembro de 2026 deu 10 meses (< 1 ano)
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2025-11-20" },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(false);
    expect(status.precisaReajuste).toBe(false);
    expect(status.tagTexto).toBe("Novo (< 1 ano)");
  });

  it("ativa a tag de atenção quando já deu 1 ano e o mês de aniversário passou no ano atual", () => {
    // Grupo iniciou em maio de 2025. Em maio de 2026 fez 1 ano (mês de aniversário: Maio)
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2025-05-15", ano_ultimo_reajuste: null },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(true);
    expect(status.mesAniversario).toBe(5);
    expect(status.nomeMesAniversario).toBe("Maio");
    expect(status.aniversarioAtingidoNoAno).toBe(true);
    expect(status.jaReajustadoAnoAtual).toBe(false);
    expect(status.precisaReajuste).toBe(true);
    expect(status.tagTexto).toBe("⚠ Reajuste: Mês de Maio");
    expect(status.tagTipo).toBe("atencao");
  });

  it("remove a tag de atenção se o grupo já foi reajustado no ano atual", () => {
    // Grupo iniciou em maio de 2025, mas foi marcado como reajustado em 2026
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2025-05-15", ano_ultimo_reajuste: 2026 },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(true);
    expect(status.jaReajustadoAnoAtual).toBe(true);
    expect(status.precisaReajuste).toBe(false);
    expect(status.tagTexto).toBe("✓ Reajustado (2026)");
    expect(status.tagTipo).toBe("sucesso");
  });

  it("ativa reajuste em grupo antigo (ex: 2023) cujo aniversário em 2026 foi em abril e ainda não foi reajustado em 2026", () => {
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2023-04-10", ano_ultimo_reajuste: 2025 },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(true);
    expect(status.nomeMesAniversario).toBe("Abril");
    expect(status.aniversarioAtingidoNoAno).toBe(true);
    expect(status.jaReajustadoAnoAtual).toBe(false);
    expect(status.precisaReajuste).toBe(true);
    expect(status.tagTexto).toBe("⚠ Reajuste: Mês de Abril");
  });

  it("não ativa pendência em grupo antigo (ex: 2023) cujo aniversário é em novembro e hoje é setembro de 2026", () => {
    const status = obterStatusReajusteAnual(
      { data_primeira_assembleia: "2023-11-10", ano_ultimo_reajuste: 2025 },
      refSetembro2026,
    );
    expect(status.deuUmAno).toBe(true);
    expect(status.nomeMesAniversario).toBe("Novembro");
    expect(status.aniversarioAtingidoNoAno).toBe(false);
    expect(status.precisaReajuste).toBe(false);
    expect(status.tagTexto).toBe("Aniversário: Novembro");
    expect(status.tagTipo).toBe("neutro");
  });
});

describe("Reajuste Anual Operacional — Propagação de Cotas", () => {
  it("calcula novo crédito a partir de percentual", () => {
    expect(calcularNovoCreditoPorPercentual(100000, 5)).toBe(105000);
    expect(calcularNovoCreditoPorPercentual(123456.78, 6.25)).toBe(131172.83);
  });

  it("calcula percentual de variação a partir de valor novo", () => {
    const pct = calcularPercentualPorVariacao(100000, 105000);
    expect(pct).toBe(5);
  });

  it("propaga percentual calculado de uma cota para todas as outras cotas", () => {
    const cotas = [
      { id: "cota-1", valor_credito: 100000 },
      { id: "cota-2", valor_credito: 200000 },
      { id: "cota-3", valor_credito: 300000 },
    ];

    // Usuário alterou a cota de 100.000 para 106.000 (+6%)
    const res = calcularPropagacaoCotaBase(cotas, "cota-1", 106000);

    expect(res.percentualCalculado).toBe(6);
    expect(res.cotasAtualizadas.find((c) => c.id === "cota-1")?.novo_credito).toBe(106000);
    expect(res.cotasAtualizadas.find((c) => c.id === "cota-2")?.novo_credito).toBe(212000);
    expect(res.cotasAtualizadas.find((c) => c.id === "cota-3")?.novo_credito).toBe(318000);
  });
});
