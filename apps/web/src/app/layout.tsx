import type { Metadata } from "next";
import localFont from "next/font/local";

import "./design/tokens.css";
import "./design/base.css";
import "./design/components.css";
import "./shell/shell.css";

import { getSiteUrl } from "./site-url";
import { LanguageProvider } from "./i18n/language";
import { PrintDisclosures } from "./shell/print-disclosures";
import { SiteFooter, SiteHeader, SkipLink } from "./shell/site-chrome";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "WeaveTrail",
    template: "%s | WeaveTrail",
  },
  description:
    "An AI model proposes what each column of a trading file means, a person approves it, versioned code computes the result, and every finding traces back to its source rows.",
};

const plex = localFont({
  variable: "--font-sans-local",
  display: "swap",
  src: [
    { path: "../fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-sans/IBMPlexSans-Medium.woff2", weight: "500" },
    {
      path: "../fonts/ibm-plex-sans/IBMPlexSans-SemiBold.woff2",
      weight: "600",
    },
  ],
});

const mono = localFont({
  variable: "--font-mono-local",
  display: "swap",
  src: [
    {
      path: "../fonts/jetbrains-mono/JetBrainsMono-Regular.woff2",
      weight: "400",
    },
    {
      path: "../fonts/jetbrains-mono/JetBrainsMono-Medium.woff2",
      weight: "500",
    },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-Bold.woff2", weight: "700" },
  ],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${plex.variable} ${mono.variable}`} lang="en">
      <body>
        <LanguageProvider>
          <PrintDisclosures />
          <SkipLink />
          <SiteHeader />
          <div id="main-content">{children}</div>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
