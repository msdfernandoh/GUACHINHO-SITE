import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
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
  matcher: ["/admin/:path*", "/login"],
};
