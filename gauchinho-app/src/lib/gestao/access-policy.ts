export type GestaoAccessMode = "read" | "write";

export type GestaoMembership = {
  empresa_id: string;
  papel?: { codigo: string } | null;
};

export type GestaoMembershipDecision =
  | { allowed: true }
  | { allowed: false; reason: "missing_tenant" | "forbidden_role" };

const GESTAO_READ_ROLES = new Set(["admin_empresa", "gestor", "consultor", "visualizador"]);
const GESTAO_WRITE_ROLES = new Set(["admin_empresa"]);

export function evaluateGestaoMembership(
  memberships: GestaoMembership[],
  empresaId: string,
  mode: GestaoAccessMode,
): GestaoMembershipDecision {
  const membership = memberships.find((item) => item.empresa_id === empresaId);
  if (!membership) return { allowed: false, reason: "missing_tenant" };

  const papelCodigo = membership.papel?.codigo;
  const allowed = papelCodigo
    ? (mode === "write" ? GESTAO_WRITE_ROLES : GESTAO_READ_ROLES).has(papelCodigo)
    : false;

  return allowed ? { allowed: true } : { allowed: false, reason: "forbidden_role" };
}
