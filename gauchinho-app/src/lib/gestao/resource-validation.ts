import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const RESOURCE_TABLES = {
  equipe: "equipes",
  participante: "participantes_comerciais",
  parceiro: "organizacoes_parceiras",
  lead: "leads",
  proposta: "propostas",
  venda: "vendas",
} as const;

export type GestaoResourceType = keyof typeof RESOURCE_TABLES;

export async function assertGestaoResourceTenant(
  empresaId: string,
  resourceType: GestaoResourceType,
  resourceId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(RESOURCE_TABLES[resourceType])
    .select("id")
    .eq("id", resourceId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Recurso ${resourceType} não pertence ao tenant.`);
  }
}
