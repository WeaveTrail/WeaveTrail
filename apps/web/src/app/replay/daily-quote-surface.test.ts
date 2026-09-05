import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  syntheticSourceProvenance,
  type SourceProvenance,
} from "@weavetrail/scenarios";
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
  });
  it("shows daily semantics and required reasons before approval while leaving normalization as the action", () => {
    const { rows, proposal } = syntheticDailyQuoteSpecimen();
    const scenario: ReplayScenarioOption = {
      value: "concentrated-buy-dialect-a.csv",
      label: "Synthetic daily interpretation specimen",
      sourceArtifactHash: proposal.sourceArtifactHash,
      rows,
      provenance: syntheticSourceProvenance,
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
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain("Approve case manifest");
    expect(markup).not.toContain("Pattern outcome:");
    expect(markup).not.toContain("Published daily quotes normalized.");
    expect(markup).not.toContain("CASE_REVIEW_REQUIRED");
  });

  it("distinguishes successful normalization from refused case approval", () => {
    const markup = renderToStaticMarkup(
      createElement(DailyQuoteCaseLimitation, { normalized: true }),
    );
    expect(markup).toContain("Published daily quotes normalized.");
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

  it("prepares scenario provenance outside protected mapping artifacts", async () => {
    const prepared = await prepareReplayScenarios();
    for (const scenario of prepared.scenarios) {
      if (scenario.provenance?.kind === "synthetic") {
        expect(scenario.provenance).toEqual(syntheticSourceProvenance);
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
        attribution: "Updated display credit",
      };
      expect(sha256Canonical(mappingApprovalArtifact(proposal))).toBe(before);
      expect(proposal).not.toHaveProperty("provenance");
    }
  });
});
