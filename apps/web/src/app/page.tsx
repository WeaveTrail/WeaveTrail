import type { Metadata } from "next";
import React from "react";

import { HomeContent } from "./home/home-view";

export const metadata: Metadata = {
  title: "Home",
  description:
    "A synthetic demo of trade-surveillance review: AI matches the columns of a trading file, you approve them, and each finding opens to the source trades behind it.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeContent />;
}
