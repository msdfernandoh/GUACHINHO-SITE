import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { fetchAllConfigsForAdmin, fetchWhatsappOrigens } from "./actions";
import { ConfigTabs } from "./config-tabs";

export default async function ConfiguracoesPage() {
  const usuario = await getUsuarioNegocio();
  if (!canEditSettings(usuario?.perfil)) {
    redirect("/admin");
  }
  const [configs, whatsapp] = await Promise.all([
    fetchAllConfigsForAdmin(),
    fetchWhatsappOrigens(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações gerais</h1>
        <p className="text-sm text-zinc-500">Master — chaves JSON em configuracoes_sistema</p>
      </div>
      <ConfigTabs
        configs={configs}
        whatsapp={whatsapp as Array<Record<string, unknown>>}
        iaEnv={{
          hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
          provider: process.env.IA_PROVIDER ?? "openai",
          model: process.env.IA_MODEL?.trim() || "gpt-4o-mini",
        }}
      />
    </div>
  );
}
