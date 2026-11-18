import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { linhasDeContatos, linhasDoHistorico } from "./coexistencia";

const dono = { id: "inst", empresa_id: "emp" };
describe("sincronização da coexistência", () => {
  it("separa recebidas e enviadas do histórico e guarda a data original", () => {
    const linhas = linhasDoHistorico(dono, [{ metadata: { phase: 0, chunk_order: 1, progress: 100 }, threads: [{ id: "5566999991234", messages: [
      { id: "wamid.1", from: "5566999991234", timestamp: "1775627825", type: "text", text: { body: "Oi" }, history_context: { status: "read" } },
      { id: "wamid.2", from: "5566996086030", timestamp: "1775627900", type: "text", text: { body: "Olá!" }, history_context: { status: "delivered", from_me: true } },
      { from: "5566999991234" },
    ] }] }]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ direcao: "recebida", status: "received", contato_numero: "5566999991234", empresa_id: "emp", instancia_id: "inst" });
    expect(linhas[1]).toMatchObject({ direcao: "enviada", status: "delivered", contato_numero: "5566999991234", conteudo: "Olá!" });
    expect(linhas[0].criada_em).toBe(new Date(1775627825000).toISOString());
  });
  it("grava contatos do celular, sem repetir, e desativa os removidos", () => {
    const linhas = linhasDeContatos(dono, [
      { type: "contact", action: "add", contact: { full_name: "Maria Souza", phone_number: "+55 66 99999-1234" } },
      { type: "contact", action: "remove", contact: { first_name: "João", phone_number: "5566988887777" } },
      { type: "contact", action: "add", contact: { full_name: "Maria S.", phone_number: "5566999991234" } },
      { type: "outro" },
    ]);
    expect(linhas.map((l) => [l.numero, l.nome, l.ativo])).toEqual([["5566999991234", "Maria S.", true], ["5566988887777", "João", false]]);
  });
});
