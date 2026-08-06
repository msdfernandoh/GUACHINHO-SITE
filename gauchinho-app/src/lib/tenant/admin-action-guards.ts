import { validateHostForPersist } from "./dominio";

const ALLOWED_STATUS = new Set(["ativo", "suspenso", "cancelado", "em_treinamento"]);
const ALLOWED_PUB = new Set(["RASCUNHO", "PUBLICADO"]);
const ALLOWED_TIPO = new Set(["DOMINIO_CUSTOMIZADO", "SUBDOMINIO"]);

export function validateEmpresaStatusInput(status: string): { ok: true; status: string; ativo: boolean } | { ok: false; error: string } {
  if (!ALLOWED_STATUS.has(status)) return { ok: false, error: "Status inválido." };
  return { ok: true, status, ativo: status === "ativo" };
}

export function validateBrandingPublishInput(input: {
  nomeSite: string;
  statusPublicacao: string;
  empresaStatus?: string;
  empresaAtivo?: boolean;
}): { ok: true; statusPublicacao: string } | { ok: false; error: string } {
  if (!input.nomeSite.trim()) return { ok: false, error: "Nome do site é obrigatório." };
  if (!ALLOWED_PUB.has(input.statusPublicacao)) {
    return { ok: false, error: "Status de publicação inválido." };
  }
  if (input.statusPublicacao === "PUBLICADO") {
    if (input.empresaStatus !== "ativo" || !input.empresaAtivo) {
      return {
        ok: false,
        error: "Não é possível publicar site de empresa inativa ou em treinamento.",
      };
    }
  }
  return { ok: true, statusPublicacao: input.statusPublicacao };
}

export function validateDominioCreateInput(input: {
  tipo: string;
  valorRaw: string;
}): { ok: true; tipo: string; valor: string } | { ok: false; error: string } {
  if (!ALLOWED_TIPO.has(input.tipo)) return { ok: false, error: "Tipo de domínio inválido." };
  const validated = validateHostForPersist(input.valorRaw);
  if (!validated.ok) return validated;
  return { ok: true, tipo: input.tipo, valor: validated.valor };
}
