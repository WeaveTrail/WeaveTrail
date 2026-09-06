import type { Metadata } from "next";
import React from "react";

import { WhyView } from "./why-view";

export const metadata: Metadata = {
  title: "Where it fits",
  description:
    "Where WeaveTrail sits relative to an existing surveillance pipeline: what detection already does, what it still hands to a person, and what each of the four layers may and may not do.",
  alternates: { canonical: "/why" },
};

export default function WhyPage() {
  return <WhyView />;
}
