import type { Metadata } from "next";
import React from "react";

import { WhyView } from "./why-view";

export const metadata: Metadata = {
  title: "Why WeaveTrail",
  description:
    "What a reviewer gains: unfamiliar trading files ready to review, only checked input computed, the same result on every rerun, and evidence that goes back to the source trades.",
  alternates: { canonical: "/why" },
};

export default function WhyPage() {
  return <WhyView />;
}
