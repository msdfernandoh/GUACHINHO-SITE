import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { capturarPdfBoleto } from "../../../../scripts/robo-boletos-captura.mjs";

function contexto() {
  const page = Object.assign(new EventEmitter(), {
    isClosed: () => false,
    locator: () => ({ innerText: async () => "Tela de pendências" }),
  });
  const context = Object.assign(new EventEmitter(), { pages: () => [page] });
  return { context, page };
}

describe("captura de boletos em popup temporário", () => {
  it("captura resposta PDF mesmo quando popup fecha antes da leitura do DOM", async () => {
    const { context, page } = contexto();
    const result = await capturarPdfBoleto({ page, context, timeoutMs: 20, emitir: async () => {
      context.emit("response", { headers: () => ({ "content-type": "application/pdf" }), body: async () => Buffer.from("%PDF-1.7 boleto") });
    } });
    expect(result.pdfBuffer.toString()).toBe("%PDF-1.7 boleto");
    expect(context.listenerCount("response")).toBe(0);
    expect(page.listenerCount("download")).toBe(0);
  });
  it("escuta download na nova aba antes de seu fechamento", async () => {
    const { context, page } = contexto();
    const popup = Object.assign(new EventEmitter(), { isClosed: () => true });
    const result = await capturarPdfBoleto({ page, context, timeoutMs: 20, emitir: async () => {
      context.emit("page", popup);
      popup.emit("download", { createReadStream: async () => Readable.from([Buffer.from("%PDF-1.7 download")]) });
    } });
    expect(result.pdfBuffer.toString()).toContain("download");
    expect(popup.listenerCount("download")).toBe(0);
  });
  it("rejeita HTML servido como PDF e não imprime a tela administrativa como boleto", async () => {
    const { context, page } = contexto();
    await expect(capturarPdfBoleto({ page, context, timeoutMs: 1, emitir: async () => {
      context.emit("response", { headers: () => ({ "content-type": "application/pdf" }), body: async () => Buffer.from("<html>login</html>") });
    } })).rejects.toThrow("não retornou PDF válido");
    expect(context.listenerCount("response")).toBe(0);
  });
});
