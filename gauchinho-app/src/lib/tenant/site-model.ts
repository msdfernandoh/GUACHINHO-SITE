import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type EmpresaSiteModel = {
  id: string;
  codigo: string;
  nome: string;
  versao: number;
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
      .select("status, modelo:site_modelos!inner(id,codigo,nome,versao,status)")
      .eq("empresa_id", empresaId)
      .eq("status", "PUBLICADO")
      .eq("modelo.status", "PUBLICADO")
      .maybeSingle();

    if (error || !data?.modelo) return null;
    const modelo = Array.isArray(data.modelo) ? data.modelo[0] : data.modelo;
    if (!modelo) return null;
    return {
      id: modelo.id,
      codigo: modelo.codigo,
      nome: modelo.nome,
      versao: Number(modelo.versao || 1),
    };
  } catch {
    return null;
  }
}
