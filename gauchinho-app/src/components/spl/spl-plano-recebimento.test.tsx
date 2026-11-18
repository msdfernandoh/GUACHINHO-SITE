import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanoRecebimentoSpl } from "./spl-plano-recebimento";

describe("Plano de recebimento no SPL", () => {
  it("mostra o cronograma e permite comparar modelos quando a parceria está indefinida", () => {
    const html = renderToStaticMarkup(<PlanoRecebimentoSpl modelo={null} />);
    expect(html).toContain("Modelo para simulação");
    expect(html).toContain("Gerador de negócios");
    expect(html).toContain("Microfranquia");
    expect(html).toContain("4ª parcela mensal");
  });

  it("abre no modelo cadastrado com seu cronograma", () => {
    const html = renderToStaticMarkup(<PlanoRecebimentoSpl modelo="GERADOR_NEGOCIOS" />);
    expect(html).toContain("8ª parcela mensal");
    expect(html).not.toContain("Modelo para simulação");
  });

  it("mantém a regra da liberação de carteira", () => {
    const html = renderToStaticMarkup(<PlanoRecebimentoSpl modelo="SOMENTE_LIBERAR_CARTEIRA" />);
    expect(html).toContain("A liberação de carteira não tem plano de remuneração.");
    expect(html).not.toContain("Simulação de comissão");
  });
});
