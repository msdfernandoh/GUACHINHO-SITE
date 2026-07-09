import { describe, expect, it } from "vitest";
import { formatTamanhoArquivo, labelTipoDocumento } from "./documentos-labels";

describe("documentos labels", () => {
  it("formata tamanho", () => {
    expect(formatTamanhoArquivo(500)).toBe("500 B");
    expect(formatTamanhoArquivo(2048)).toBe("2.0 KB");
  });

  it("rotula tipo de documento", () => {
    expect(labelTipoDocumento("comprovante_pix")).toBe("Comprovante Pix");
  });
});
