import { expect, it } from "vitest";
import { lerCotasTexto } from "@/lib/contempladas/parser";
it("planilha exportada em CSV (vírgulas e aspas)", () => {
  const t = 'ADM,TIPO,CRÉDITO,ENTRADA,PRAZO,PARCELA,SALDO DEVEDOR,VENCIMENTO PARCELA,COMISSÃO PARCEIRO\nRacon,Imóvel,"R$ 274.500,00","R$ 20.000,00",23,"R$ 15.124,00","R$ 347.852,00",Dezembro,"R$ 5.000,00"';
  const r = lerCotasTexto(t, { tipo: "FIXO", valor: 0 });
  expect(r[0].cota?.credito).toBe(274500); expect(r[0].cota?.entrada_original).toBe(20000); expect(r[0].cota?.prazo).toBe(23); expect(r[0].cota?.comissao_parceiro).toBe(5000);
  const r2 = lerCotasTexto('Racon,Imóvel,"R$ 274.500,00","R$ 20.000,00",23,"R$ 15.124,00","R$ 347.852,00",Dezembro,"R$ 5.000,00"', { tipo: "FIXO", valor: 0 });
  expect(r2[0].cota?.entrada_original).toBe(20000);
});
