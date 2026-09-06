import type { Metadata } from "next";
import React from "react";

import { HomeContent } from "./home-content";

export const metadata: Metadata = {
  title: "Home",
  description:
    "See how WeaveTrail separates constrained AI proposals, human approval, deterministic replay, and traceable evidence.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeContent />;
}
