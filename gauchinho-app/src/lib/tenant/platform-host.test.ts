import { describe, expect, it } from "vitest";
import { decidePlatformHostAccess } from "./platform-host";

describe("Platform Host — autenticação e RBAC", () => {
  it("anônimo é enviado ao login", () => {
    expect(
      decidePlatformHostAccess({ pathname: "/", authenticated: false, platformSuperadmin: false }),
    ).toBe("redirect_login");
    expect(
      decidePlatformHostAccess({ pathname: "/login", authenticated: false, platformSuperadmin: false }),
    ).toBe("allow_login");
  });

  it("PLATFORM_SUPERADMIN entra no painel master existente", () => {
    expect(
      decidePlatformHostAccess({ pathname: "/", authenticated: true, platformSuperadmin: true }),
    ).toBe("redirect_master");
    expect(
      decidePlatformHostAccess({
        pathname: "/admin/empresas",
        authenticated: true,
        platformSuperadmin: true,
      }),
    ).toBe("allow_master");
    expect(
      decidePlatformHostAccess({
        pathname: "/admin/administradoras",
        authenticated: true,
        platformSuperadmin: true,
      }),
    ).toBe("allow_master");
  });

  it.each(["admin_empresa", "gestor", "consultor", "visualizador"])(
    "%s autenticado é bloqueado sem a concessão canônica de plataforma",
    () => {
      expect(
        decidePlatformHostAccess({
          pathname: "/admin/empresas",
          authenticated: true,
          platformSuperadmin: false,
        }),
      ).toBe("deny");
    },
  );
});
