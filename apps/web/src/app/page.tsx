import type { Metadata } from "next";
import React from "react";

import { committedHeldOutResult } from "./evals/held-out-result";
import { HomeContent } from "./home-content";
import { homeSelection } from "./home-selection";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Which AI model proposes column mappings in WeaveTrail, why it was chosen, and what stops wrong output before versioned code computes anything.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  // Read on the server, so only the summary the first screen cites reaches
  // the browser.
  return <HomeContent selection={homeSelection(committedHeldOutResult)} />;
}
