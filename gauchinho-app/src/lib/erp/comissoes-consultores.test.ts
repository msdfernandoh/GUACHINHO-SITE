import { describe, expect, it } from "vitest";
import { agruparConsultoresComissoes, type ConsultorComissoes } from "./comissoes-consultores";

function participante(id: string, nome: string, usuario_id: string | null = null, cpf: string | null = null): ConsultorComissoes {
  return { id, nome, nome_exibicao: nome, usuario_id, cpf };
}

describe("consultores no extrato de comissões", () => {
  it("reúne cadastros legados, preserva todos os IDs e prefere o próprio usuário", () => {
    const registros = [participante("a", " Éroni  Bolfe "), participante("b", "ERONI BOLFE", "usuario")];
    const antes = JSON.stringify(registros);
    expect(agruparConsultoresComissoes(registros, "usuario")).toMatchObject([{ id: "b", ids: ["a", "b"] }]);
    expect(JSON.stringify(registros)).toBe(antes);
  });

  it("não funde homônimos com documentos diferentes nem nomes parciais", () => {
    const grupos = agruparConsultoresComissoes([
      participante("a", "Fernando Hugo", null, "111"),
      participante("b", "FERNANDO HUGO", null, "222"),
      participante("c", "Fernando"),
      participante("d", "Fernando Hugo Teste"),
    ]);
    expect(grupos).toHaveLength(4);
    expect(grupos.every((g) => g.ids.length === 1)).toBe(true);
  });

  it("não colapsa registros sem nome e suporta equipe vazia", () => {
    expect(agruparConsultoresComissoes([])).toEqual([]);
    expect(agruparConsultoresComissoes([participante("a", ""), participante("b", "")])).toHaveLength(2);
  });
});
