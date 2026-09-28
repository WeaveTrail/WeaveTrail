import { describe, expect, it } from "vitest";
import { POST } from "./route";

const scope = {
  instrumentId: "코스피 200",
  dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
  field: "clpr",
  resolution: "DAILY",
};
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/check/coverage", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

describe("published claim coverage boundary", () => {
  it.each([
    [
      { ...scope, instrumentId: "SYNTHETIC-OUTSIDE" },
      "OUTSIDE_COVERAGE",
      "조회 범위 밖",
      "Outside coverage",
    ],
    [
      { ...scope, resolution: "INTRADAY" },
      "RESOLUTION_TOO_COARSE",
      "시간 해상도 부족",
      "Resolution too coarse",
    ],
    [scope, "DEFINITION_NOT_BOUND", "정의 미연결", "Definition not bound"],
  ])(
    "returns %s with a reason in both languages",
    async (request, reasonCode, ko, en) => {
      const response = await post(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ status: "UNCONFIRMABLE", reasonCode });
      expect(body.reason.ko).toContain(ko);
      expect(body.reason.en).toContain(en);
      expect(body.coverage.sha256).toMatch(/^[a-f0-9]{64}$/);
    },
  );

  it("refuses malformed scopes and caller-provided coverage or definition registries", async () => {
    for (const body of [
      null,
      {},
      { ...scope, coverage: {} },
      { ...scope, definitions: [] },
      {
        ...scope,
        dateWindow: { start: "2026-09-04", endInclusive: "2026-09-03" },
      },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ state: "REVIEW_REQUIRED" });
    }
    expect(
      (
        await POST(
          new Request("http://localhost/api/check/coverage", {
            method: "POST",
            body: "invalid json",
          }),
        )
      ).status,
    ).toBe(422);
  });
});
