import { RACON_ADMINISTRADORA_ID, RACON_SLUG } from "@/lib/administradoras/constants";
import { normalizeAdministradoraSlug } from "@/lib/administradoras/rules";
import type { Administradora } from "@/lib/administradoras/types";

/** Campos mínimos do grupo para resolução estrutural da administradora. */
export type GrupoAdministradoraSource = {
  id?: string;
  administradora_id?: string | null;
  administradora?: string | null;
};

export type ResolvedGrupoAdministradora = {
  /** Fonte estrutural quando UUID válido; null se só legado textual. */
  administradora_id: string | null;
  /** Snapshot/display (texto legado ou nome canônico). */
  display: string | null;
  /** true quando a identidade estrutural veio do UUID. */
  fromUuid: boolean;
  /** true quando usou apenas texto legado controlado (transição). */
  legacyFallback: boolean;
};

export type GrupoAdministradoraDualWrite = {
  administradora_id: string;
  administradora: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Aliases textuais conhecidos da Racon no legado (não autorizam outras admins). */
export function isLegacyRaconText(valor: string | null | undefined): boolean {
  const slug = normalizeAdministradoraSlug(valor);
  return slug === RACON_SLUG;
}

export function isAdministradoraUuid(valor: string | null | undefined): boolean {
  return typeof valor === "string" && UUID_RE.test(valor.trim());
}

/**
 * Resolve identidade da administradora do grupo.
 * 1) UUID = fonte estrutural
 * 2) texto = snapshot/display + fallback legado controlado (só transição)
 * Nunca usar texto para autorização futura quando UUID existir.
 */
export function resolveGrupoAdministradora(
  grupo: GrupoAdministradoraSource,
  catalogById?: Map<string, Pick<Administradora, "id" | "nome" | "slug" | "status">>,
): ResolvedGrupoAdministradora {
  const id = grupo.administradora_id?.trim() || null;
  const text = (grupo.administradora ?? null)?.toString().trim() || null;

  if (id) {
    if (!isAdministradoraUuid(id)) {
      throw new Error("administradora_id do grupo é inválido.");
    }
    if (catalogById && !catalogById.has(id)) {
      throw new Error("Administradora global do grupo não encontrada.");
    }
    const fromCatalog = catalogById?.get(id);
    return {
      administradora_id: id,
      display: text ?? fromCatalog?.nome ?? null,
      fromUuid: true,
      legacyFallback: false,
    };
  }

  return {
    administradora_id: null,
    display: text,
    fromUuid: false,
    legacyFallback: text != null,
  };
}

/**
 * Dual-write seguro para create/update de grupos.
 * Exige UUID resolvido — não aceita texto arbitrário sem correspondência global.
 */
export function buildGrupoAdministradoraDualWrite(input: {
  administradoraId: string;
  administradora: Pick<Administradora, "id" | "nome" | "nome_fantasia" | "slug" | "status">;
  /** Texto legado atual (edição): preservado se alias da mesma admin. */
  existingText?: string | null;
  /** Texto enviado no form (opcional; não autoriza sozinho). */
  requestedText?: string | null;
}): GrupoAdministradoraDualWrite {
  const id = input.administradoraId.trim();
  if (!isAdministradoraUuid(id)) {
    throw new Error("administradora_id inválido.");
  }
  if (input.administradora.id !== id) {
    throw new Error("Administradora informada não corresponde ao UUID.");
  }
  if (input.administradora.status !== "ATIVA") {
    throw new Error("Não é possível vincular grupo a administradora global INATIVA.");
  }

  const existing = (input.existingText ?? "").trim();
  if (existing && isLegacyRaconText(existing) && input.administradora.slug === RACON_SLUG) {
    // Preserva RACON vs Racon no legado durante a transição.
    return { administradora_id: id, administradora: existing };
  }

  const requested = (input.requestedText ?? "").trim();
  if (requested && isLegacyRaconText(requested) && input.administradora.slug === RACON_SLUG) {
    return { administradora_id: id, administradora: requested };
  }

  const snapshot =
    (input.administradora.nome_fantasia ?? input.administradora.nome)?.trim() ||
    input.administradora.nome;
  if (!snapshot) {
    throw new Error("Administradora sem nome canônico para snapshot.");
  }
  return { administradora_id: id, administradora: snapshot };
}

/** Resolve candidato a partir de UUID explícito ou alias legado Racon (somente). */
export function resolveAdministradoraCandidateFromForm(input: {
  administradoraIdRaw?: string | null;
  administradoraTextRaw?: string | null;
}): { mode: "uuid"; id: string } | { mode: "legacy_racon" } {
  const idRaw = (input.administradoraIdRaw ?? "").trim();
  if (idRaw) {
    if (!isAdministradoraUuid(idRaw)) {
      throw new Error("administradora_id inválido.");
    }
    return { mode: "uuid", id: idRaw };
  }

  const text = (input.administradoraTextRaw ?? "").trim();
  if (!text) {
    throw new Error("Informe a administradora do grupo (UUID ou Racon).");
  }
  if (isLegacyRaconText(text)) {
    return { mode: "legacy_racon" };
  }
  throw new Error(
    "Texto de administradora não reconhecido. Selecione uma administradora global válida.",
  );
}

export function raconAdministradoraId(): string {
  return RACON_ADMINISTRADORA_ID;
}
