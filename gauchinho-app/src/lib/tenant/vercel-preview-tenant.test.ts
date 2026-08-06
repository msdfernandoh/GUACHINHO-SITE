import { describe, expect, it } from "vitest";
import {
  isVercelPreviewGauchinhoHost,
  type VercelRuntimeEnv,
} from "./vercel-preview-tenant";

const OFFICIAL_PREVIEW_HOST =
  "guachinho-site-d2g4rrpyv-hugo-8097s-projects.vercel.app";

function previewEnv(overrides: Partial<VercelRuntimeEnv> = {}): VercelRuntimeEnv {
  return {
    VERCEL_ENV: "preview",
    VERCEL_URL: OFFICIAL_PREVIEW_HOST,
    VERCEL_BRANCH_URL: OFFICIAL_PREVIEW_HOST,
    VERCEL_PROJECT_PRODUCTION_URL: "guachinho-site.vercel.app",
    ...overrides,
  };
}

describe("isVercelPreviewGauchinhoHost", () => {
  it("host oficial do preview + VERCEL_ENV=preview → elegível", () => {
    expect(isVercelPreviewGauchinhoHost(OFFICIAL_PREVIEW_HOST, previewEnv())).toBe(true);
  });

  it("mesmo host + VERCEL_ENV=production → bloqueado", () => {
    expect(
      isVercelPreviewGauchinhoHost(
        OFFICIAL_PREVIEW_HOST,
        previewEnv({ VERCEL_ENV: "production" }),
      ),
    ).toBe(false);
  });

  it("VERCEL_TARGET_ENV=production bloqueia mesmo com VERCEL_ENV=preview", () => {
    expect(
      isVercelPreviewGauchinhoHost(
        OFFICIAL_PREVIEW_HOST,
        previewEnv({ VERCEL_TARGET_ENV: "production" }),
      ),
    ).toBe(false);
  });

  it("preview de outro projeto → bloqueado", () => {
    const other = "outro-app-abc123-other-team.vercel.app";
    expect(
      isVercelPreviewGauchinhoHost(
        other,
        previewEnv({ VERCEL_URL: other, VERCEL_BRANCH_URL: other }),
      ),
    ).toBe(false);
  });

  it("host aleatório *.vercel.app → bloqueado", () => {
    expect(
      isVercelPreviewGauchinhoHost("random-thing.vercel.app", previewEnv()),
    ).toBe(false);
  });

  it("Host spoof diferente do VERCEL_URL deste deploy → bloqueado", () => {
    expect(
      isVercelPreviewGauchinhoHost(
        "guachinho-site-outrohash-hugo-8097s-projects.vercel.app",
        previewEnv(),
      ),
    ).toBe(false);
  });

  it("host de produção do projeto → bloqueado", () => {
    expect(
      isVercelPreviewGauchinhoHost(
        "guachinho-site.vercel.app",
        previewEnv({
          VERCEL_URL: "guachinho-site.vercel.app",
          VERCEL_BRANCH_URL: "guachinho-site.vercel.app",
        }),
      ),
    ).toBe(false);
  });

  it("domínio oficial Gauchinho nunca usa fallback de preview", () => {
    expect(
      isVercelPreviewGauchinhoHost("gauchinhoconsorcios.com.br", previewEnv()),
    ).toBe(false);
    expect(
      isVercelPreviewGauchinhoHost("www.gauchinhoconsorcios.com.br", previewEnv()),
    ).toBe(false);
  });

  it("aceita VERCEL_BRANCH_URL quando Host coincide", () => {
    const branchHost = "guachinho-site-git-feature-saas-foundation-hugo-8097s-projects.vercel.app";
    expect(
      isVercelPreviewGauchinhoHost(
        branchHost,
        previewEnv({
          VERCEL_URL: OFFICIAL_PREVIEW_HOST,
          VERCEL_BRANCH_URL: branchHost,
        }),
      ),
    ).toBe(true);
  });
});
