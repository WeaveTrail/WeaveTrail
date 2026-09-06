import type { Metadata } from "next";
import React from "react";
import { MethodologyContent } from "./methodology-content";

export const metadata: Metadata = {
  title: "Methodology and Boundaries",
  description:
    "Understand WeaveTrail's versioned pattern hypothesis, closed result vocabulary, approval boundary, and interpretation limits.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return <MethodologyContent />;
}
