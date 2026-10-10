import type { Metadata } from "next";
import React from "react";

import { committedHeldOutResult } from "./evals/held-out-result";
import { DECLARED_MODELS } from "./evals/model-comparison-data";
import { homeExample } from "./home/example";
import { HomeContent } from "./home/home-view";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Walk through one synthetic case: a prepared column mapping, a person's approval, versioned code's result and the source row behind every finding.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  // Read on the server, so only the summary the first screen cites reaches
  // the browser.
  return (
    <HomeContent
      evaluation={{
        candidates: DECLARED_MODELS.length,
        runDate: committedHeldOutResult?.runDate ?? null,
      }}
      example={homeExample()}
    />
  );
}
