import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AuditLogCentralRow = {
  id: string;
  empresa_id: string;
  usuario_id: string | null;
  modulo: string;
  acao: string;
  entidade_tipo: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
  usuario?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};

export async function logAuditEvent(
  empresaId: string,
  usuarioId: string | null,
  modulo: string,
  acao: string,
  entidadeTipo: string,
  entidadeId?: string | null,
  detalhes: Record<string, unknown> = {},
  correlationId?: string | null,
): Promise<AuditLogCentralRow> {
  const admin = createAdminClient();

  const { data: log, error } = await admin
    .from("audit_logs_central")
    .insert({
      empresa_id: empresaId,
      usuario_id: usuarioId || null,
      modulo,
      acao,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId || null,
      detalhes,
      correlation_id: correlationId || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao registrar audit_log:", error.message);
  }

  return log as AuditLogCentralRow;
}

export async function listAuditLogsForEmpresa(
  empresaId: string,
  filters?: {
    modulo?: string;
    acao?: string;
    usuario_id?: string;
    correlation_id?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ logs: AuditLogCentralRow[]; count: number }> {
  const admin = createAdminClient();
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let query = admin
    .from("audit_logs_central")
    .select("*, usuario:usuarios!usuario_id(id, nome, email)", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.modulo) {
    query = query.eq("modulo", filters.modulo);
  }
  if (filters?.acao) {
    query = query.eq("acao", filters.acao);
  }
  if (filters?.usuario_id) {
    query = query.eq("usuario_id", filters.usuario_id);
  }
  if (filters?.correlation_id) {
    query = query.eq("correlation_id", filters.correlation_id);
  }

  const { data: logs, count, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar logs de auditoria: ${error.message}`);
  }

  return {
    logs: (logs || []) as AuditLogCentralRow[],
    count: count || 0,
  };
}
