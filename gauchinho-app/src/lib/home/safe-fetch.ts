export function isMissingDbObjectError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "42703" ||
    /does not exist/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    /Could not find the .* column/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

export async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isMissingDbObjectError(err)) return fallback;
    console.error("[home] fetch failed:", err);
    return fallback;
  }
}
