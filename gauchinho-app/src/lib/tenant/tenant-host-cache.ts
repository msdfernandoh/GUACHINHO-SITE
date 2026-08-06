/**
 * Cache server-side por host normalizado para resolução de tenant.
 *
 * Estratégia:
 * - chave = host normalizado (sem segredo);
 * - hit positivo: TTL longo (60s);
 * - miss negativo (domínio inexistente): TTL curto (10s);
 * - erros transitórios: NÃO entram no cache permanente (TTL 2s no máximo);
 * - invalidação explícita via bump de geração após edição admin.
 *
 * Não mistura tenants: cada chave guarda no máximo um resultado.
 * Em Edge/proxy o cache é por isolate; em Node (RSC) compartilha o módulo.
 */

export type CachedTenantHit = {
  kind: "hit";
  empresaId: string;
  slug: string;
  source: "domain" | "dev_override" | "emergency_gauchinho_fallback";
};

export type CachedTenantMiss = {
  kind: "miss";
  reason: "not_found" | "inactive" | "unpublished" | "infra_unavailable";
};

export type CachedTenantEntry = CachedTenantHit | CachedTenantMiss;

type InternalEntry = {
  value: CachedTenantEntry;
  expiresAt: number;
  generation: number;
};

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const ERROR_TTL_MS = 2_000;

let generation = 0;
const store = new Map<string, InternalEntry>();
let nowFn: () => number = () => Date.now();

/** Injeção de relógio para testes (não usar em produção). */
export function setTenantCacheNow(fn: () => number): void {
  nowFn = fn;
}

export function resetTenantCacheNow(): void {
  nowFn = () => Date.now();
}

export function invalidateTenantHostCache(): void {
  generation += 1;
  store.clear();
}

export function getCachedTenantResolution(hostKey: string): CachedTenantEntry | null {
  const entry = store.get(hostKey);
  if (!entry) return null;
  if (entry.generation !== generation) {
    store.delete(hostKey);
    return null;
  }
  if (nowFn() > entry.expiresAt) {
    store.delete(hostKey);
    return null;
  }
  return entry.value;
}

export function setCachedTenantResolution(
  hostKey: string,
  value: CachedTenantEntry,
  opts?: { errorTransient?: boolean },
): void {
  const ttl =
    opts?.errorTransient
      ? ERROR_TTL_MS
      : value.kind === "hit"
        ? POSITIVE_TTL_MS
        : NEGATIVE_TTL_MS;
  store.set(hostKey, {
    value,
    expiresAt: nowFn() + ttl,
    generation,
  });
}

export const TENANT_CACHE_TTL = {
  positiveMs: POSITIVE_TTL_MS,
  negativeMs: NEGATIVE_TTL_MS,
  errorMs: ERROR_TTL_MS,
} as const;
