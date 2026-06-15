import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export type SiteConfig = {
  nomeEmpresa: string;
  subtitulo: string;
  descricaoInstitucional: string;
  siteUrl: string;
  statusAtivo: boolean;
  exibirBotaoGruposNoSite: boolean;
};

export type LeadsConfig = {
  statusInicialPadrao: string;
  permitirCriarLeadManual: boolean;
  permitirArquivarLead: boolean;
  srdPodeEditarGrupos?: boolean;
};

export const DEFAULT_SITE: SiteConfig = {
  nomeEmpresa: "Gauchinho Escritório de Soluções Financeiras",
  subtitulo: "",
  descricaoInstitucional: "",
  siteUrl: "",
  statusAtivo: true,
  exibirBotaoGruposNoSite: false,
};

export const DEFAULT_LEADS: LeadsConfig = {
  statusInicialPadrao: "Novo",
  permitirCriarLeadManual: true,
  permitirArquivarLead: true,
  srdPodeEditarGrupos: false,
};
