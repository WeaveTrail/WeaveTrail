import type { Metadata } from "next";
import React from "react";

import { HomeContent } from "./home/home-view";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Review any trading file by the same rules: AI matches the columns, you approve them, and every result opens to the source trades behind it.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeContent />;
}
