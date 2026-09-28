import { describe, expect, it, vi } from "vitest";
import { CoverageManifestSchema } from "@weavetrail/contracts";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import { GET } from "./route";

describe("GET /api/coverage", () => {
  it("serves the exact versioned manifest without fetching current source URLs", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No network"));
    try {
      const response = GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(CoverageManifestSchema.parse(body)).toEqual(
        publishedCoverageManifest,
      );
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
