import { describe, expect, it } from "vitest";
import type { EventoPremioRow } from "./premios";

describe("premios data structures", () => {
  it("valida status permitidos de prêmios", () => {
    const premio: EventoPremioRow = {
      id: "p1",
      evento_id: "e1",
      ordem: 1,
      titulo: "Caixa de Som JBL",
      descricao: "Caixa portátil bluetooth",
      imagem_url: null,
      status: "pendente",
      ganhador_participante_id: null,
      sorteado_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(premio.status).toBe("pendente");
    expect(premio.titulo).toBe("Caixa de Som JBL");
    expect(premio.ordem).toBe(1);
  });
});
