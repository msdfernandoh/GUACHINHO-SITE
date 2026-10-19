import { describe, it, expect } from "vitest";
import {
  calcularRegraLanceLivre,
  extrairProtocoloAlert,
  calcularEstrategiaGrupo,
} from "../../../../scripts/robo-lances-service.mjs";

describe("Robô de Oferta de Lances - Regras de Lance e Extração de Protocolos", () => {
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
