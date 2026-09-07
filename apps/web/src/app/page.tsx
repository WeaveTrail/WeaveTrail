import type { Metadata } from "next";
import React from "react";

import { HomeContent } from "./home-content";
import { publishedCaseSeries } from "../lib/published-case";

export const metadata: Metadata = {
  title: "Home",
  description:
    "See how WeaveTrail separates constrained AI proposals, human approval, deterministic replay, and traceable evidence.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  // Read on the server so the committed artifacts never reach the browser
  // bundle: the entry screen needs one day from each leg, not the series.
  const { spot, future } = publishedCaseSeries();
  return (
    <HomeContent
      event={{
        spot: spot.at(-1)!,
        future,
        previousClose: spot.at(-2)!.close,
      }}
    />
  );
}
