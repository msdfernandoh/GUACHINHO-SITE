import type { IaAssistantMode } from "@/lib/config/ia-defaults";

type Props = {
  hasOpenAiKey: boolean;
  provider: string;
  model: string;
  assistantMode: IaAssistantMode;
};

export function IaEnvStatusBanner({ hasOpenAiKey, provider, model, assistantMode }: Props) {
  const keyOk = hasOpenAiKey && provider.toLowerCase() === "openai";

  if (assistantMode === "guided") {
    return (
      <div className="mb-4 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100">
        <p className="font-semibold">Modo atual: Guiado</p>
        <p className="mt-1 text-xs opacity-90">
          Não depende de OpenAI. Usa fluxos estruturados e cálculos do site.
        </p>
      </div>
    );
  }

  if (assistantMode === "hybrid") {
    return (
      <div className="mb-4 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm text-violet-900 dark:text-violet-100">
        <p className="font-semibold">Modo atual: Híbrido</p>
        <p className="mt-1 text-xs opacity-90">
          Usa OpenAI quando disponível e cai para modo guiado em falha.
        </p>
        <p className="mt-1 text-xs opacity-80">
          Status da chave: {keyOk ? "configurada" : "ausente"} · Provider: {provider || "openai"} · Modelo:{" "}
          {model || "gpt-4o-mini"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        keyOk
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      }`}
    >
      <p className="font-semibold">Modo atual: OpenAI</p>
      <p className="mt-1 text-xs opacity-90">
        Status da chave: {keyOk ? "configurada" : "ausente — o chat pode seguir no modo guiado"}
      </p>
      <p className="mt-1 text-xs opacity-80">
        Provider: {provider || "openai"} · Modelo: {model || "gpt-4o-mini"}
        {!hasOpenAiKey ? " · Defina OPENAI_API_KEY na Vercel" : ""}
      </p>
    </div>
  );
}
