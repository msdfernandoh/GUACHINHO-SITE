import { describe, it, expect } from "vitest";
import { extrairDadosBoletoTexto, normalizarNumeroPortal } from "../../../../scripts/robo-boletos-service.mjs";

describe("Robô de Boletos - Extração de Dados e Chave Pix", () => {
  it("deve extrair chave Pix Copia e Cola no padrão EMV QRCode", () => {
    const rawText = `
      BANCO SANTANDER (BRASIL) S.A. | 033-7 | 03399.70293 84600.000000 00000.000000 1 90000000000000
      Beneficiário: Randon Administradora de Consórcios Ltda
      Pagador: JOAO DA SILVA
      Vencimento: 15/11/2026
      Valor do Documento: R$ 1.850,00
      Pague com Pix através do QR Code abaixo ou utilize o Pix Copia e Cola:
      00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913RANDON CONSORCIOS6008CAXIAS DO SUL62070503***63041D3D
      Obrigado pela preferência!
    `;

    const dados = extrairDadosBoletoTexto(rawText);

    expect(dados.qrCodePix).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913RANDON CONSORCIOS6008CAXIAS DO SUL62070503***63041D3D"
    );
    expect(dados.vencimento).toBe("2026-11-15");
    expect(dados.valor).toBe(1850);
    expect(dados.linhaDigitavel).toBe(
      "03399.70293 84600.000000 00000.000000 1 90000000000000"
    );
  });

  it("deve lidar graciosamente com textos vazios ou sem Pix", () => {
    const dados = extrairDadosBoletoTexto("");
    expect(dados.qrCodePix).toBeNull();
    expect(dados.linhaDigitavel).toBeNull();
    expect(dados.vencimento).toBeNull();
    expect(dados.valor).toBeNull();
  });

  it("deve extrair linha digitável contínua de 47 dígitos quando não houver formatação com pontos", () => {
    const rawText = `
      Linha Digitável: 03399702938460000000000000000000190000000000000
      Vencimento: 10/12/2026
      Valor: 1.250,50
    `;

    const dados = extrairDadosBoletoTexto(rawText);
    expect(dados.linhaDigitavel).toBe("03399702938460000000000000000000190000000000000");
    expect(dados.vencimento).toBe("2026-12-10");
    expect(dados.valor).toBe(1250.5);
  });
});

it("envia somente o código numérico do grupo ao portal sem truncar o sufixo no campo", () => {
  expect(normalizarNumeroPortal("5288 VEÍCULO", 6)).toBe("005288");
  expect(normalizarNumeroPortal("005288", 6)).toBe("005288");
  expect(normalizarNumeroPortal("67", 4)).toBe("0067");
  expect(normalizarNumeroPortal("sem código", 6)).toBe("");
});
