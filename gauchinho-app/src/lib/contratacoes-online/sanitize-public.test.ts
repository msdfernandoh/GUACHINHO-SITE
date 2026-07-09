import { describe, expect, it } from "vitest";
import { sanitizeContratacaoPublica } from "./sanitize-public";
import type { ContratacaoOnlineRow } from "./types";

describe("sanitizeContratacaoPublica", () => {
  it("remove path do comprovante pix da resposta pública", () => {
    const row = {
      id: "1",
      public_token: "tok",
      protocolo: "GCH-CTR-000001",
      pix_comprovante_url: "uuid/comprovante_pix_x.pdf",
    } as ContratacaoOnlineRow;
    const out = sanitizeContratacaoPublica(row);
    expect(out).not.toHaveProperty("pix_comprovante_url");
    expect(out.pix_comprovante_enviado).toBe(true);
  });
});
