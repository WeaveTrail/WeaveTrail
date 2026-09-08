import type { SourceProvenance } from "@weavetrail/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { syntheticSourceProvenanceByArtifact } from "@weavetrail/scenarios";
import {
  mappingApprovalArtifact,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import { syntheticDailyQuoteSpecimen } from "../../../../../packages/replay-engine/src/testing/daily-quotes";
import {
  CaseReplay,
  DailyQuoteCaseLimitation,
  SourceProvenanceDetails,
  type ReplayScenarioOption,
} from "./case-replay";
import { prepareReplayScenarios } from "./prepare-scenarios";

describe("daily quote display plumbing with synthetic specimens", () => {
  it("renders the registered published source with licence, columns, reasons and a manifest-free limitation", async () => {
    const prepared = await prepareReplayScenarios();
    const scenario = prepared.scenarios.find(
      ({ value }) => value === "real/fsc-stock-quotes-20260903.jsonl",
    )!;
    expect(scenario.provenance?.kind).toBe("real");
    expect(scenario).not.toHaveProperty("manifest");
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, scenarios: [scenario] }),
    );
    for (const text of [
      "금융위원회_주식시세정보",
      "20260903",
      "이용허락범위 제한 없음",
      "Official source distribution",
      "DAILY_QUOTE",
      "Reviewer reason for basDt",
      "Reviewer reason for clpr",
      "Reviewer reason for trqu",
      "Normalize source",
      "Case approval unavailable",
      "actor profile is empty",
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain("Approve case manifest");
    expect(markup).not.toContain("Pattern outcome:");
    expect(markup).not.toContain("These synthetic source records");
    expect(markup).not.toContain("case before replay");
    expect(markup).not.toContain("approve its mapping and case");
    expect(markup).toContain("Ready to normalize");
    expect(markup).not.toContain("Repeat the same approved case");
    expect(markup).toContain("licensed published sources");
    expect(markup).toContain("Complete source record");
    expect(markup).toContain(scenario.provenance!.recordUrl);
    expect(markup).toContain('value="baseline"');
    expect(markup).toContain('value="shuffle"');
    expect(markup).not.toContain('value="duplicate"');
    expect(markup).toContain("Neither control invents a value or participant");
    expect(markup).not.toContain(
      "Synthetic committed sources, a deterministic fixture mapping",
    );
  });
  it("treats mapping 1.6 index observations as daily normalization", async () => {
    const prepared = await prepareReplayScenarios();
    const scenario = prepared.scenarios.find(
      ({ value }) =>
        value === "real/fsc-kospi-index-family-20260903/source.jsonl",
    )!;
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, scenarios: [scenario] }),
    );
    expect(markup).toContain("DAILY_QUOTE");
    expect(markup).toContain("Composite source event identity");
    expect(markup).toContain("basDt + idxNm");
    expect(markup).toContain("NUL_JOIN");
    expect(markup.indexOf("Composite source event identity")).toBeLessThan(
      markup.indexOf("Approve executed mapping"),
    );
    expect(markup).toContain("Normalize source");
    expect(markup).toContain("Case approval unavailable");
    expect(markup).not.toContain("Run deterministic replay");
  });
  it("keeps case approval and repeat guidance for a source with a manifest", async () => {
    const prepared = await prepareReplayScenarios();
    const scenario = prepared.scenarios.find(
      ({ value }) => value === "published-execution-fix44.csv",
    )!;
    expect(scenario).toHaveProperty("manifest");
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, scenarios: [scenario] }),
    );
    expect(markup).toContain("case before running it");
    expect(markup).toContain("approve its mapping and case");
    expect(markup).toContain("Ready to replay");
    expect(markup).toContain("Repeat the same approved case");
    expect(markup).not.toContain("Ready to normalize");
  });
  it("shows daily semantics and required reasons before approval while leaving normalization as the action", () => {
    const { rows, proposal } = syntheticDailyQuoteSpecimen();
    const scenario: ReplayScenarioOption = {
      value: "concentrated-buy-dialect-a.csv",
      label: "Synthetic daily interpretation specimen",
      purpose: "ENGINE_REGRESSION",
      sourceArtifactHash: proposal.sourceArtifactHash,
      rows,
      availableMutations: ["baseline", "shuffle", "duplicate"],
      provenance:
        syntheticSourceProvenanceByArtifact["concentrated-buy-dialect-a.csv"],
    };
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, {
        providerMode: "fixture",
        scenarios: [scenario],
        proposals: { [proposal.sourceArtifactHash]: proposal },
      }),
    );
    for (const text of [
      "DAILY_QUOTE",
      "day-start anchor",
      "daily closing price",
      "daily aggregate volume",
      "reviewer reason",
      "Normalize source",
      "Case approval unavailable",
      "Adding an actor alone",
      "WeaveTrail contributors",
      "Open the complete source record",
      scenario.provenance!.recordUrl,
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain("Approve case manifest");
    expect(markup).not.toContain("Pattern outcome:");
    expect(markup).not.toContain("Daily quotes normalized.");
    expect(markup).not.toContain("CASE_REVIEW_REQUIRED");
  });

  it("distinguishes successful normalization from refused case approval", () => {
    const markup = renderToStaticMarkup(
      createElement(DailyQuoteCaseLimitation, { normalized: true }),
    );
    expect(markup).toContain("Daily quotes normalized.");
    expect(markup).not.toContain("Published daily quotes normalized.");
    expect(markup).toContain("Case approval unavailable");
    expect(markup).not.toContain("CASE_REVIEW_REQUIRED");
  });

  it("renders all supplied provenance fields without assigning a licence to the data", () => {
    // Artificial display object, deliberately labeled as a synthetic test.
    const provenance: SourceProvenance = {
      kind: "real",
      provider: "Synthetic test provider",
      title: "합성 출처 표시 테스트",
      titleEnglish: "Synthetic provenance display test",
      originUrl: "https://example.invalid/distribution",
      retrievedAt: "2024-03-01T00:00:00Z",
      basDt: "20240229",
      venue: { value: "SYNTH-X", basis: "Synthetic venue basis" },
      licence: {
        label: "Synthetic permission label",
        termsUrl: "https://example.invalid/terms",
        checkedAt: "2024-03-01T00:00:00Z",
        attributionRequirements: "Synthetic attribution condition",
        attribution: "Synthetic provider credit",
      },
      recordUrl: "https://example.invalid/provenance",
    };
    const markup = renderToStaticMarkup(
      createElement(SourceProvenanceDetails, { provenance }),
    );
    for (const text of [
      provenance.provider,
      provenance.title,
      provenance.titleEnglish,
      provenance.originUrl,
      provenance.retrievedAt,
      provenance.basDt,
      provenance.venue.basis,
      ...Object.values(provenance.licence),
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain("CC0");
    expect(markup).not.toContain("Apache");
  });

  it("renders an inclusive published trading-date range as two dates", () => {
    const provenance: SourceProvenance = {
      kind: "real",
      provider: "Synthetic test provider",
      title: "합성 기간 출처 표시 테스트",
      titleEnglish: "Synthetic range provenance display test",
      originUrl: "https://example.invalid/distribution",
      retrievedAt: "2024-03-02T00:00:00Z",
      basDtRange: { begin: "20240201", endInclusive: "20240229" },
      venue: { value: "SYNTH-X", basis: "Synthetic venue basis" },
      licence: {
        label: "Synthetic permission label",
        termsUrl: "https://example.invalid/terms",
        checkedAt: "2024-03-02T00:00:00Z",
        attributionRequirements: "Synthetic attribution condition",
        attribution: "Synthetic provider credit",
      },
      recordUrl: "https://example.invalid/provenance",
    };
    const markup = renderToStaticMarkup(
      createElement(SourceProvenanceDetails, { provenance }),
    );
    expect(markup).toContain("Trading date range (basDt)");
    expect(markup).toContain("2024-02-01 through 2024-02-29");
    expect(markup).toContain("20240201</code> through <code>20240229");
  });

  it("prepares scenario provenance outside protected mapping artifacts", async () => {
    const prepared = await prepareReplayScenarios();
    for (const scenario of prepared.scenarios) {
      expect(scenario.provenance?.recordUrl).toContain("/blob/main/");
      if (scenario.provenance?.kind === "synthetic") {
        expect(scenario.provenance.recordUrl).toMatch(
          /packages\/scenarios\/src\/sources\/.+\.provenance\.json$/,
        );
        expect(scenario.provenance).not.toHaveProperty("retrievedAt");
      } else {
        expect(scenario.provenance?.kind).toBe("real");
        expect(scenario.provenance).toHaveProperty("retrievedAt");
      }
      const proposal = prepared.proposals[scenario.sourceArtifactHash]!;
      const before = sha256Canonical(mappingApprovalArtifact(proposal));
      scenario.provenance = {
        kind: "synthetic",
        provider: "WeaveTrail",
        title: "Updated display record",
        attribution: "Updated display credit",
        recordUrl: "https://example.invalid/updated-provenance",
      };
      expect(sha256Canonical(mappingApprovalArtifact(proposal))).toBe(before);
      expect(proposal).not.toHaveProperty("provenance");
    }
  });
});
