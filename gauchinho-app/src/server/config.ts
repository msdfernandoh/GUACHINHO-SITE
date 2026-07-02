import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_LEADS,
  DEFAULT_PROPOSTAS,
  DEFAULT_CONTATO,
  DEFAULT_SIMULADOR_AUTOMOVEL,
  DEFAULT_SIMULADOR_IMOVEL,
  DEFAULT_SITE,
  DEFAULT_HOME_CARTAS,
  DEFAULT_CALCULADORAS_FINANCEIRAS,
  type FinanciamentoConfig,
  type LeadsConfig,
  type PropostasConfig,
  type ContatoConfig,
  type SimuladorTipoBemConfig,
  type SiteConfig,
  type HomeCartasConfig,
  type CalculadorasFinanceirasConfig,
} from "@/lib/config/defaults";

export {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_LEADS,
  DEFAULT_PROPOSTAS,
  DEFAULT_CONTATO,
  DEFAULT_SIMULADOR_AUTOMOVEL,
  DEFAULT_SIMULADOR_IMOVEL,
  DEFAULT_SITE,
  DEFAULT_HOME_CARTAS,
  DEFAULT_CALCULADORAS_FINANCEIRAS,
  type FinanciamentoConfig,
  type LeadsConfig,
  type PropostasConfig,
  type ContatoConfig,
  type SimuladorTipoBemConfig,
  type SiteConfig,
  type HomeCartasConfig,
  type CalculadorasFinanceirasConfig,
};

export async function getConfigJson<T>(chave: string, fallback: T): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  if (!data?.valor) return fallback;
  return { ...fallback, ...(data.valor as T) };
}

export async function saveConfigJson(chave: string, valor: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("configuracoes_sistema").upsert(
    { chave, valor },
    { onConflict: "chave" },
  );
  if (error) throw new Error(error.message);
}

export async function getConfigJsonPublic<T>(chave: string, fallback: T): Promise<T> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    if (!data?.valor) return fallback;
    return { ...fallback, ...(data.valor as T) };
  } catch {
    return fallback;
  }
}

export async function getSimuladorConfigsPublic() {
  const { normalizeFinanciamentoStored } = await import("@/lib/config/financiamento-por-tipo");
  const [imovel, automovel, financiamentoRaw] = await Promise.all([
    getConfigJsonPublic("simulador_imovel", DEFAULT_SIMULADOR_IMOVEL),
    getConfigJsonPublic("simulador_automovel", DEFAULT_SIMULADOR_AUTOMOVEL),
    getConfigJsonPublic("financiamento_config", DEFAULT_FINANCIAMENTO_CONFIG),
  ]);
  return {
    imovel,
    automovel,
    financiamento: normalizeFinanciamentoStored(financiamentoRaw),
  };
}

export async function getCalculadorasConfigPublic() {
  return getConfigJsonPublic(
    "calculadoras_financeiras",
    DEFAULT_CALCULADORAS_FINANCEIRAS,
  );
}

export async function getIaConfigPublic() {
  const { DEFAULT_IA_CONFIG } = await import("@/lib/config/ia-defaults");
  return getConfigJsonPublic("ia_config", DEFAULT_IA_CONFIG);
}

export async function getHomeModulosConfigPublic() {
  const { DEFAULT_HOME_MODULOS, normalizeHomeModulosConfig } = await import("@/lib/config/home-modulos");
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "home_modulos_config")
      .maybeSingle();
    return normalizeHomeModulosConfig(data?.valor);
  } catch {
    return DEFAULT_HOME_MODULOS;
  }
}
