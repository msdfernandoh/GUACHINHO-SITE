import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin (service role). Bypass RLS — usar só no servidor
 * (Route Handlers, Server Actions, Server Components, jobs).
 * Nunca importar em Client Components.
 */
export function createAdminClient(options?: { noStore?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(options?.noStore
      ? {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, { ...init, cache: "no-store" }),
          },
        }
      : {}),
  });
}
