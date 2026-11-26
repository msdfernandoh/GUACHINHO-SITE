import { expect, it } from "vitest";
import { lerCotasTexto } from "@/lib/contempladas/parser";

it("lista com rótulos separados por | (formato do Gemini)", () => {
  const t = `CONTEMPLADAS VEÍCULOS RACON E RANDON

* Administradora: racon | Tipo: veiculo | Crédito: R$ 74.500,00 | Entrada: R$ 29.900,00 | Prazo: 75 | Parcela: R$ 1.152,00 | Saldo Devedor: R$ 86.400,00 | Vencimento: 10.01 | Comissão: R$ 2.000,00
* Administradora: Randon | Tipo: veiculo | Crédito: R$ 504.000,00 | Entrada: R$ 220.000,00 | Prazo: 115 | Parcela: R$ 4.789,00 | Saldo Devedor: R$ 550.735,00 | Vencimento: 20.12 | Comissão: R$ 10.000,00`;
  const r = lerCotasTexto(t, { tipo: "FIXO", valor: 0 });
  expect(r).toHaveLength(2);
  const [a, b] = r.map((x) => x.cota!);
  expect(a).toMatchObject({ administradora: "racon", tipo: "automovel", credito: 74500, entrada_original: 29900, prazo: 75, parcela: 1152, saldo_devedor: 86400, vencimento_mes: 1, comissao_parceiro: 2000 });
  expect(b).toMatchObject({ administradora: "randon", credito: 504000, prazo: 115, vencimento_mes: 12, comissao_parceiro: 10000 });
});
