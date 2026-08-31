import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { RACON_LOGO, visibleModelMenus } from "./site-appearance";

export type EmpresaSiteModel = {
  id: string;
  codigo: string;
  nome: string;
  versao: number;
  identidadeVisual: Record<string, unknown>;
  menus: Array<{
    id: string;
    label: string;
    rota: string;
    ativo_padrao?: boolean;
    ativo?: boolean;
    obrigatorio?: boolean;
  }>;
  secoes: Array<{
    id: string;
    tipo: string;
    titulo: string;
    ordem: number;
    habilitada: boolean;
  }>;
  footerCopyright: string | null;
  logoPadraoUrl: string | null;
  usarLogoPropria: boolean;
};

/**
 * Resolve o modelo publicado atribuído à empresa. A fonte canônica é
 * empresa_site_modelos; branding não duplica essa decisão.
 */
export async function getEmpresaSiteModelPublic(
  empresaId: string,
): Promise<EmpresaSiteModel | null> {
  if (empresaId.startsWith("emergency-") || empresaId.startsWith("dev-")) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empresa_site_modelos")
      .select("status,menus_habilitados,secoes_customizadas,usar_logo_propria,modelo:site_modelos!inner(id,codigo,nome,versao,status,identidade_visual,catalogo_menus,secoes_home,configuracao_footer,logo_padrao_url)")
      .eq("empresa_id", empresaId)
      .eq("status", "PUBLICADO")
      .eq("modelo.status", "PUBLICADO")
      .maybeSingle();

    if (error || !data?.modelo) return null;
    const modelo = Array.isArray(data.modelo) ? data.modelo[0] : data.modelo;
    if (!modelo) return null;
    const vinculo = data as unknown as {
      menus_habilitados?: string[] | null;
      secoes_customizadas?: unknown[] | null;
      usar_logo_propria?: boolean | null;
    };
    const catalogo = Array.isArray(modelo.catalogo_menus) ? modelo.catalogo_menus : [];
    const idsHabilitados = new Set(
      Array.isArray(vinculo.menus_habilitados) ? vinculo.menus_habilitados : [],
    );
    const menus = visibleModelMenus(catalogo, [...idsHabilitados]);
    const secoesCustomizadas = Array.isArray(vinculo.secoes_customizadas)
      ? vinculo.secoes_customizadas
      : [];
    const secoes = secoesCustomizadas.length > 0
      ? secoesCustomizadas
      : Array.isArray(modelo.secoes_home) ? modelo.secoes_home : [];
    const footer = modelo.configuracao_footer && typeof modelo.configuracao_footer === "object"
      ? modelo.configuracao_footer as { copyright?: string }
      : {};

    return {
      id: modelo.id,
      codigo: modelo.codigo,
      nome: modelo.nome,
      versao: Number(modelo.versao || 1),
      identidadeVisual: modelo.identidade_visual && typeof modelo.identidade_visual === "object"
        ? modelo.identidade_visual as Record<string, unknown>
        : {},
      menus,
      secoes,
      footerCopyright: footer.copyright ?? null,
      logoPadraoUrl: modelo.logo_padrao_url || (modelo.codigo === "racon_inspired" ? RACON_LOGO : null),
      usarLogoPropria: Boolean(vinculo.usar_logo_propria),
    };
  } catch {
    return null;
  }
}
