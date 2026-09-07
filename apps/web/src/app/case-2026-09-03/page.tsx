import type { Metadata } from "next";
import React from "react";

import {
  publishedCaseProposal,
  publishedCaseSeries,
} from "../../lib/published-case";
import { CaseBoundary } from "./case-boundary";
import { CaseHeading } from "./case-heading";

export const metadata: Metadata = {
  title: "The 2026-09-03 case",
  description:
    "Approve one authored case over committed published KOSPI 200 index and futures artifacts, then run the versioned cross-market session reversal rule against it.",
  alternates: { canonical: "/case-2026-09-03" },
};

export default function PublishedCasePage() {
  const { proposal } = publishedCaseProposal();
  const { spot, future, spotArtifactHash, futureArtifactHash } =
    publishedCaseSeries();
  return (
    <main className="shell page-shell case-page">
      <CaseHeading />
      <CaseBoundary
        futureArtifactHash={futureArtifactHash}
        future={future}
        previousClose={spot.at(-2)!.close}
        proposal={proposal}
        spotArtifactHash={spotArtifactHash}
        spot={spot}
      />
    </main>
  );
}
