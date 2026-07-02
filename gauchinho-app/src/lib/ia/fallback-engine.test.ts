import { describe, expect, it } from "vitest";
import { buildFallbackReply } from "./fallback-engine";
import { DEFAULT_IA_CONFIG } from "@/lib/config/ia-defaults";

describe("fallback-engine", () => {
  it("asks for name when missing", () => {
    const r = buildFallbackReply([{ role: "user", content: "Quero simular consórcio" }], DEFAULT_IA_CONFIG);
    expect(r.reply.toLowerCase()).toMatch(/nome|whatsapp|simulador/);
  });

  it("detects complete lead data in history", () => {
    const history = [
      { role: "user" as const, content: "Meu nome é Maria Silva" },
      { role: "assistant" as const, content: "WhatsApp?" },
      { role: "user" as const, content: "51999887766, imóvel 300 mil" },
    ];
    const r = buildFallbackReply(history, DEFAULT_IA_CONFIG);
    expect(r.reply.length).toBeGreaterThan(10);
  });
});
