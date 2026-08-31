import { createHash } from "node:crypto";

export function normalizeGrupoCodigo(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function grupoCreateIdempotencyKey(input: {
  empresaId: string; administradoraId: string; tipoId: string; codigo: string;
}) {
  return `erp-grupo:${createHash("sha256").update([
    input.empresaId, input.administradoraId, input.tipoId, normalizeGrupoCodigo(input.codigo),
  ].join(":"), "utf8").digest("hex")}`;
}
