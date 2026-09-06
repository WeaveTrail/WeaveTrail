import type { Metadata } from "next";
import React from "react";

import { ArchitectureContent } from "./architecture-content";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "Review WeaveTrail's trust boundary between untrusted interpretation, human approval, deterministic decisions, and traceable evidence.",
  alternates: { canonical: "/architecture" },
};

export default function ArchitecturePage() {
  return <ArchitectureContent />;
}
