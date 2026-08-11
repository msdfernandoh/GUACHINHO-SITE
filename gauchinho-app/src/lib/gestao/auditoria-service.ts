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
  origem: string;
  resultado: string;
  created_at: string;
  usuario?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};

const AUDIT_SENSITIVE_KEY = /password|senha|secret|token|cookie|authorization|bearer/i;

/** Remove credenciais e tokens antes que metadata chegue ao log append-only. */
export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !AUDIT_SENSITIVE_KEY.test(key))
      .map(([key, item]) => [key, sanitizeAuditMetadata(item)]),
  );
}

export async function logAuditEvent(
  empresaId: string,
  usuarioId: string | null,
  modulo: string,
  acao: string,
  entidadeTipo: string,
  entidadeId?: string | null,
  detalhes: Record<string, unknown> = {},
  correlationId?: string | null,
  origem = "runtime_service",
  resultado = "SUCESSO",
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
      detalhes: sanitizeAuditMetadata(detalhes) as Record<string, unknown>,
      correlation_id: correlationId || null,
      origem,
      resultado,
    })
    .select("*")
    .single();

  if (error || !log) throw new Error(`Erro ao registrar audit_log: ${error?.message ?? "registro ausente"}`);

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
