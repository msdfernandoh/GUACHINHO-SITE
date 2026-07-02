import { describe, expect, it } from "vitest";
import { buildFallbackReply } from "./fallback-engine";
import { DEFAULT_IA_CONFIG, resolveIaAssistantMode } from "@/lib/config/ia-defaults";
import { buildGuidedReply } from "./guided-assistant";

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

  it("default assistant mode is guided", () => {
    expect(resolveIaAssistantMode({ ...DEFAULT_IA_CONFIG, modo: undefined })).toBe("guided");
  });

  it("guided mode path does not require OpenAI key", () => {
    const guided = buildGuidedReply([{ role: "user", content: "Quanto consigo de crédito?" }], DEFAULT_IA_CONFIG);
    expect(guided.reply.length).toBeGreaterThan(5);
  });
});
