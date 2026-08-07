import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "@/lib/parceiros/constants";
import { resolvePartnerPublicRequest } from "@/lib/parceiros/public-site-loader";
import {
  PARCEIRO_SITE_ID_HEADER,
  PARCEIRO_SITE_SLUG_HEADER,
  PARCEIRO_SOURCE_HEADER,
} from "@/lib/parceiros/partner-site-types";
import { TENANT_EMPRESA_ID_HEADER, TENANT_SLUG_HEADER } from "@/lib/tenant/constants";
import {
  isLegacyOperationalApiPath,
  isLegacyOperationalPath,
  isPlatformEmpresasAdminPath,
  tenantAllowsLegacyOperationalData,
} from "@/lib/tenant/operational-access";
import { resolveTenantForRequest } from "@/lib/tenant/resolve-by-host";

/**
 * Rotas que não exigem resolução de tenant publicada
 * (cron, OAuth callback, health). Auth própria quando aplicável.
 */
function skipsTenantGate(pathname: string): boolean {
  if (pathname.startsWith("/api/cron")) return true;
  if (pathname.startsWith("/api/auth/google-calendar/callback")) return true;
  if (pathname === "/api/health" || pathname === "/health") return true;
  return false;
}

function siteNotConfiguredResponse(): NextResponse {
  return new NextResponse("Site não configurado para este domínio.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function moduleUnavailableApiResponse(): NextResponse {
  return NextResponse.json(
    { error: "Módulo ainda não disponível para este site." },
    { status: 404 },
  );
}

function adminUnavailableOnTenantResponse(): NextResponse {
  return new NextResponse("Painel administrativo não disponível neste site.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * Grafo de imports (proxy → Supabase):
 * proxy.ts
 *   → resolveTenantForRequest (lib/tenant/resolve-by-host.ts)
 *       → @supabase/supabase-js createClient (leitura local de env; sem admin.ts)
 *   → @supabase/ssr createServerClient (anon key — auth/cookies)
 *
 * NÃO importa lib/supabase/admin.ts (server-only / Node).
 * NÃO copia service role para headers nem respostas.
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // Headers internos: sempre remover qualquer valor injetado pelo cliente
  // antes de definir os confiáveis (tenant Fase 2 + parceiro E6).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TENANT_EMPRESA_ID_HEADER);
  requestHeaders.delete(TENANT_SLUG_HEADER);
  requestHeaders.delete(PARCEIRO_SITE_ID_HEADER);
  requestHeaders.delete(PARCEIRO_SITE_SLUG_HEADER);
  requestHeaders.delete(PARCEIRO_SOURCE_HEADER);

  if (!supabaseUrl || !anonKey) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const skipTenant = skipsTenantGate(path);
  let tenantSlug: string | null = null;

  if (!skipTenant) {
    // Resolução lê credenciais de env internamente — proxy não passa service role.
    const resolved = await resolveTenantForRequest({
      hostHeader: request.headers.get("host"),
      searchParams: request.nextUrl.searchParams,
    });

    if (!resolved.ok) {
      // E8: host de domínio/subdomínio de parceiro (só com flag pública).
      // Com flag=false, comportamento Fase 2 permanece (404 / dev local).
      if (FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
        const partner = await resolvePartnerPublicRequest({
          hostHeader: request.headers.get("host"),
          pathname: path === "/" ? "/" : path,
          searchParams: request.nextUrl.searchParams,
          mode: "public",
        });
        if (partner.ok) {
          if (partner.redirect) {
            return NextResponse.redirect(partner.redirect.location, 308);
          }
          requestHeaders.set(TENANT_EMPRESA_ID_HEADER, partner.partner.empresa_id);
          requestHeaders.set(TENANT_SLUG_HEADER, partner.partner.empresa_slug);
          requestHeaders.set(PARCEIRO_SITE_ID_HEADER, partner.partner.parceiro_site_id);
          requestHeaders.set(PARCEIRO_SITE_SLUG_HEADER, partner.partner.site_slug);
          requestHeaders.set(PARCEIRO_SOURCE_HEADER, partner.partner.source);
          tenantSlug = partner.partner.empresa_slug;

          const rewriteUrl = request.nextUrl.clone();
          rewriteUrl.pathname = `/parceiro/${partner.partner.site_slug}`;
          let response = NextResponse.rewrite(rewriteUrl, {
            request: { headers: requestHeaders },
          });
          // Auth cookie plumbing below expects `response` — fall through via early return after auth.
          const supabase = createServerClient(supabaseUrl, anonKey, {
            cookies: {
              getAll() {
                return request.cookies.getAll();
              },
              setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.rewrite(rewriteUrl, {
                  request: { headers: requestHeaders },
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                  response.cookies.set(name, value, options)
                );
              },
            },
          });
          await supabase.auth.getUser();
          return response;
        }
      }

      if (process.env.NODE_ENV === "development") {
        const host = (request.headers.get("host") ?? "").toLowerCase();
        const isLocal =
          host.startsWith("localhost") ||
          host.startsWith("127.0.0.1") ||
          host.includes(".localhost");
        if (isLocal) {
          requestHeaders.set(TENANT_EMPRESA_ID_HEADER, "dev-gauchinho-synthetic");
          requestHeaders.set(TENANT_SLUG_HEADER, "gauchinho");
          tenantSlug = "gauchinho";
        } else {
          return siteNotConfiguredResponse();
        }
      } else {
        return siteNotConfiguredResponse();
      }
    } else {
      requestHeaders.set(TENANT_EMPRESA_ID_HEADER, resolved.tenant.empresaId);
      requestHeaders.set(TENANT_SLUG_HEADER, resolved.tenant.slug);
      tenantSlug = resolved.tenant.slug;
    }

    // Bloqueio de APIs/páginas operacionais públicas para tenants ≠ gauchinho.
    // /admin NÃO entra aqui — autenticação/autorização abaixo.
    if (tenantSlug && !tenantAllowsLegacyOperationalData(tenantSlug)) {
      if (isLegacyOperationalApiPath(path)) {
        return moduleUnavailableApiResponse();
      }
      if (isLegacyOperationalPath(path)) {
        const home = new URL("/", request.url);
        home.searchParams.set("modulo", "indisponivel");
        return NextResponse.redirect(home);
      }
    }
  }

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // --- Autenticação/admin (preservada do middleware legado) ---
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path.startsWith("/admin")) {
    // 1) Autenticação
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }

    // 2) Host institucional ≠ Gauchinho: não redireciona para /?modulo=indisponivel.
    //    Bloqueia painel operacional; /admin/empresas segue para checagem SuperAdmin na página.
    if (tenantSlug && !tenantAllowsLegacyOperationalData(tenantSlug)) {
      if (!isPlatformEmpresasAdminPath(path)) {
        return adminUnavailableOnTenantResponse();
      }
    }
  }

  if (path === "/login" && user) {
    const { data: perfilRow } = await supabase
      .from("usuarios")
      .select("perfil")
      .eq("auth_user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();
    const dest =
      perfilRow?.perfil === "imobiliaria" ? "/admin/minha-imobiliaria" : "/admin";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (path.startsWith("/admin") && user) {
    const { data: perfilRow } = await supabase
      .from("usuarios")
      .select("perfil")
      .eq("auth_user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (perfilRow?.perfil === "imobiliaria" && path === "/admin") {
      return NextResponse.redirect(new URL("/admin/minha-imobiliaria", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|manifest\\.json|assets/|media/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|eot|txt|xml|json)$).*)",
  ],
};
