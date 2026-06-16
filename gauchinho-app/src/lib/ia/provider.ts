import type { IaChatMessage } from "./types";

export type IaProviderResult =
  | { ok: true; content: string }
  | { ok: false; reason: "missing_key" | "provider_error"; message?: string };

export async function chatWithIaProvider(
  systemPrompt: string,
  messages: IaChatMessage[],
): Promise<IaProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const provider = (process.env.IA_PROVIDER ?? "openai").toLowerCase();
  const model = process.env.IA_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey || provider !== "openai") {
    return { ok: false, reason: "missing_key" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 800,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ia/provider]", res.status, errText.slice(0, 300));
      return { ok: false, reason: "provider_error", message: errText };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, reason: "provider_error", message: "Resposta vazia" };
    }
    return { ok: true, content };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro de rede";
    console.error("[ia/provider]", message);
    return { ok: false, reason: "provider_error", message };
  }
}
