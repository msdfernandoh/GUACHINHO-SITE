import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "@/lib/parceiros/constants";
import { resolvePartnerPublicRequest } from "@/lib/parceiros/public-site-loader";
import {
  PARCEIRO_SITE_ID_HEADER,
  PARCEIRO_SITE_SLUG_HEADER,
  PARCEIRO_SOURCE_HEADER,
} from "@/lib/parceiros/partner-site-types";
import {
  TENANT_EMPRESA_ID_HEADER,
  TENANT_OPERATIONAL_ENABLED_HEADER,
  TENANT_SLUG_HEADER,
} from "@/lib/tenant/constants";
import {
  isLegacyOperationalApiPath,
  isLegacyOperationalPath,
  tenantAllowsLegacyOperationalData,
} from "@/lib/tenant/operational-access";
import { isPlatformHost } from "@/lib/tenant/dominio";
import { decidePlatformHostAccess } from "@/lib/tenant/platform-host";
import { resolveHostContextForRequest } from "@/lib/tenant/resolve-by-host";

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

function platformAccessDeniedResponse(): NextResponse {
  return new NextResponse("Acesso restrito ao PLATFORM_SUPERADMIN.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function platformRouteUnavailableResponse(): NextResponse {
  return new NextResponse("Rota indisponível no host da plataforma.", {
    status: 404,
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
  requestHeaders.delete(TENANT_OPERATIONAL_ENABLED_HEADER);
  requestHeaders.delete(PARCEIRO_SITE_ID_HEADER);
  requestHeaders.delete(PARCEIRO_SITE_SLUG_HEADER);
  requestHeaders.delete(PARCEIRO_SOURCE_HEADER);

  if (!supabaseUrl || !anonKey) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const skipTenant = skipsTenantGate(path);
  let tenantSlug: string | null = null;
  let tenantOperationalEnabled = false;
  let platformHost = isPlatformHost(request.headers.get("host"));

  if (!skipTenant) {
    // Resolução lê credenciais de env internamente — proxy não passa service role.
    const resolved = await resolveHostContextForRequest({
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
          requestHeaders.set(TENANT_OPERATIONAL_ENABLED_HEADER, "true");
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

      return siteNotConfiguredResponse();
    } else if (resolved.context === "platform") {
      // Contexto global: não envia empresa/slug em headers e não consulta tenant.
      platformHost = true;
    } else {
      requestHeaders.set(TENANT_EMPRESA_ID_HEADER, resolved.tenant.empresaId);
      requestHeaders.set(TENANT_SLUG_HEADER, resolved.tenant.slug);
      requestHeaders.set(
        TENANT_OPERATIONAL_ENABLED_HEADER,
        resolved.tenant.operationalEnabled ? "true" : "false",
      );
      tenantSlug = resolved.tenant.slug;
      tenantOperationalEnabled = resolved.tenant.operationalEnabled;
    }

    // Bloqueio de APIs/páginas operacionais públicas por entitlement da empresa.
    // /admin NÃO entra aqui — autenticação/autorização abaixo.
    if (tenantSlug && !tenantAllowsLegacyOperationalData(tenantOperationalEnabled)) {
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

  // O host da plataforma é uma fronteira de autorização própria. Não representa
  // a Gauchinho nem qualquer outra empresa: somente PLATFORM_SUPERADMIN entra.
  if (platformHost) {
    const { data: platformSuperadmin, error: platformRoleError } = user
      ? await supabase.rpc("is_platform_superadmin")
      : { data: false, error: null };
    const platformDecision = decidePlatformHostAccess({
      pathname: path,
      authenticated: Boolean(user),
      platformSuperadmin: !platformRoleError && Boolean(platformSuperadmin),
    });

    if (platformDecision === "allow_login" || platformDecision === "allow_master") {
      return response;
    }
    if (platformDecision === "redirect_login") {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/platform");
      return NextResponse.redirect(login);
    }
    if (platformDecision === "deny") {
      return platformAccessDeniedResponse();
    }
    if (platformDecision === "redirect_master") {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    return platformRouteUnavailableResponse();
  }

  // O shell global não existe em host tenant. Mesmo um Superadmin deve entrar
  // pela fronteira explícita PLATFORM_HOST para evitar contexto ambíguo.
  if (path === "/platform" || path.startsWith("/platform/")) {
    return platformRouteUnavailableResponse();
  }

  if (path.startsWith("/admin")) {
    // 1) Autenticação
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }

    // 2) O layout administrativo valida vínculo ativo exatamente com a empresa
    //    resolvida pelo host. O proxy não bloqueia novas franquias por slug fixo.
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
