type Props = {
  hasOpenAiKey: boolean;
  provider: string;
  model: string;
};

export function IaEnvStatusBanner({ hasOpenAiKey, provider, model }: Props) {
  const ok = hasOpenAiKey && provider.toLowerCase() === "openai";
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      }`}
    >
      <p className="font-semibold">{ok ? "IA configurada (OpenAI)" : "IA sem chave ou provider — modo fallback ativo"}</p>
      <p className="mt-1 text-xs opacity-90">
        Provider: {provider || "openai"} · Modelo: {model || "gpt-4o-mini"}
        {!hasOpenAiKey ? " · Defina OPENAI_API_KEY na Vercel" : ""}
      </p>
    </div>
  );
}
