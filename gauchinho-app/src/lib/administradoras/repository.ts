import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Administradora, EmpresaAdministradora } from "./types";

type ConcessaoJoinRow = {
  id: string;
  empresa_id: string;
  administradora_id: string;
  status: EmpresaAdministradora["status"];
  administradora: Administradora | Administradora[] | null;
};

function unwrapAdmin(
  value: Administradora | Administradora[] | null,
): Administradora | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Listagem GLOBAL — sessão do Superadmin (RLS 047).
 * Não usar service role aqui.
 */
export async function fetchAdministradorasGlobais(): Promise<Administradora[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("administradoras")
    .select(
      "id, nome, nome_fantasia, razao_social, cnpj, slug, logo_url, site_url, status, recursos_integracao, metadata, created_at, updated_at",
    )
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as Administradora[];
}

/**
 * Concessões + administradora de UMA empresa.
 * Service role: RLS E1 bloqueia SELECT do tenant; caller DEVE ter validado sessão antes.
 */
export async function fetchConcessoesComAdministradoraByEmpresa(
  empresaId: string,
): Promise<
  Array<{
    concessao: Pick<
      EmpresaAdministradora,
      "id" | "empresa_id" | "administradora_id" | "status"
    >;
    administradora: Administradora | null;
  }>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("empresa_administradoras")
    .select(
      `
      id,
      empresa_id,
      administradora_id,
      status,
      administradora:administradoras(
        id, nome, nome_fantasia, razao_social, cnpj, slug, logo_url, site_url, status,
        recursos_integracao, metadata, created_at, updated_at
      )
    `,
    )
    .eq("empresa_id", empresaId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ConcessaoJoinRow[]).map((row) => ({
    concessao: {
      id: row.id,
      empresa_id: row.empresa_id,
      administradora_id: row.administradora_id,
      status: row.status,
    },
    administradora: unwrapAdmin(row.administradora),
  }));
}

/**
 * Busca pontual por administradora_id + empresa (service role pós-auth).
 */
export async function fetchConcessaoEmpresaAdministradora(
  empresaId: string,
  administradoraId: string,
): Promise<{
  concessao: Pick<
    EmpresaAdministradora,
    "id" | "empresa_id" | "administradora_id" | "status"
  > | null;
  administradora: Administradora | null;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("empresa_administradoras")
    .select(
      `
      id,
      empresa_id,
      administradora_id,
      status,
      administradora:administradoras(
        id, nome, nome_fantasia, razao_social, cnpj, slug, logo_url, site_url, status,
        recursos_integracao, metadata, created_at, updated_at
      )
    `,
    )
    .eq("empresa_id", empresaId)
    .eq("administradora_id", administradoraId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { concessao: null, administradora: null };
  }
  const row = data as ConcessaoJoinRow;
  return {
    concessao: {
      id: row.id,
      empresa_id: row.empresa_id,
      administradora_id: row.administradora_id,
      status: row.status,
    },
    administradora: unwrapAdmin(row.administradora),
  };
}
