import type { Metadata } from "next";
import React from "react";
import { MethodologyContent } from "./methodology-content";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "The three results a replay can return, the review stop before anything runs, and what a result does not mean.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return <MethodologyContent />;
}
