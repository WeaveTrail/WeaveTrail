import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSiteUrl } from "./site-url";

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("WEAVETRAIL_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("uses the local origin when no deployment origin exists", () => {
    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");
  });

  it("uses the stable project origin for production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "weave-trail.vercel.app");

    expect(getSiteUrl().toString()).toBe("https://weave-trail.vercel.app/");
  });

  it("keeps preview metadata isolated from the production origin", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "weave-trail-git-change.example.vercel.app");
    vi.stubEnv("WEAVETRAIL_SITE_URL", "https://weave-trail.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "weave-trail.vercel.app");

    expect(getSiteUrl().toString()).toBe(
      "https://weave-trail-git-change.example.vercel.app/",
    );
  });

  it.each([
    "https://example.com/workbench",
    "https://example.com?source=deployment",
    "https://example.com#deployment",
    "https://user:secret@example.com",
    "https://user@example.com",
  ])("rejects a configured URL that is not an origin: %s", (configuredUrl) => {
    vi.stubEnv("WEAVETRAIL_SITE_URL", configuredUrl);

    expect(() => getSiteUrl()).toThrow(
      "WEAVETRAIL_SITE_URL must be an origin without credentials, a path, query, or hash.",
    );
  });
});
