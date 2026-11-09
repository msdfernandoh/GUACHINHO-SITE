import { describe, it, expect } from "vitest";
import {
  calcularRegraLanceLivre,
  extrairProtocoloAlert,
  calcularEstrategiaGrupo,
  alinharFixosComPortal,
  calcularEmbutidoValido,
  devePularLanceVencido,
} from "../../../../scripts/robo-lances-service.mjs";

describe("Robô de Oferta de Lances - Regras de Lance e Extração de Protocolos", () => {
  it("seleciona o segundo fixo para uma estratégia de 25% quando o primeiro é 40%", () => {
    const estrategia = { lance_fixo_ativo: true, lance_fixo_percentual: 25, lance_fixo_embutido_percentual: 25 };
    const alinhada = alinharFixosComPortal(estrategia, { lanceFixoPct: 40, segundoLanceFixoPct: 25 });
    expect(alinhada.lance_fixo_ativo).toBe(false);
    expect(alinhada.segundo_lance_fixo_ativo).toBe(true);
    expect(alinhada.segundo_lance_fixo_percentual).toBe(25);
    expect(alinhada.segundo_lance_fixo_embutido_percentual).toBe(25);
    expect(estrategia.lance_fixo_ativo).toBe(true);
  });

  it("bloqueia percentual fixo ausente no portal antes de ofertar", () => {
    expect(() => alinharFixosComPortal({ lance_fixo_ativo: true, lance_fixo_percentual: 50 }, { lanceFixoPct: 25, segundoLanceFixoPct: null })).toThrow(/indisponível/);
  });

  it("inclui lance vencido somente na execução que solicitou todas as cotas", () => {
    const estrategia = { data_vencimento: "2026-11-01" };
    const agora = new Date("2026-11-09T12:00:00");
    expect(devePularLanceVencido(estrategia, false, agora)).toBe(true);
    expect(devePularLanceVencido(estrategia, true, agora)).toBe(false);
  });

  it("preserva o embutido autorizado sem usar o crédito legado como base", () => {
    expect(calcularEmbutidoValido(44.59, 25)).toBe(25);
    expect(calcularEmbutidoValido(50, 40)).toBe(40);
    expect(calcularEmbutidoValido(25, 40)).toBe(25);
  });
  describe("Regra do Lance Livre: embutido + 1,1234", () => {
    it("deve calcular exatamente 26,1234% para grupo com embutido padrão de 25%", () => {
      const calc = calcularRegraLanceLivre(25);
      expect(calc.livrePct).toBe(26.1234);
      expect(calc.strLivrePct).toBe("26,1234");
      expect(calc.strEmbutidoPct).toBe("25,0000");
    });

    it("deve calcular corretamente para grupos com outros percentuais de embutido (ex: 20%, 30%)", () => {
      const calc20 = calcularRegraLanceLivre(20);
      expect(calc20.livrePct).toBe(21.1234);
      expect(calc20.strLivrePct).toBe("21,1234");

      const calc30 = calcularRegraLanceLivre(30);
      expect(calc30.livrePct).toBe(31.1234);
      expect(calc30.strLivrePct).toBe("31,1234");
    });

    it("deve permitir margem customizada se parametrizada", () => {
      const calcCustom = calcularRegraLanceLivre(25, 2.0);
      expect(calcCustom.livrePct).toBe(27.0);
      expect(calcCustom.strLivrePct).toBe("27,0000");
    });

    it("deve preservar 40% de embutido no lance livre quando o grupo permite 40%", () => {
      const calc40 = calcularRegraLanceLivre(40);
      expect(calc40.livrePct).toBe(41.1234);
      expect(calc40.strEmbutidoPct).toBe("40,0000");
    });
  });

  describe("Extração de Protocolo do Alert do Newcon", () => {
    it("deve extrair o protocolo numérico do alert nativo do Newcon Web", () => {
      const msg = "Anote os números dos protocolos: Lance Livre: 5735314";
      const protocolo = extrairProtocoloAlert(msg);
      expect(protocolo).toBe("5735314");
    });

    it("deve extrair o protocolo de lance fixo", () => {
      const msg = "Anote os números dos protocolos: Lance Fixo: 5735315";
      const protocolo = extrairProtocoloAlert(msg);
      expect(protocolo).toBe("5735315");
    });

    it("deve lidar graciosamente com mensagens vazias, nulas ou sem protocolo", () => {
      expect(extrairProtocoloAlert("")).toBeNull();
      expect(extrairProtocoloAlert(null as any)).toBeNull();
      expect(extrairProtocoloAlert("Operação realizada com sucesso")).toBeNull();
    });
  });

  describe("Estratégia Completa do Grupo (Livre, Fixo, 2º Fixo)", () => {
    it("deve gerar estratégia para grupo apenas com lance fixo de 25%", () => {
      const est = calcularEstrategiaGrupo({
        embutidoMaximoPct: 25,
        fixoPct: 25,
        segundoFixoPct: null,
      });

      expect(est.livre.percentual).toBe(26.1234);
      expect(est.livre.percentualEmbutido).toBe(25);
      expect(est.fixo?.percentual).toBe(25);
      expect(est.fixo?.percentualEmbutido).toBe(25);
      expect(est.segundoFixo).toBeNull();
    });

    it("deve gerar estratégia para grupo com lance fixo de 25% e 2º lance fixo de 40%, limitando embutido a 25%", () => {
      const est = calcularEstrategiaGrupo({
        embutidoMaximoPct: 25,
        fixoPct: 25,
        segundoFixoPct: 40,
      });

      expect(est.livre.percentual).toBe(26.1234);
      expect(est.fixo?.percentual).toBe(25);
      expect(est.fixo?.percentualEmbutido).toBe(25);

      // No 2º lance fixo (40%), o embutido não pode ultrapassar o teto do grupo (25%)
      expect(est.segundoFixo?.percentual).toBe(40);
      expect(est.segundoFixo?.percentualEmbutido).toBe(25);
      expect(est.segundoFixo?.strEmbutido).toBe("25,0000");
    });
  });
});
