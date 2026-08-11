import { isPlatformEmpresasAdminPath } from "./operational-access";

export type PlatformHostAccessDecision =
  | "allow_login"
  | "redirect_login"
  | "deny"
  | "redirect_master"
  | "allow_master"
  | "unavailable";

/**
 * Política pura e testável do host PLATFORM. A identidade de superadmin é
 * apurada pelo RPC canônico is_platform_superadmin() no proxy; este módulo não
 * conhece nem confia em usuarios.perfil.
 */
export function decidePlatformHostAccess(input: {
  pathname: string;
  authenticated: boolean;
  platformSuperadmin: boolean;
}): PlatformHostAccessDecision {
  if (!input.authenticated) {
    return input.pathname === "/login" ? "allow_login" : "redirect_login";
  }
  if (!input.platformSuperadmin) return "deny";
  if (input.pathname === "/login" || input.pathname === "/" || input.pathname === "/admin") {
    return "redirect_master";
  }
  return isPlatformEmpresasAdminPath(input.pathname) ? "allow_master" : "unavailable";
}
