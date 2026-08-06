import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * O enum legado usuarios.perfil (master/srd/imobiliaria/visualizador) não tem
 * conceito de superadmin de plataforma. Reaproveita a função SECURITY DEFINER
 * public.is_platform_superadmin() já existente no banco desde a migration 043.
 */
export async function isPlatformSuperadmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_superadmin");
  if (error) return false;
  return Boolean(data);
}
