import type { Metadata } from "next";
import React from "react";

import { ArchitectureContent } from "./architecture-content";

export const metadata: Metadata = {
  title: "How it runs",
  description:
    "Who does what: the AI only suggests, a reviewer approves, versioned rules compute the result, and every finding goes back to its source row.",
  alternates: { canonical: "/architecture" },
};

export default function ArchitecturePage() {
  return <ArchitectureContent />;
}
