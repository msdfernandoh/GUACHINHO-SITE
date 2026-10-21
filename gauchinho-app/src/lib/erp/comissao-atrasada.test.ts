import { expect, it } from "vitest";
import { lerComissaoAtrasada } from "./comissao-atrasada";
const marca = { acompanhamento_inadimplencia: { situacao: "ATRASADA", motivo: "Atraso no portal" } };
it("mostra a evidência somente enquanto a comissão estiver sem recebimento", () => {
  expect(lerComissaoAtrasada(marca, 327.81)).toBe("Atraso no portal");
  expect(lerComissaoAtrasada(marca, 0)).toBeNull();
});
it("não presume inadimplência de uma previsão sem evidência", () => {
  expect(lerComissaoAtrasada({}, 300)).toBeNull();
  expect(lerComissaoAtrasada(null, 300)).toBeNull();
  expect(lerComissaoAtrasada({ acompanhamento_inadimplencia: "inválido" }, 300)).toBeNull();
});
